import { useEffect, useRef, useState } from 'react';
import { StatusBar } from '@freeappstore/sdk/ui';
import { playLine, stopAudio } from '../dialogue/audio';
import { categoryOf, repairs } from '../dialogue/catalog';
import { matchTranscripts } from '../dialogue/finder';
import { applyRepair, type Line, type Repair, type Scenario } from '../dialogue/model';
import { href, navigate } from '../route';
import { AUDIO_NOTE, Icon, IconButton, LineBlock, ListenButton, PlayButton, Sheet, TopBar, usePref } from './common';

type Bubble = { key: string; from: 'them' | 'you'; line: Line; speaker?: string; current?: boolean };
const isBlocked = (e: unknown) => e instanceof DOMException && e.name === 'NotAllowedError';

export function DialoguePlayer({ scenario, path, nodeId }: { scenario: Scenario; path: string[]; nodeId: string }) {
  const node = scenario.nodes[nodeId];
  const [pinyin, setPinyin] = usePref('dialogue:pinyin', false);
  const [meaning, setMeaning] = usePref('dialogue:meaning', true);
  const [delay, setDelay] = usePref('dialogue:delay', 0);
  const [ready, setReady] = useState(false);
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

  useEffect(() => {
    setReady(false); setWarning(''); setSelected(null); setHint(false); setRemaining(0); setRepairLog([]); setFallback(''); setRevealed(false); setHeard(null);
    let active = true;
    run.current++;
    playLine('them', node.zh)
      .catch(e => { if (active) setWarning(isBlocked(e) ? 'Tap ▶ to hear the line.' : 'Audio could not play. Read the line and reply.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; stopAudio(); };
  }, [scenario.id, nodeId, node.zh]);

  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  // Keep the newest message in view: scroll the page to its end, where the dock sits in its own place.
  useEffect(() => { window.scrollTo({ top: document.documentElement.scrollHeight }); }, [nodeId, repairLog.length, fallback, warning]);

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
      if (outcome.response) await playLine('them', outcome.response.zh);
      if (outcome.replay && mine === run.current) await playLine('them', outcome.replay.zh, outcome.rate);
    } catch { /* the text is in the thread */ }
  };
  const choice = node.choices.find(c => c.id === selected);
  const check = choice && heard ? matchTranscripts([{ ...choice, key: choice.id, replies: [] }], heard, {})[0] : undefined;
  const pick = (id: string) => { setSelected(id); setHint(false); setHeard(null); setRemaining(delay); };

  return <div className="app">
    <TopBar back={href.home} backLabel="All conversations" title={scenario.title} subtitle={`${scenario.icon} ${categoryOf(scenario).title}`}
      action={<IconButton icon="more" label="Conversation settings" onClick={() => setSheet('settings')} />} />

    <div className="app-body thread" aria-live="polite">
      {thread.map((b, i) => b.from === 'them'
        ? <div key={b.key} className={`bubble-row them${b.current ? ' current' : ''}`}>
            <span className="avatar" aria-hidden="true">{b.speaker?.[0]}</span>
            <div className="bubble them">
              {thread[i - 1]?.from !== 'them' && <span className="bubble-speaker">{b.speaker}</span>}
              <p className="bubble-zh" lang="zh-CN">{b.line.zh}</p>
              {pinyin && <p className="pinyin">{b.line.pinyin}</p>}
              {(meaning || (b.current && revealed)) && <p className="meaning">{b.line.en}</p>}
              <div className="bubble-actions">
                <PlayButton voice="them" zh={b.line.zh} label="Play" />
                {b.current && <IconButton icon="slow" label="Play slower" className="small" onClick={() => { void playLine('them', node.zh, 0.7).catch(() => {}); }} />}
              </div>
            </div>
          </div>
        : <div key={b.key} className="bubble-row you">
            <div className="bubble you">
              <p className="bubble-zh" lang="zh-CN">{b.line.zh}</p>
              {pinyin && <p className="pinyin">{b.line.pinyin}</p>}
              <p className="meaning">{b.line.en}</p>
            </div>
          </div>)}
      {warning && <p className="system-note" role="status">{warning}</p>}
      {fallback && <p className="system-note" role="status">{fallback} <button type="button" className="text-btn" onClick={() => setRevealed(true)}>Show meaning</button></p>}
      {revealed && !meaning && <p className="system-note">Meaning shown as a learner aid — in real life they may not translate.</p>}
      {repairLog.length > 0 && node.choices.length > 0 && <p className="system-note">Still the same turn — reply when you’re ready.</p>}
      {!node.choices.length && <div className="end-card" role="status"><span aria-hidden="true">🎉</span><strong>Conversation complete</strong><p>{node.outcome}</p></div>}
    </div>

    <div className="dock">
      <div className="composer">
        {!node.choices.length ? <div className="composer-row">
          <a className="btn" href={href.home}>More conversations</a>
          <a className="btn primary grow" href={href.play(scenario.id)}>Start over</a>
        </div> : choice ? <>
          <div className="composer-head">
            <span className="composer-label">You mean</span>
            <button type="button" className="text-btn" onClick={() => setSelected(null)}>Change</button>
          </div>
          <p className="intent">{choice.en}</p>
          {remaining > 0
            ? <p className="hint-text" role="timer">Say it aloud first — hint in {remaining}s</p>
            : hint ? <LineBlock line={choice} voice="you" pinyin={pinyin} meaning={false} />
            : <button type="button" className="text-btn" onClick={() => setHint(true)}>Show the Mandarin</button>}
          {heard && <p className="hint-text" role="status">Heard “<span lang="zh-CN">{heard[0]}</span>” — {check?.exact ? 'exact text match with the hint.' : check ? 'close to the hint text.' : 'different from the hint; fine if you said it another way.'} Words only, not tones.</p>}
          <div className="composer-row">
            <ListenButton compact label="Check my reply (optional)" onHeard={setHeard} />
            <button type="button" className="btn primary grow" onClick={() => navigate(href.play(scenario.id, [...path, choice.id]))}>Send <Icon name="send" /></button>
          </div>
        </> : <>
          <div className="composer-head">
            <span className="composer-label">{ready ? 'Choose your reply' : 'Listening…'}</span>
            {!ready && <button type="button" className="text-btn" onClick={() => { stopAudio(); setReady(true); }}>Skip audio</button>}
            <button type="button" className="pill small" onClick={() => setSheet('help')}><Icon name="help" /><span>Help</span></button>
          </div>
          <div className="reply-options">{node.choices.map(c => <button type="button" key={c.id} className="reply-option" disabled={!ready} onClick={() => pick(c.id)}>{c.en}</button>)}</div>
        </>}
      </div>
      <StatusBar />
    </div>

    <Sheet open={sheet === 'help'} onClose={() => setSheet(null)} title="Need help?">
      <p className="hint-text">Ask them to repeat, slow down or rephrase. You stay on this turn.</p>
      <div className="list">{repairs.map(r => <button type="button" key={r.id} className="list-row" onClick={() => void askRepair(r)}>
        <span className="list-main"><strong>{r.en}</strong><span lang="zh-CN">{r.zh}</span></span><Icon name="chevron" />
      </button>)}</div>
      <a className="list-row" href={href.find(scenario.id, nodeId)}><span className="list-main"><strong>Heard something else?</strong><span>Find the phrase and ready replies</span></span><Icon name="search" /></a>
    </Sheet>

    <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Conversation settings">
      <div className="list">
        <label className="list-row"><span className="list-main"><strong>Show pinyin</strong></span><input type="checkbox" className="switch" checked={pinyin} onChange={e => setPinyin(e.target.checked)} /></label>
        <label className="list-row"><span className="list-main"><strong>Show English meaning</strong></span><input type="checkbox" className="switch" checked={meaning} onChange={e => setMeaning(e.target.checked)} /></label>
        <label className="list-row"><span className="list-main"><strong>Thinking time</strong><span>Before the reply hint appears</span></span>
          <select value={delay} onChange={e => setDelay(Number(e.target.value))}><option value={0}>Off</option><option value={5}>5 s</option><option value={10}>10 s</option><option value={20}>20 s</option></select></label>
        <a className="list-row" href={href.script(scenario.id)}><span className="list-main"><strong>Full script</strong><span>Every line and where each reply leads</span></span><Icon name="script" /></a>
        {path.length > 0 && <a className="list-row" href={href.play(scenario.id)}><span className="list-main"><strong>Restart conversation</strong></span><Icon name="chevron" /></a>}
      </div>
      <p className="hint-text">{AUDIO_NOTE}</p>
    </Sheet>
  </div>;
}
