import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, StatusBar } from '@freeappstore/sdk/ui';
import { playLine, stopAudio, type Voice } from '../dialogue/audio';
import type { Line } from '../dialogue/model';
import { ListenError, listenMessage, listenOnce, recognitionCtor } from '../dialogue/speech';
import { pwa } from '../fas-capabilities/pwa';
import { href } from '../route';
import { DisplaySettings, useDisplay, Zh } from './prefs';

/** A device-local preference (localStorage, JSON encoded). */
export function usePref<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw === null ? initial : (JSON.parse(raw) as T); } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* preferences are optional */ } }, [key, value]);
  return [value, setValue];
}

const paths: Record<string, ReactNode> = {
  back: <path d="M15 18l-6-6 6-6" />,
  more: <><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></>,
  play: <path d="M8 5.5v13l10-6.5z" fill="currentColor" />,
  slow: <><circle cx="12" cy="13" r="7" /><path d="M12 9v4l2.5 2M10 3h4" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.2-1.5 2.3M12 17h.01" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  script: <path d="M7 4h10v16H7zM10 8h4M10 12h4M10 16h2" />,
  settings: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg className="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function IconButton({ icon, label, onClick, className = '' }: { icon: keyof typeof paths; label: string; onClick: () => void; className?: string }) {
  return <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} onClick={onClick}><Icon name={icon} /></button>;
}

/** The SDK's accessible Modal, presented as a bottom sheet on phones. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return <Modal open={open} onClose={onClose} title={title}><div className="sheet">{children}</div></Modal>;
}

export function PlayButton({ voice, zh, rate = 1, label = 'Play audio' }: { voice: Voice; zh: string; rate?: number; label?: string }) {
  const [failed, setFailed] = useState(false);
  return <button type="button" className={`icon-btn small ${failed ? 'failed' : ''}`} aria-label={failed ? `${label} (audio unavailable)` : label} title={failed ? 'Audio unavailable' : label}
    onClick={() => { setFailed(false); playLine(voice, zh, rate).catch(() => setFailed(true)); }}><Icon name="play" /></button>;
}

/** A Mandarin line with pinyin, meaning and a play button, as the display settings say. */
export function LineBlock({ line, voice, meaning }: { line: Line; voice: Voice; meaning?: boolean }) {
  const [d] = useDisplay();
  const play = voice === 'them' ? d.playThem : d.playYou;
  return <div className="line">
    <div className="line-zh"><span className="line-text"><Zh line={line} /></span>{play && <PlayButton voice={voice} zh={line.zh} label={`Play: ${line.en}`} />}</div>
    {(meaning ?? d.meaning) && <p className="meaning">{line.en}</p>}
  </div>;
}

/** Opens the display settings from any screen. */
export function SettingsButton() {
  const [open, setOpen] = useState(false);
  return <>
    <IconButton icon="settings" label="Display settings" onClick={() => setOpen(true)} />
    <Sheet open={open} onClose={() => setOpen(false)} title="Display settings"><DisplaySettings /></Sheet>
  </>;
}

export const AUDIO_NOTE = 'Lines are voiced by the Kokoro text-to-speech engine, not recorded by native speakers. Tones and pacing have not been checked, so treat the audio as a guide rather than a pronunciation model. Everything works without sound or a microphone.';

export function AudioChip() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="chip" onClick={() => setOpen(true)}><Icon name="info" /> Synthetic voice · unreviewed</button>
    <Sheet open={open} onClose={() => setOpen(false)} title="About the audio"><p>{AUDIO_NOTE}</p></Sheet>
  </>;
}

/** Top-level screens share a bottom tab bar, with the SDK status bar beneath it. */
export function TabBar({ active }: { active: 'home' | 'find' }) {
  return <div className="dock">
    <nav className="tabbar" aria-label="Sections">
      <a href={href.home} className="tab" aria-current={active === 'home' ? 'page' : undefined}><Icon name="chat" /><span>Practice</span></a>
      <a href={href.find()} className="tab" aria-current={active === 'find' ? 'page' : undefined}><Icon name="search" /><span>Phrases</span></a>
    </nav>
    <StatusBar />
  </div>;
}

export function TopBar({ back, backLabel, title, subtitle, action }: { back: string; backLabel: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="topbar">
    <a className="icon-btn" href={back} aria-label={backLabel} title={backLabel}><Icon name="back" /></a>
    <div className="topbar-title"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
    {action ?? <span className="icon-btn-spacer" />}
  </div>;
}

const CONSENT_KEY = 'dialogue:speech-consent';

/** One deliberate tap listens for one short utterance. Optional; never required. */
export function ListenButton({ label, onHeard, compact = false }: { label: string; onHeard: (alternatives: string[]) => void; compact?: boolean }) {
  const [consented, setConsented] = usePref(CONSENT_KEY, false);
  const [asking, setAsking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const active = useRef<{ cancel: () => void } | null>(null);
  useEffect(() => {
    const removeGuard = pwa.addBusyGuard(() => active.current !== null);
    return () => { removeGuard(); active.current?.cancel(); active.current = null; };
  }, []);
  if (!recognitionCtor()) return compact ? null : <p className="hint-text">Speech matching isn’t available in this browser. Everything else works without it.</p>;
  const listen = () => {
    setAsking(false); setError(''); setListening(true); stopAudio();
    const session = listenOnce();
    active.current = session;
    session.result
      .then(onHeard, (e: unknown) => setError(listenMessage(e instanceof ListenError ? e.code : 'unknown')))
      .finally(() => { if (active.current === session) active.current = null; setListening(false); });
  };
  return <>
    <button type="button" className={`${compact ? 'icon-btn' : 'pill'} ${listening ? 'listening' : ''}`} aria-label={listening ? 'Listening — tap to stop' : label} title={listening ? 'Listening — tap to stop' : label}
      onClick={() => (listening ? active.current?.cancel() : consented ? listen() : setAsking(true))}>
      <Icon name="mic" />{!compact && <span>{listening ? 'Listening… tap to stop' : label}</span>}
    </button>
    <Sheet open={asking} onClose={() => setAsking(false)} title="Use the microphone?">
      <p>Dialogue asks your browser to turn one short phrase into text, then stops. In Chrome and Edge the audio is sent to the browser maker’s speech service; other browsers may process it on the device or on their own servers. Dialogue keeps no audio or transcripts.</p>
      <p><strong>Only listen to someone who knows and agrees.</strong></p>
      {!navigator.onLine && <p className="hint-text">You appear to be offline; most browsers need a connection for speech recognition.</p>}
      <div className="sheet-actions"><button type="button" className="btn" onClick={() => setAsking(false)}>Not now</button><button type="button" className="btn primary" onClick={() => { setConsented(true); listen(); }}>Allow and listen</button></div>
    </Sheet>
    {error && <p className="hint-text warn" role="status">{error}</p>}
  </>;
}
