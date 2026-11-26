import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./community-sets.json', () => ({ default: { them: 'set-them' } }));

/** A stand-in <audio>: a source whose URL contains "broken" fails to load. */
class FakeAudio extends EventTarget {
  static played: string[] = [];
  static made = 0;
  playbackRate = 1;
  defaultPlaybackRate = 1;
  preservesPitch = false;
  constructor(public src = '') { super(); FakeAudio.made++; }
  play() {
    FakeAudio.played.push(this.src);
    if (this.src.includes('broken')) {
      queueMicrotask(() => this.dispatchEvent(new Event('error')));
      return Promise.reject(new Error('NotSupportedError'));
    }
    queueMicrotask(() => this.dispatchEvent(new Event('ended')));
    return Promise.resolve();
  }
  pause() {}
}

/** Import audio.ts afresh, its set's manifest listing `artifacts(audioKey)`. */
async function load(artifacts: (key: typeof import('./audio').audioKey) => unknown[]) {
  vi.resetModules();
  FakeAudio.played = [];
  vi.stubGlobal('Audio', FakeAudio);
  let manifest: unknown = null;
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(manifest))));
  const { audioKey } = await vi.importActual<typeof import('./audio')>('./audio');
  manifest = { artifacts: artifacts(audioKey) };
  vi.resetModules();
  const audio = await import('./audio');
  expect(fetch).toHaveBeenLastCalledWith('https://api.freeappstore.online/v1/apps/dialogue/generation/sets/set-them/manifest');
  await new Promise(r => setTimeout(r));
  return audio;
}

afterEach(() => vi.unstubAllGlobals());

describe('community audio', () => {
  it('keys accepted artifacts by job key and ignores malformed entries', async () => {
    const { communityUrls } = await load(() => []);
    expect([...communityUrls([{ artifacts: [{ key: 'a', url: 'u' }, { key: 1, url: 'x' }, null] }, null, { nope: 1 }])])
      .toEqual([['a', 'u']]);
  });

  it('plays the accepted community audio instead of the bundled MP3', async () => {
    const { audioPath, playLine } = await load(key => [{ key: key('them', '你好！'), url: 'https://api/a.m4a' }]);
    await playLine('them', '你好！');
    expect(FakeAudio.played).toEqual(['https://api/a.m4a']);
    await playLine('them', '谢谢。');
    expect(FakeAudio.played[1]).toBe(`/${audioPath('them', '谢谢。')}`);
  });

  it('falls back to the bundled MP3 when community audio fails to load (offline)', async () => {
    const { audioPath, playLine } = await load(key => [{ key: key('them', '你好！'), url: 'https://api/broken.m4a' }]);
    await playLine('them', '你好！');
    expect(FakeAudio.played).toEqual(['https://api/broken.m4a', `/${audioPath('them', '你好！')}`]);
  });

  it('reuses one element, unlocks it on the first tap, and old lines never hear new events', async () => {
    const { playLine, unlockAudio, stopAudio } = await load(() => []);
    unlockAudio();
    expect(FakeAudio.played[0]).toMatch(/^data:audio\/wav/);
    FakeAudio.made = 0;
    const first = playLine('them', '你好！');
    stopAudio();
    await first; // a stopped line resolves
    await playLine('you', '好的。');
    await playLine('them', '谢谢。', 0.7);
    expect(FakeAudio.made).toBe(0); // the element from unlockAudio is reused
    expect(FakeAudio.played.filter(src => src.endsWith('.mp3'))).toHaveLength(3);
  });

  it('plays the bundled MP3s when the manifest is unreachable', async () => {
    vi.resetModules();
    FakeAudio.played = [];
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const { audioPath, playLine } = await import('./audio');
    await new Promise(r => setTimeout(r));
    await playLine('you', '好的。');
    expect(FakeAudio.played).toEqual([`/${audioPath('you', '好的。')}`]);
  });
});
