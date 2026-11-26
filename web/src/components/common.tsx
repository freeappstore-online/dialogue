import { useEffect, useRef, useState } from 'react';
import { playLine, stopAudio, type Voice } from '../dialogue/audio';
import type { Line } from '../dialogue/model';
import { ListenError, listenMessage, listenOnce, recognitionCtor } from '../dialogue/speech';
import { pwa } from '../fas-capabilities/pwa';

/** A device-local preference (localStorage, JSON encoded). */
export function usePref<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw === null ? initial : (JSON.parse(raw) as T); } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* preferences are optional */ } }, [key, value]);
  return [value, setValue];
}

export function PlayButton({ voice, zh, rate = 1, label = 'Play audio' }: { voice: Voice; zh: string; rate?: number; label?: string }) {
  const [failed, setFailed] = useState(false);
  return <>
    <button type="button" className="play" aria-label={label} title={label} onClick={() => { setFailed(false); playLine(voice, zh, rate).catch(() => setFailed(true)); }}>▶</button>
    {failed && <span className="warning" role="status"> Audio unavailable</span>}
  </>;
}

export function LineBlock({ line, voice, pinyin = true, meaning = true }: { line: Line; voice: Voice; pinyin?: boolean; meaning?: boolean }) {
  return <div className="line">
    <p className="zh"><span lang="zh-CN">{line.zh}</span> <PlayButton voice={voice} zh={line.zh} label={`Play: ${line.en}`} /></p>
    {pinyin && <p className="pinyin">{line.pinyin}</p>}
    {meaning && <p className="translation">{line.en}</p>}
  </div>;
}

export function AudioNotice({ compact = false }: { compact?: boolean }) {
  if (compact) return <p className="fixture-notice small"><strong>Synthetic, unreviewed audio</strong> — a guide, not a pronunciation model.</p>;
  return <p className="fixture-notice"><strong>Synthetic, unreviewed audio.</strong> Lines are voiced by the Kokoro text-to-speech engine, not recorded by native speakers. Tones and pacing have not been checked, so treat it as a guide rather than a pronunciation model. Everything works without sound or a microphone.</p>;
}

const CONSENT_KEY = 'dialogue:speech-consent';

/** One deliberate tap listens for one short utterance. Optional; never required. */
export function ListenButton({ label, onHeard }: { label: string; onHeard: (alternatives: string[]) => void }) {
  const [consented, setConsented] = usePref(CONSENT_KEY, false);
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<{ cancel: () => void } | null>(null);
  useEffect(() => {
    const removeGuard = pwa.addBusyGuard(() => active.current !== null);
    return () => { removeGuard(); active.current?.cancel(); active.current = null; };
  }, []);
  if (!recognitionCtor()) return <p className="muted small">Speech matching isn’t available in this browser. Everything else works without it.</p>;
  const listen = () => {
    setAsking(false); setError(''); setListening(true); stopAudio();
    const session = listenOnce();
    active.current = session;
    session.result
      .then(onHeard, (e: unknown) => setError(listenMessage(e instanceof ListenError ? e.code : 'unknown')))
      .finally(() => { if (active.current === session) active.current = null; setListening(false); });
  };
  return <div className="listen">
    {listening
      ? <button type="button" className="secondary listening" onClick={() => active.current?.cancel()}>● Listening… tap to stop</button>
      : <button type="button" className="secondary" onClick={() => (consented ? listen() : setAsking(true))}>🎤 {label}</button>}
    {asking && <div className="consent" role="group" aria-label="Microphone consent">
      <p>Dialogue asks your browser to turn one short phrase into text, then stops. In Chrome and Edge the audio is sent to the browser maker’s speech service; other browsers may process it on the device or on their own servers. Dialogue keeps no audio or transcripts. Only listen to someone who knows and agrees.</p>
      <div className="row"><button type="button" className="primary inline" onClick={() => { setConsented(true); listen(); }}>Allow and listen</button><button type="button" className="secondary" onClick={() => setAsking(false)}>Not now</button></div>
    </div>}
    {!navigator.onLine && !listening && <p className="muted small">You appear to be offline; most browsers need a connection for speech recognition.</p>}
    {error && <p className="warning" role="status">{error}</p>}
  </div>;
}
