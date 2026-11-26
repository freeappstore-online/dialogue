// Optional one-shot speech-to-text through the browser's Web Speech API.
// It recognises words only: it never measures pronunciation or tones.
type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }>>;
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

export function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export class ListenError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export const listenMessages: Record<string, string> = {
  unsupported: 'This browser has no speech recognition. Search or browse instead.',
  'not-allowed': 'Microphone access was denied. You can allow it in your browser settings, or search and browse instead.',
  'service-not-allowed': 'Speech recognition is turned off in this browser. Search or browse instead.',
  'audio-capture': 'No microphone was found. Search or browse instead.',
  network: 'Speech recognition needs an internet connection in this browser. Search or browse instead — that works offline.',
  'no-speech': 'Nothing was heard. Try again, or search and browse instead.',
  aborted: 'Listening was cancelled.',
};
export const listenMessage = (code: string) => listenMessages[code] ?? 'Speech recognition failed. Search or browse instead.';

/** Listen for one short utterance, then stop. Resolves with the recogniser's alternatives. */
export function listenOnce(lang = 'zh-CN', timeoutMs = 8000): { result: Promise<string[]>; cancel: () => void } {
  const Ctor = recognitionCtor();
  if (!Ctor) return { result: Promise.reject(new ListenError('unsupported')), cancel: () => {} };
  const r = new Ctor();
  r.lang = lang;
  r.continuous = false;
  r.interimResults = false;
  r.maxAlternatives = 5;
  let timer = 0;
  let settled = false;
  const result = new Promise<string[]>((resolve, reject) => {
    const settle = (fn: () => void) => { if (settled) return; settled = true; window.clearTimeout(timer); fn(); };
    r.onresult = e => {
      const first = e.results[0];
      const alternatives = Array.from({ length: first?.length ?? 0 }, (_, i) => first[i].transcript).filter(Boolean);
      settle(() => (alternatives.length ? resolve(alternatives) : reject(new ListenError('no-speech'))));
    };
    r.onerror = e => settle(() => reject(new ListenError(e.error)));
    r.onend = () => settle(() => reject(new ListenError('no-speech')));
    timer = window.setTimeout(() => r.stop(), timeoutMs);
    try { r.start(); } catch { settle(() => reject(new ListenError('unsupported'))); }
  });
  return { result, cancel: () => r.abort() };
}
