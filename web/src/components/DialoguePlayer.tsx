import { useEffect, useRef, useState } from 'react';
import { DialogueEngine } from '../dialogue/DialogueEngine';
import { PinyinToggle } from './PinyinToggle';

export function DialoguePlayer() {
  const engine = useRef(new DialogueEngine()).current;
  const [nodeId, setNodeId] = useState(engine.currentId);
  const [pinyin, setPinyin] = useState(() => { try { return localStorage.getItem('dialogue:pinyin') === 'true'; } catch { return false; } });
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [delay, setDelay] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const node = engine.current;
  useEffect(() => { try { localStorage.setItem('dialogue:pinyin', String(pinyin)); } catch { /* preferences are optional */ } }, [pinyin]);
  useEffect(() => {
    setReady(false); setWarning(''); setSelected(null); setHint(false);
    const player = new Audio(`${import.meta.env.BASE_URL}audio/${node.audio}`); audio.current = player;
    let active = true;
    const finish = () => { if (active) setReady(true); };
    const fail = () => { if (active) { setWarning('Audio is unavailable. These are silent, unreviewed fixtures; you can continue without audio.'); finish(); } };
    player.addEventListener('ended', finish); player.addEventListener('error', fail);
    void player.play().catch(fail);
    return () => { active = false; player.pause(); player.removeEventListener('ended', finish); player.removeEventListener('error', fail); audio.current = null; };
  }, [nodeId, node.audio]);
  useEffect(() => {
    if (!remaining) return;
    const timer = window.setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  const restart = () => { engine.restart(); setNodeId(engine.currentId); setSelected(null); setHint(false); };
  const advance = () => { if (!selected) return; engine.advance(selected); setNodeId(engine.currentId); };
  const replay = () => { const player = audio.current; if (!player) return; player.currentTime = 0; setReady(false); void player.play().catch(() => { setReady(true); setWarning('Audio is unavailable. You can continue without audio.'); }); };
  return <div className="dialogue">
    <header className="intro"><span className="eyebrow">MANDARIN · RESTAURANT</span><h1>At the table</h1><p>Practice a short conversation, one reply at a time.</p></header>
    <div className="fixture-notice"><strong>Audio preview unavailable</strong><br />This scenario uses silent, unreviewed audio fixtures. Read and practice aloud at your own pace; no microphone is needed.</div>
    <div className="settings"><PinyinToggle enabled={pinyin} onChange={setPinyin} /><label>Thinking time <select value={delay} onChange={e => setDelay(Number(e.target.value))}><option value={0}>No timer</option><option value={5}>5 seconds</option><option value={10}>10 seconds</option><option value={20}>20 seconds</option></select></label></div>
    <section className="card" aria-live="polite"><div className="card-top"><span className="speaker">WAITER</span><button className="replay" onClick={replay}>▶ Replay audio</button></div><p className="chinese" lang="zh-CN">{node.zh}</p>{pinyin && <p className="pinyin">{node.pinyin}</p>}<p className="translation">{node.en}</p>{warning && <p className="warning" role="status">{warning}</p>}</section>
    {node.choices.length ? <section className="choices"><h2>How would you reply?</h2><p>Choose an intention, then say your reply aloud.</p><div className="choice-list">{node.choices.map(choice => <button key={choice.id} className={'choice ' + (selected === choice.id ? 'selected' : '')} disabled={!ready} aria-pressed={selected === choice.id} onClick={() => { setSelected(choice.id); setHint(false); setRemaining(delay); }}><span>{choice.en}</span><span className="choice-arrow">→</span></button>)}</div>{selected && <div className="reply"><button className="hint-button" onClick={() => setHint(!hint)}>{hint ? 'Hide reply hint' : 'Reveal Mandarin reply hint'}</button>{hint && <div><p lang="zh-CN">{node.choices.find(c => c.id === selected)?.zh}</p>{pinyin && <p className="pinyin">{node.choices.find(c => c.id === selected)?.pinyin}</p>}</div>}<button className="primary" onClick={advance}>Continue →</button></div>}</section> : <section className="ending"><h2>Conversation complete</h2><p>Nice work. Try another path or practice again.</p><button className="primary" onClick={restart}>重新开始 · Start over</button></section>}
    {nodeId !== engine.graph.start && <button className="restart" onClick={restart}>Restart conversation</button>}
  </div>;
}
