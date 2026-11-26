import { useEffect, useState } from 'react';
import { playLine, stopAudio } from '../dialogue/audio';
import { categoryOf, repairs } from '../dialogue/catalog';
import { matchTranscripts } from '../dialogue/finder';
import { applyRepair, nextNode, type Repair, type RepairOutcome, type Scenario } from '../dialogue/model';
import { href, navigate } from '../route';
import { AudioNotice, LineBlock, ListenButton, PlayButton, usePref } from './common';
import { PinyinToggle } from './PinyinToggle';

const isBlocked = (e: unknown) => e instanceof DOMException && e.name === 'NotAllowedError';

export function DialoguePlayer({ scenario, nodeId }: { scenario: Scenario; nodeId: string }) {
  const node = scenario.nodes[nodeId];
  const [pinyin, setPinyin] = usePref('dialogue:pinyin', false);
  const [meaning, setMeaning] = usePref('dialogue:meaning', true);
  const [delay, setDelay] = usePref('dialogue:delay', 0);
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [repair, setRepair] = useState<{ repair: Repair; outcome: RepairOutcome } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [heard, setHeard] = useState<string[] | null>(null);

  useEffect(() => {
    setReady(false); setWarning(''); setSelected(null); setHint(false); setRemaining(0); setRepair(null); setRevealed(false); setHeard(null);
    let active = true;
    playLine('them', node.zh)
      .catch(e => { if (active) setWarning(isBlocked(e) ? 'Tap “Replay” to hear the line.' : 'Audio could not play. Read the line and continue without it.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; stopAudio(); };
  }, [scenario.id, nodeId, node.zh]);

  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  const replay = (rate = 1) => { setWarning(''); playLine('them', node.zh, rate).catch(() => setWarning('Audio could not play. Read the line and continue without it.')); };
  const askRepair = async (r: Repair) => {
    const outcome = applyRepair(node, r);
    setRepair({ repair: r, outcome });
    if (outcome.revealMeaning) setRevealed(true);
    try {
      if (outcome.response) await playLine('them', outcome.response.zh);
      if (outcome.replay) await playLine('them', outcome.replay.zh, outcome.rate);
    } catch { /* the text is on screen */ }
  };
  const choice = node.choices.find(c => c.id === selected);
  const check = choice && heard ? matchTranscripts([{ ...choice, key: choice.id, replies: [] }], heard, {})[0] : undefined;
  const category = categoryOf(scenario);

  return <div className="dialogue">
    <a className="back" href={href.home}>← All conversations</a>
    <header className="intro compact"><span className="eyebrow">MANDARIN · {category.title.toUpperCase()}</span><h1>{scenario.title}</h1><p>{scenario.summary}</p></header>
    <AudioNotice compact />

    <section className="card" aria-live="polite" aria-label={`${node.speaker} says`}>
      <div className="card-top"><span className="speaker">{node.speaker.toUpperCase()}</span><span><button type="button" className="replay" onClick={() => replay()}>▶ Replay</button><button type="button" className="replay" onClick={() => replay(0.7)}>Slower</button></span></div>
      <p className="chinese" lang="zh-CN">{node.zh}</p>
      {pinyin && <p className="pinyin">{node.pinyin}</p>}
      {(meaning || revealed) && <p className="translation">{node.en}</p>}
      {warning && <p className="warning" role="status">{warning}</p>}
      {repair && <div className="repair-result">
        <p className="small"><strong>You:</strong> <span lang="zh-CN">{repair.repair.zh}</span> <span className="pinyin">{repair.repair.pinyin}</span> <PlayButton voice="you" zh={repair.repair.zh} label={`Play: ${repair.repair.en}`} /> — {repair.repair.en}</p>
        {repair.outcome.response && <p className="small"><strong>{node.speaker}:</strong> <span lang="zh-CN">{repair.outcome.response.zh}</span> <span className="pinyin">{repair.outcome.response.pinyin}</span> — {repair.outcome.response.en}</p>}
        {repair.outcome.replay && repair.outcome.replay !== node && <LineBlock line={repair.outcome.replay} voice="them" pinyin={pinyin} meaning={meaning || revealed} />}
        {repair.outcome.revealMeaning && <p className="small">The English meaning is shown above as a learner aid — in real life, they may not be able to translate.</p>}
        {repair.outcome.fallback && <p className="small">{repair.outcome.fallback} <button type="button" className="link" onClick={() => replay(0.7)}>Play it slower</button> <button type="button" className="link" onClick={() => setRevealed(true)}>Show the meaning</button></p>}
        <p className="muted small">Still the same turn — reply when you’re ready.</p>
      </div>}
    </section>

    <details className="help">
      <summary>Need help? Ask them to repeat, slow down or rephrase</summary>
      <div className="repair-list">{repairs.map(r => <button type="button" key={r.id} className="repair" onClick={() => void askRepair(r)}><span>{r.en}</span><span className="muted" lang="zh-CN">{r.zh}</span></button>)}</div>
    </details>
    <a className="finder-link small" href={href.find(scenario.id, nodeId)}>Heard something different? Find the phrase →</a>

    {node.choices.length ? <section className="choices">
      <h2>How would you reply?</h2><p>Choose what you mean, then say your reply aloud.</p>
      <div className="choice-list">{node.choices.map(c => <button type="button" key={c.id} className={'choice ' + (selected === c.id ? 'selected' : '')} disabled={!ready} aria-pressed={selected === c.id} onClick={() => { setSelected(c.id); setHint(false); setHeard(null); setRemaining(delay); }}><span>{c.en}</span><span className="choice-arrow">→</span></button>)}</div>
      {!ready && <p className="muted small">Listening to the line… <button type="button" className="link" onClick={() => { stopAudio(); setReady(true); }}>Skip audio</button></p>}
      {choice && <div className="reply">
        {remaining > 0
          ? <p className="timer" role="timer">Say it aloud first — hint in {remaining}s</p>
          : <button type="button" className="hint-button" aria-expanded={hint} onClick={() => setHint(!hint)}>{hint ? 'Hide reply hint' : 'Reveal Mandarin reply hint'}</button>}
        {hint && <LineBlock line={choice} voice="you" pinyin={pinyin} meaning={false} />}
        <ListenButton label="Check my reply (optional)" onHeard={setHeard} />
        {heard && <p className="small" role="status">Heard: “<span lang="zh-CN">{heard[0]}</span>”. {check?.exact ? 'Exact text match with the hint.' : check ? 'Close to the hint text.' : 'Different from the hint text — fine if you said it another way.'} This compares words only, not pronunciation or tones.</p>}
        <button type="button" className="primary" onClick={() => navigate(href.play(scenario.id, nextNode(scenario, nodeId, choice.id)))}>Continue →</button>
      </div>}
    </section> : <section className="ending">
      <h2>Conversation complete</h2><p>{node.outcome}</p>
      <div className="row"><a className="primary inline" href={href.play(scenario.id)}>重新开始 · Start over</a><a className="secondary" href={href.home}>Other conversations</a><a className="secondary" href={href.script(scenario.id)}>Full script</a></div>
    </section>}
    {nodeId !== scenario.start && node.choices.length > 0 && <a className="restart" href={href.play(scenario.id)}>Restart conversation</a>}
    <div className="settings bottom" aria-label="Practice settings">
      <PinyinToggle enabled={pinyin} onChange={setPinyin} />
      <label className="toggle"><input type="checkbox" checked={meaning} onChange={e => setMeaning(e.target.checked)} /> Show English meaning</label>
      <label>Thinking time <select value={delay} onChange={e => setDelay(Number(e.target.value))}><option value={0}>No timer</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option><option value={20}>20 seconds</option></select></label>
    </div>
  </div>;
}
