import { useEffect, useRef, useState } from 'react';
import { StatusBar } from '@freeappstore/sdk/ui';
import { stopAudio } from '../dialogue/audio';
import { categoryOf, repairs } from '../dialogue/catalog';
import { matchTranscripts } from '../dialogue/finder';
import { applyRepair, type Line, type Repair, type Scenario } from '../dialogue/model';
import { href, navigate } from '../route';
import { AUDIO_NOTE, Icon, IconButton, LineBlock, ListenButton, PlayButton, Sheet, TopBar } from './common';
import { DisplaySettings, useDisplay, useSpeak, Zh } from './prefs';

type Bubble = { key: string; from: 'them' | 'you'; line: Line; speaker?: string; current?: boolean };
const isBlocked = (e: unknown) => e instanceof DOMException && e.name === 'NotAllowedError';

export function DialoguePlayer({ scenario, path, nodeId }: { scenario: Scenario; path: string[]; nodeId: string }) {
  const node = scenario.nodes[nodeId];
  const [{ meaning, delay, autoplay, playThem, playYou }] = useDisplay();
  const speak = useSpeak();
  const speakNow = useRef(speak); // the autoplay effect reads the current settings without re-running on them
  speakNow.current = speak;
  const [playing, setPlaying] = useState(false);
  const [listenError, setListenError] = useState('');
  const [warning, setWarning] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [repairLog, setRepairLog] = useState<Bubble[]>([]);
  const [fallback, setFallback] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [heard, setHeard] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<'help' | 'settings' | null>(null);
  const run = useRef(0); // invalidates an interrupted repair sequence
  const label = useRef<HTMLSpanElement>(null);
  const moved = useRef(false); // the user picked or changed a reply: the pressed button is gone
  const endHeading = useRef<HTMLElement>(null);

  useEffect(() => {
    // A new turn replaces the button that was pressed: put focus on the new prompt (or the ending).
    const focusFrame = requestAnimationFrame(() => (label.current ?? endHeading.current)?.focus({ preventScroll: true }));
    setPlaying(false); setWarning(''); setSelected(null); setHint(false); setRemaining(0); setRepairLog([]); setFallback(''); setRevealed(false); setHeard(null); setListenError('');
    let active = true;
    run.current++;
    if (!autoplay) return () => cancelAnimationFrame(focusFrame);
    setPlaying(true);
    speakNow.current('them', node)
      .catch(e => { if (active) setWarning(isBlocked(e) ? 'Tap ▶ on the message to hear it.' : 'Audio could not play. Read the line and reply.'); })
      .finally(() => { if (active) setPlaying(false); });
    return () => { active = false; cancelAnimationFrame(focusFrame); stopAudio(); };
    // autoplay is read at the start of a turn only: changing the setting must not replay the line.
  }, [scenario.id, nodeId, node.zh]);

  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  // Keep the newest message in view: scroll the page to its end, where the dock sits in its own place.
  useEffect(() => { if (moved.current) { moved.current = false; label.current?.focus({ preventScroll: true }); } }, [selected]);

  // Two frames later: after a navigation the Shell scrolls to the top one frame later.
  useEffect(() => {
    let inner = 0;
    const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight })); });
    return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner); };
  }, [nodeId, repairLog.length, fallback, warning, selected]);

  // The thread so far, rebuilt from the path in the URL.
  const thread: Bubble[] = [];
  let at = scenario.start;
  path.forEach((choiceId, i) => {
    const n = scenario.nodes[at];
    const choice = n.choices.find(c => c.id === choiceId)!;
    thread.push({ key: `t${i}`, from: 'them', line: n, speaker: n.speaker }, { key: `y${i}`, from: 'you', line: choice });
    at = choice.next;
  });
  thread.push({ key: 'now', from: 'them', line: node, speaker: node.speaker, current: true }, ...repairLog);

  const askRepair = async (r: Repair) => {
    setSheet(null);
    const outcome = applyRepair(node, r);
    const n = repairLog.length;
    const added: Bubble[] = [{ key: `r${n}`, from: 'you', line: r }];
    if (outcome.response) added.push({ key: `r${n}a`, from: 'them', line: outcome.response, speaker: node.speaker });
    if (outcome.replay && outcome.replay !== node) added.push({ key: `r${n}b`, from: 'them', line: outcome.replay, speaker: node.speaker });
    setRepairLog(log => [...log, ...added]);
    setFallback(outcome.fallback ?? '');
    if (outcome.revealMeaning) setRevealed(true);
    const mine = ++run.current;
    try {
      if (outcome.response) await speak('them', outcome.response);
      if (outcome.replay && mine === run.current) await speak('them', outcome.replay, outcome.rate !== undefined);
    } catch { /* the text is in the thread */ }
  };
  const choice = node.choices.find(c => c.id === selected);
  const check = choice && heard ? matchTranscripts([{ ...choice, key: choice.id, replies: [] }], heard, {})[0] : undefined;
  const pick = (id: string) => { stopAudio(); moved.current = true; setSelected(id); setHint(false); setHeard(null); setListenError(''); setRemaining(delay); };
  const slow = (voice: 'them' | 'you', line: Line, label: string) =>
    <button type="button" className="speed-btn" aria-label={label} title={label} onClick={() => { void speak(voice, line, true).catch(() => {}); }}>Slow</button>;

  return <div className="app">
    <TopBar back={href.home} backLabel="All conversations" title={scenario.title} subtitle={`${scenario.icon} ${categoryOf(scenario).title}`}
      action={<IconButton icon="more" label="Conversation menu" onClick={() => setSheet('settings')} />} />

    <div className="app-body thread" aria-live="polite">
      {thread.map((b, i) => b.from === 'them'
        ? <div key={b.key} className={`bubble-row them${b.current ? ' current' : ''}`}>
            <span className="avatar" aria-hidden="true">{b.speaker?.[0]}</span>
            <div className="bubble them">
              {thread[i - 1]?.from !== 'them' && <span className="bubble-speaker">{b.speaker}</span>}
              <p className="bubble-text"><Zh line={b.line} className="bubble-zh" /></p>
              {(meaning || (b.current && revealed)) && <p className="meaning">{b.line.en}</p>}
              {playThem && <div className="bubble-actions">
                <PlayButton voice="them" line={b.line} label={`Play: ${b.line.en}`} />
                {slow('them', b.line, 'Play slower')}
              </div>}
            </div>
          </div>
        : <div key={b.key} className="bubble-row you">
            <div className="bubble you">
              <p className="bubble-text"><Zh line={b.line} className="bubble-zh" /></p>
              {meaning && <p className="meaning">{b.line.en}</p>}
              {playYou && <div className="bubble-actions">
                <PlayButton voice="you" line={b.line} label={`Play my reply: ${b.line.en}`} />
                {slow('you', b.line, 'Play my reply slower')}
              </div>}
            </div>
          </div>)}
      {warning && <p className="system-note" role="status">{warning}</p>}
      {fallback && <p className="system-note" role="status">{fallback} <button type="button" className="text-btn" onClick={() => setRevealed(true)}>Show meaning</button></p>}
      {revealed && !meaning && <p className="system-note">Meaning shown as a learner aid — in real life they may not translate.</p>}
      {repairLog.length > 0 && node.choices.length > 0 && <p className="system-note">Still the same turn — reply when you’re ready.</p>}
      {!node.choices.length && <div className="end-card" role="status"><span aria-hidden="true">🎉</span><strong ref={endHeading} tabIndex={-1} data-fas-page-heading="">Conversation complete</strong><p>{node.outcome}</p></div>}
    </div>

    <div className="dock">
      <div className="composer">
        {!node.choices.length ? <div className="composer-row">
          <a className="btn" href={href.home}>More conversations</a>
          <a className="btn primary grow" href={href.play(scenario.id)}>Start over</a>
        </div> : choice ? <>
          <div className="composer-head">
            <span ref={label} className="composer-label" tabIndex={-1} data-fas-page-heading="">Your reply</span>
            <button type="button" className="text-btn" onClick={() => { moved.current = true; setSelected(null); }}>Change</button>
          </div>
          <p className="intent">“{choice.en}”</p>
          <p className="instruction">Say it <strong>in Mandarin, out loud</strong>, then tap Send.</p>
          {remaining > 0
            ? <p className="hint-text" role="timer">Try it yourself first — help in {remaining}s</p>
            : hint ? <LineBlock line={choice} voice="you" meaning={false} />
            : <button type="button" className="btn small-btn" onClick={() => setHint(true)}>Show me how to say it</button>}
          {heard && <p className="hint-text" role="status">Heard “<span lang="zh-CN">{heard[0]}</span>” — {check?.exact ? 'exact text match with the hint.' : check ? 'close to the hint text.' : 'different from the hint; fine if you said it another way.'} Words only, not tones.</p>}
          {listenError && <p className="hint-text" role="status">{listenError}</p>}
          <div className="composer-row">
            <ListenButton compact label="Check my reply (optional)" onHeard={setHeard} onError={setListenError} />
            <button type="button" className="btn primary grow" onClick={() => navigate(href.play(scenario.id, [...path, choice.id]))}>Send <Icon name="send" /></button>
          </div>
        </> : <>
          <div className="composer-head">
            <span ref={label} className="composer-label" tabIndex={-1} data-fas-page-heading="">Your turn</span>
            {playing && <button type="button" className="text-btn" onClick={() => { stopAudio(); setPlaying(false); }}>Stop audio</button>}
            <button type="button" className="pill small" onClick={() => setSheet('help')}><Icon name="help" /><span>Help</span></button>
          </div>
          <div className="reply-options">{node.choices.map(c => <button type="button" key={c.id} className="reply-option" onClick={() => pick(c.id)}>{c.en}</button>)}</div>
        </>}
      </div>
      <StatusBar />
    </div>

    <Sheet open={sheet === 'help'} onClose={() => setSheet(null)} title="Need help?">
      <p className="hint-text">Ask them to repeat, slow down or rephrase. You stay on this turn.</p>
      <div className="list">{repairs.map(r => <button type="button" key={r.id} className="list-row" onClick={() => void askRepair(r)}>
        <span className="list-main"><strong>{r.en}</strong><span className="row-zh small"><Zh line={r} /></span></span><Icon name="chevron" />
      </button>)}</div>
      <a className="list-row" href={href.find(scenario.id, path)}><span className="list-main"><strong>Heard something else?</strong><span>Find the phrase and ready replies</span></span><Icon name="search" /></a>
    </Sheet>

    <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Conversation">
      <div className="list">
        <a className="list-row" href={href.script(scenario.id)}><span className="list-main"><strong>Full script</strong><span>Every line and where each reply leads</span></span><Icon name="script" /></a>
        {path.length > 0 && <a className="list-row" href={href.play(scenario.id)}><span className="list-main"><strong>Restart conversation</strong></span><Icon name="chevron" /></a>}
      </div>
      <h3 className="section-label sheet-section">Display</h3>
      <DisplaySettings />
      <p className="hint-text">{AUDIO_NOTE}</p>
    </Sheet>
  </div>;
}
