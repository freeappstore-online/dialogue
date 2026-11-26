// Prerecorded audio lives at public/audio/zh/<key>.mp3, keyed by who speaks and
// the exact Mandarin text (scripts/generate-audio.py uses the same key).
// Lines contributors' devices generated and the platform verified (dialogue#10) play in
// their place: the same key is the job key in the sets of community-sets.json.
import communitySets from './community-sets.json';

export type Voice = 'them' | 'you';

export function audioKey(voice: Voice, zh: string): string {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(`${voice}:${zh}`)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const audioPath = (voice: Voice, zh: string) => `audio/zh/${audioKey(voice, zh)}.mp3`;

const MANIFEST = 'https://api.freeappstore.online/v1/apps/dialogue/generation/sets';

/** Accepted community audio by job key, from the sets' public manifests (`{artifacts: [{key, url}]}`). */
export function communityUrls(manifests: unknown[]): Map<string, string> {
  const urls = new Map<string, string>();
  for (const m of manifests) {
    const artifacts = (m as { artifacts?: unknown } | null)?.artifacts;
    if (!Array.isArray(artifacts)) continue;
    for (const a of artifacts as { key?: unknown; url?: unknown }[]) {
      if (typeof a?.key === 'string' && typeof a.url === 'string') urls.set(a.key, a.url);
    }
  }
  return urls;
}

// Fetched once per visit. Until it arrives, or when it can't (offline), the bundled MP3s play.
let community = new Map<string, string>();
void Promise.all(Object.values(communitySets as Record<string, string>).map(set =>
  fetch(`${MANIFEST}/${set}/manifest`).then(r => (r.ok ? r.json() : null)).catch(() => null),
)).then(manifests => { community = communityUrls(manifests); });

let current: { player: HTMLAudioElement; done: () => void } | null = null;

/** Stop the playing line. Its playLine promise resolves, as if it had ended. */
export function stopAudio(): void {
  const playing = current;
  current = null;
  playing?.player.pause();
  playing?.done();
}

/**
 * Play one line; resolves when it ends or is stopped. Only one line plays at a time.
 * Community audio that fails to load (offline, withdrawn) falls back to the bundled MP3.
 */
export function playLine(voice: Voice, zh: string, rate = 1): Promise<void> {
  stopAudio();
  const bundled = import.meta.env.BASE_URL + audioPath(voice, zh);
  let src = community.get(audioKey(voice, zh)) ?? bundled;
  const player = new Audio(src);
  player.playbackRate = rate;
  player.preservesPitch = true;
  return new Promise((resolve, reject) => {
    const entry = { player, done: () => resolve() };
    current = entry;
    const finish = (fn: () => void) => { if (current === entry) current = null; fn(); };
    // The error event and play()'s rejection both report a failed source: act once per source
    const failed = (from: string, e: unknown) => {
      if (current !== entry || from !== src) return;
      if (src === bundled) return finish(() => reject(e));
      src = bundled;
      player.src = src;
      player.play().catch(e2 => failed(bundled, e2));
    };
    player.addEventListener('ended', () => finish(resolve), { once: true });
    player.addEventListener('error', () => failed(src, new Error('Audio unavailable')));
    const first = src;
    player.play().catch(e => failed(first, e));
  });
}
