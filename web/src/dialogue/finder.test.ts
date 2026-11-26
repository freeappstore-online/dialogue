// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { phrases, scenarios } from './catalog';
import { buildEntries, likely, matchTranscripts, normalizePinyin, search } from './finder';
import { ListenError, listenOnce } from './speech';

const entries = buildEntries(scenarios, phrases);
const ctx = { scenarioId: 'directions-subway', nodeId: 'where' };

describe('typed search', () => {
  it('finds by English meaning, Mandarin and toneless pinyin', () => {
    expect(search(entries, 'which exit', ctx)[0].en).toMatch(/which exit/i);
    expect(search(entries, '几号口', ctx)[0].zh).toBe('几号口？');
    expect(search(entries, 'ji hao kou', ctx)[0].zh).toBe('几号口？');
    expect(normalizePinyin('Nǐ yào qù nǎr?')).toBe('niyaoqunar');
  });

  it('finds the moment to say something by matching prepared replies, below direct matches', () => {
    const results = search(entries, 'bill', {});
    expect(results[0].source).toMatchObject({ scenarioId: 'restaurant-bill', nodeId: 'anything-else' });
    expect(search(entries, '买单', {}).some(e => e.source?.nodeId === 'anything-else')).toBe(true);
    const direct = search(entries, 'which exit', ctx);
    expect(direct[0].en).toMatch(/which exit/i);
  });

  it('ranks the current turn first for shared lines', () => {
    const top = search(entries, '你要去哪儿', ctx)[0];
    expect(top.source).toMatchObject({ scenarioId: 'directions-subway', nodeId: 'where' });
  });

  it('shows prepared replies for a common phrase', () => {
    const found = search(entries, "I don't know", {}).find(e => e.zh === '我不知道。')!;
    expect(found.source).toBeUndefined();
    expect(found.replies.length).toBeGreaterThan(0);
  });

  it('suggests the current line and its variants, then common phrases', () => {
    const list = likely(entries, ctx);
    expect(list.slice(0, 4).map(e => e.zh)).toEqual(['你要去哪儿？', '去哪儿？', '你到哪个站？', '你想坐到哪一站？']);
    expect(list.at(-1)!.source).toBeUndefined();
  });
});

describe('speech transcript matching', () => {
  it('puts a normalised exact text match first', () => {
    const [first] = matchTranscripts(entries, ['你要去哪儿'], ctx);
    expect(first.exact).toBe(true);
    expect(first.entry.source?.nodeId).toBe('where');
  });

  it('uses all alternatives and ranks partial matches', () => {
    const matches = matchTranscripts(entries, ['你要去那儿吗', '你要去哪儿啊'], ctx);
    expect(matches[0].exact).toBe(false);
    expect(matches[0].entry.zh).toBe('你要去哪儿？');
    expect(matches.length).toBeGreaterThan(1);
  });

  it('returns several candidates for an ambiguous transcript', () => {
    const matches = matchTranscripts(entries, ['你要去哪个'], {});
    expect(matches.length).toBeGreaterThan(1);
    expect(matches.every(m => !m.exact)).toBe(true);
  });

  it('returns nothing for unrelated speech', () => {
    expect(matchTranscripts(entries, ['今天天气真冷'], ctx)).toEqual([]);
    expect(matchTranscripts(entries, [''], ctx)).toEqual([]);
  });
});

describe('listenOnce', () => {
  afterEach(() => vi.unstubAllGlobals());
  const fake = (behave: (r: Record<string, (e?: unknown) => void>) => void) => {
    class FakeRecognition { onresult = null; onerror = null; onend = null; start() { behave(this as never); } stop() {} abort() {} }
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  };

  it('reports unsupported browsers', async () => {
    await expect(listenOnce().result).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('returns alternatives from one utterance', async () => {
    fake(r => r.onresult({ results: [[{ transcript: '你要去哪儿' }, { transcript: '你要去那儿' }]] }));
    await expect(listenOnce().result).resolves.toEqual(['你要去哪儿', '你要去那儿']);
  });

  it('reports a denied microphone and offline failure', async () => {
    fake(r => r.onerror({ error: 'not-allowed' }));
    await expect(listenOnce().result).rejects.toEqual(new ListenError('not-allowed'));
    fake(r => r.onerror({ error: 'network' }));
    await expect(listenOnce().result).rejects.toMatchObject({ code: 'network' });
  });

  it('treats ending without a result as nothing heard', async () => {
    fake(r => r.onend());
    await expect(listenOnce().result).rejects.toMatchObject({ code: 'no-speech' });
  });
});
