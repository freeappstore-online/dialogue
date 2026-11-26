import type { Line, Phrase, Scenario } from './model';

/** Something another person might say, with the replies prepared for it. */
export type Entry = Line & {
  key: string;
  replies: Line[];
  source?: { scenarioId: string; nodeId: string; title: string };
};
export type Context = { scenarioId?: string; nodeId?: string };
export type Match = { entry: Entry; exact: boolean; score: number };

export function buildEntries(scenarios: Scenario[], phrases: Phrase[]): Entry[] {
  const entries: Entry[] = [];
  for (const s of scenarios) {
    for (const [nodeId, node] of Object.entries(s.nodes)) {
      const source = { scenarioId: s.id, nodeId, title: s.title };
      const lines = [node, ...(node.variants ?? []), ...(node.rephrase ? [node.rephrase] : [])];
      lines.forEach((line, i) => entries.push({ key: `${s.id}/${nodeId}/${i}`, zh: line.zh, pinyin: line.pinyin, en: line.en, replies: node.choices, source }));
    }
  }
  for (const p of phrases) entries.push({ key: `phrase/${p.id}`, zh: p.zh, pinyin: p.pinyin, en: p.en, replies: p.replies });
  return entries;
}

export const normalizeZh = (s: string) => s.replace(/[\p{P}\p{S}\s]/gu, '');
export const normalizePinyin = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

const boost = (e: Entry, ctx: Context) =>
  e.source && e.source.scenarioId === ctx.scenarioId ? (e.source.nodeId === ctx.nodeId ? 2 : 1) : 0;

/** Lines expected at this turn, then the general phrases. */
export function likely(entries: Entry[], ctx: Context): Entry[] {
  const here = entries.filter(e => boost(e, ctx) === 2);
  return [...here, ...entries.filter(e => !e.source)];
}

/** Typed search by English meaning, Mandarin characters or pinyin (tones optional). */
export function search(entries: Entry[], query: string, ctx: Context): Entry[] {
  const zh = normalizeZh(query);
  const py = normalizePinyin(query);
  const en = query.trim().toLowerCase();
  if (!zh && !py) return [];
  const words = en.split(/\s+/).filter(Boolean);
  const scored = entries.map(e => {
    let score = 0;
    const ez = normalizeZh(e.zh);
    const ep = normalizePinyin(e.pinyin);
    const ee = e.en.toLowerCase();
    if (zh && ez.includes(zh)) score = ez === zh ? 3 : 2;
    if (py && ep.includes(py)) score = Math.max(score, ep === py ? 3 : 2);
    if (ee.includes(en)) score = Math.max(score, 2);
    else if (words.every(w => ee.includes(w))) score = Math.max(score, 1);
    return { e, score };
  }).filter(r => r.score > 0);
  scored.sort((a, b) => b.score - a.score || boost(b.e, ctx) - boost(a.e, ctx));
  return scored.map(r => r.e);
}

const bigrams = (s: string) => (s.length < 2 ? [s] : Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
function dice(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  const pool = [...y];
  let hits = 0;
  for (const g of x) {
    const i = pool.indexOf(g);
    if (i >= 0) { hits++; pool.splice(i, 1); }
  }
  return (2 * hits) / (x.length + y.length);
}

export const PARTIAL_THRESHOLD = 0.34;

/**
 * Rank lines against recognised transcripts (all alternatives). An exact text
 * match only means the recogniser produced the same characters — not that the
 * speech was heard with certainty.
 */
export function matchTranscripts(entries: Entry[], transcripts: string[], ctx: Context, limit = 6): Match[] {
  const heard = transcripts.map(normalizeZh).filter(Boolean);
  if (!heard.length) return [];
  const matches: Match[] = [];
  for (const entry of entries) {
    const target = normalizeZh(entry.zh);
    const exact = heard.includes(target);
    const similarity = exact ? 1 : Math.max(...heard.map(h => dice(h, target)));
    if (!exact && similarity < PARTIAL_THRESHOLD) continue;
    matches.push({ entry, exact, score: similarity + 0.05 * boost(entry, ctx) });
  }
  matches.sort((a, b) => Number(b.exact) - Number(a.exact) || b.score - a.score);
  return matches.slice(0, limit);
}
