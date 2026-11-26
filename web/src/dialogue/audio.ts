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

let current: HTMLAudioElement | null = null;

export function stopAudio(): void {
  current?.pause();
  current = null;
}

/** Play one line; resolves when it ends. Only one line plays at a time. */
export function playLine(voice: Voice, zh: string, rate = 1): Promise<void> {
  stopAudio();
  const player = new Audio(import.meta.env.BASE_URL + audioPath(voice, zh));
  player.playbackRate = rate;
  player.preservesPitch = true;
  current = player;
  return new Promise((resolve, reject) => {
    player.addEventListener('ended', () => resolve(), { once: true });
    player.addEventListener('error', () => reject(new Error('Audio unavailable')), { once: true });
    player.play().catch(reject);
  });
}
