// Reads [[voice, zh, pinyin], ...] on stdin; prints the unique [voice, word] pairs to voice as word clips.
// Uses the app's own aligner, so word audio keys match what the player asks for (audio.ts wordPath).
import { pinyinWords } from '../web/src/dialogue/pinyin.ts';

const input: [string, string, string][] = JSON.parse(await new Response(process.stdin as unknown as ReadableStream).text());
const seen = new Set<string>();
const out: [string, string][] = [];
for (const [voice, zh, pinyin] of input) {
  const words = pinyinWords(zh, pinyin);
  if (!words) throw new Error(`pinyin does not line up: ${zh} | ${pinyin}`);
  for (const word of words) if (!seen.has(`${voice}:${word}`)) { seen.add(`${voice}:${word}`); out.push([voice, word]); }
}
console.log(JSON.stringify(out));
