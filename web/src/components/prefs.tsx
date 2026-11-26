import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Line } from '../dialogue/model';
import { alignPinyin } from '../dialogue/pinyin';

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
};
export const DEFAULT_DISPLAY: Display = { pinyin: 'above', meaning: true, size: 'm', bold: false, playThem: true, playYou: true, autoplay: true, delay: 0 };
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

/** Mandarin text with pinyin above each character (ruby), below, or hidden — per the preferences. */
export function Zh({ line, className = '' }: { line: Line; className?: string }) {
  const [{ pinyin }] = useDisplay();
  const ruby = pinyin === 'above' ? alignPinyin(line.zh, line.pinyin) : null;
  return <>
    {pinyin === 'above' && !ruby && <span className="pinyin-line">{line.pinyin}</span>}
    <span className={`zh ${className}`} lang="zh-CN">
      {ruby ? ruby.map((r, i) => (r.rt === undefined ? <span key={i}>{r.text}</span> : <ruby key={i}>{r.text}<rt>{r.rt}</rt></ruby>)) : line.zh}
    </span>
    {pinyin === 'below' && <span className="pinyin-line">{line.pinyin}</span>}
  </>;
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, ReactNode, string][]; onChange: (v: T) => void }) {
  return <div className="list-row setting">
    <span className="list-main"><strong id={`seg-${label}`}>{label}</strong></span>
    <div className="segmented" role="radiogroup" aria-labelledby={`seg-${label}`}>
      {options.map(([v, text, aria]) => <button key={v} type="button" role="radio" aria-checked={value === v} aria-label={aria} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{text}</button>)}
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
  return <>
    <div className="preview" aria-label="Preview">
      <Zh line={SAMPLE} className="preview-zh" />
      {d.meaning && <span className="meaning">{SAMPLE.en}</span>}
    </div>
    <div className="list">
      <Segmented label="Pinyin" value={d.pinyin} onChange={pinyin => set({ pinyin })} options={[['above', 'Above', 'Pinyin above characters'], ['below', 'Below', 'Pinyin below'], ['off', 'Off', 'No pinyin']]} />
      <Segmented label="Character size" value={d.size} onChange={size => set({ size })} options={[['s', <span className="seg-zh s">字</span>, 'Small'], ['m', <span className="seg-zh m">字</span>, 'Medium'], ['l', <span className="seg-zh l">字</span>, 'Large'], ['xl', <span className="seg-zh xl">字</span>, 'Extra large']]} />
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
