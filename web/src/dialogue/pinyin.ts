// Align a sentence's pinyin to its characters, one syllable per Han character,
// so pinyin can be shown above each character (ruby). Erhua (哪儿 → nǎr) gives
// the whole syllable to the first character and nothing to 儿.

const INITIALS = ['', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'zh', 'ch', 'sh', 'r', 'z', 'c', 's', 'y', 'w'];
const FINALS = ['a', 'o', 'e', 'i', 'u', 'v', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'ang', 'eng', 'ong', 'er', 'ia', 'ie', 'iao', 'iu', 'ian', 'in', 'iang', 'ing', 'iong', 'ua', 'uo', 'uai', 'ui', 'uan', 'un', 'uang', 'ue', 've'];
// A superset of real syllables is enough: the character count constrains the split.
const REGULAR = new Set(INITIALS.flatMap(i => FINALS.filter(f => f !== 'er' || !i).map(f => i + f)));
const SYLLABLES = new Set([...REGULAR, 'ng', 'm', 'hm', 'n']); // plus interjections like 嗯 ńg

const isHan = (ch: string) => /\p{Script=Han}/u.test(ch);
const base = (ch: string) => ch.normalize('NFD')[0].toLowerCase().replace('ü', 'u');

export type Ruby = { text: string; rt?: string };

/** Characters paired with their syllables, or null when the pinyin doesn't line up. */
export function alignPinyin(zh: string, pinyin: string): Ruby[] | null {
  const chars = [...zh];
  const han = chars.filter(isHan);
  // Pinyin words: runs of letters (tone marks included); spaces, punctuation and apostrophes split them.
  const words = pinyin.normalize('NFC').match(/\p{L}+/gu) ?? [];
  const sylls: string[] = [];
  const memo = new Map<string, string[][] | null>();

  // Split one word into syllables consuming han[j...]; returns the per-character syllables.
  const split = (word: string, at: number, j: number): string[][] | null => {
    const k = `${word}|${at}|${j}`;
    if (memo.has(k)) return memo.get(k)!;
    let result: string[][] | null = null;
    if (at === word.length) result = [[]];
    for (let end = Math.min(word.length, at + 6); end > at && !result; end--) {
      const piece = word.slice(at, end);
      const plain = [...piece].map(base).join('');
      if (j < han.length && SYLLABLES.has(plain)) {
        const rest = split(word, end, j + 1);
        if (rest) result = rest.map(r => [piece, ...r]);
      }
      // Erhua: "nǎr" covers 哪儿.
      if (!result && plain.length > 1 && plain.endsWith('r') && plain !== 'er' && REGULAR.has(plain.slice(0, -1)) && han[j + 1] === '儿') {
        const rest = split(word, end, j + 2);
        if (rest) result = rest.map(r => [piece, '', ...r]);
      }
    }
    memo.set(k, result);
    return result;
  };

  for (const word of words) {
    const got = split(word, 0, sylls.length);
    if (!got) return null;
    sylls.push(...got[0]);
  }
  if (sylls.length !== han.length) return null;
  let n = 0;
  return chars.map(ch => (isHan(ch) ? { text: ch, rt: sylls[n++].toLowerCase() } : { text: ch }));
}
