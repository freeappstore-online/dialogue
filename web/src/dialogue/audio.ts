// Prerecorded audio lives at public/audio/zh/<key>.mp3, keyed by who speaks and
// the exact Mandarin text (scripts/generate-audio.py uses the same key).
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

let current: { player: HTMLAudioElement; done: () => void } | null = null;

/** Stop the playing line. Its playLine promise resolves, as if it had ended. */
export function stopAudio(): void {
  const playing = current;
  current = null;
  playing?.player.pause();
  playing?.done();
}

/** Play one line; resolves when it ends or is stopped. Only one line plays at a time. */
export function playLine(voice: Voice, zh: string, rate = 1): Promise<void> {
  stopAudio();
  const player = new Audio(import.meta.env.BASE_URL + audioPath(voice, zh));
  player.playbackRate = rate;
  player.preservesPitch = true;
  return new Promise((resolve, reject) => {
    const entry = { player, done: () => resolve() };
    current = entry;
    const finish = (fn: () => void) => { if (current === entry) current = null; fn(); };
    player.addEventListener('ended', () => finish(resolve), { once: true });
    player.addEventListener('error', () => finish(() => reject(new Error('Audio unavailable'))), { once: true });
    player.play().catch(e => finish(() => reject(e)));
  });
}
