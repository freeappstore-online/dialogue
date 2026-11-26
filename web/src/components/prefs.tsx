import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { playLine, playWords, type Voice } from '../dialogue/audio';
import type { Line } from '../dialogue/model';
import { alignPinyin, pinyinWords } from '../dialogue/pinyin';

export type PinyinMode = 'off' | 'above' | 'below';
export type ZhSize = 's' | 'm' | 'l' | 'xl';
export type Display = {
  pinyin: PinyinMode;
  meaning: boolean;
  size: ZhSize;
  bold: boolean;
  playThem: boolean;
  playYou: boolean;
  autoplay: boolean;
  delay: number;
  /** Playback rate, pitch preserved. */
  speed: number;
  /** Milliseconds of silence between words; 0 plays the whole line as recorded. */
  pause: number;
};
export const DEFAULT_DISPLAY: Display = { pinyin: 'above', meaning: true, size: 'm', bold: false, playThem: true, playYou: true, autoplay: true, delay: 0, speed: 1, pause: 0 };
const KEY = 'dialogue:display';

const Ctx = createContext<[Display, (patch: Partial<Display>) => void]>([DEFAULT_DISPLAY, () => {}]);

/** Device-local display preferences, shared by every screen. */
export function DisplayProvider({ children }: { children: ReactNode }) {
  const [display, setDisplay] = useState<Display>(() => {
    try { return { ...DEFAULT_DISPLAY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULT_DISPLAY; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(display)); } catch { /* preferences are optional */ }
    const root = document.documentElement;
    root.dataset.zhSize = display.size;
    root.dataset.zhWeight = display.bold ? 'bold' : 'regular';
  }, [display]);
  const value = useMemo<[Display, (patch: Partial<Display>) => void]>(() => [display, patch => setDisplay(d => ({ ...d, ...patch }))], [display]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDisplay = () => useContext(Ctx);

/**
 * Play a line as the settings say: at the chosen speed (0.7× of it when `slower`), and word by word with the
 * chosen pause when pauses are on. A line without word clips falls back to the whole recording.
 */
export function useSpeak() {
  const [{ speed, pause }] = useDisplay();
  return useCallback((voice: Voice, line: Line, slower = false): Promise<void> => {
    const rate = speed * (slower ? 0.7 : 1);
    const words = pause ? pinyinWords(line.zh, line.pinyin) : null;
    return words && words.length > 1
      ? playWords(voice, words, rate, pause).catch(() => playLine(voice, line.zh, rate))
      : playLine(voice, line.zh, rate);
  }, [speed, pause]);
}

/** Mandarin text with pinyin above each character (ruby), below, or hidden — per the preferences. */
export function Zh({ line, className = '' }: { line: Line; className?: string }) {
  const [{ pinyin }] = useDisplay();
  const ruby = pinyin === 'above' ? alignPinyin(line.zh, line.pinyin) : null;
  return <>
    {pinyin === 'above' && !ruby && <span className="pinyin-line">{line.pinyin}</span>}
    <span className={`zh ${className}`} lang="zh-CN">
      {/* Punctuation gets an empty pinyin slot so it sits on the characters' line. */}
      {ruby ? ruby.map((r, i) => (r.rt === undefined ? <ruby key={i} className="punct">{r.text}<rt aria-hidden="true">{'\u00a0'}</rt></ruby> : <ruby key={i}>{r.text}<rt>{r.rt}</rt></ruby>)) : line.zh}
    </span>
    {pinyin === 'below' && <span className="pinyin-line">{line.pinyin}</span>}
  </>;
}

function Segmented<T extends string | number>({ label, detail, value, options, onChange }: { label: string; detail?: string; value: T; options: [T, ReactNode, string][]; onChange: (v: T) => void }) {
  const id = useId();
  return <div className="list-row setting">
    <span className="list-main"><strong id={id}>{label}</strong>{detail && <span>{detail}</span>}</span>
    <div className="segmented" role="group" aria-labelledby={id}>
      {options.map(([v, text, aria]) => <button key={String(v)} type="button" aria-pressed={value === v} aria-label={aria} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>)}
    </div>
  </div>;
}

function Toggle({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="list-row"><span className="list-main"><strong>{label}</strong>{detail && <span>{detail}</span>}</span><input type="checkbox" className="switch" checked={checked} onChange={e => onChange(e.target.checked)} /></label>;
}

const SAMPLE: Line = { zh: '你要去哪儿？', pinyin: 'Nǐ yào qù nǎr?', en: 'Where are you going?' };

/** Every display option in one place, with a live preview. */
export function DisplaySettings() {
  const [d, set] = useDisplay();
  const speak = useSpeak();
  return <>
    <div className="preview" aria-label="Preview">
      <Zh line={SAMPLE} className="preview-zh" />
      <button type="button" className="speed-btn" onClick={() => { void speak('them', SAMPLE).catch(() => {}); }}>▶ Hear it</button>
      {d.meaning && <span className="meaning">{SAMPLE.en}</span>}
    </div>
    <div className="list">
      <Segmented label="Pinyin" value={d.pinyin} onChange={pinyin => set({ pinyin })} options={[['above', 'Above', 'Pinyin above characters'], ['below', 'Below', 'Pinyin below'], ['off', 'Off', 'No pinyin']]} />
      <Segmented label="Character size" value={d.size} onChange={size => set({ size })} options={[['s', <span className="seg-zh s">字</span>, 'Small'], ['m', <span className="seg-zh m">字</span>, 'Medium'], ['l', <span className="seg-zh l">字</span>, 'Large'], ['xl', <span className="seg-zh xl">字</span>, 'Extra large']]} />
      <Segmented label="Speed" value={d.speed} onChange={speed => set({ speed })} options={[[0.6, '0.6×', 'Speed 0.6 times'], [0.8, '0.8×', 'Speed 0.8 times'], [1, '1×', 'Normal speed'], [1.2, '1.2×', 'Speed 1.2 times']]} />
      <Segmented label="Pauses between words" detail="Plays each word separately" value={d.pause} onChange={pause => set({ pause })} options={[[0, 'Off', 'No pauses'], [300, 'Short', 'Short pauses'], [600, 'Medium', 'Medium pauses'], [1000, 'Long', 'Long pauses']]} />
      <Toggle label="Bold strokes" detail="Heavier characters, easier to read" checked={d.bold} onChange={bold => set({ bold })} />
      <Toggle label="English meaning" checked={d.meaning} onChange={meaning => set({ meaning })} />
      <Toggle label="Play buttons on their lines" checked={d.playThem} onChange={playThem => set({ playThem })} />
      <Toggle label="Play buttons on my replies" detail="Hear your own reply, before or after sending" checked={d.playYou} onChange={playYou => set({ playYou })} />
      <Toggle label="Auto-play their lines" checked={d.autoplay} onChange={autoplay => set({ autoplay })} />
      <label className="list-row"><span className="list-main"><strong>Thinking time</strong><span>Before the reply hint appears</span></span>
        <select value={d.delay} onChange={e => set({ delay: Number(e.target.value) })}><option value={0}>Off</option><option value={5}>5 s</option><option value={10}>10 s</option><option value={20}>20 s</option></select></label>
    </div>
  </>;
}
