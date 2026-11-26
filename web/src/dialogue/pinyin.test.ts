import { describe, expect, it } from 'vitest';
import { phrases, repairs, scenarios } from './catalog';
import type { Line } from './model';
import { alignPinyin, pinyinWords } from './pinyin';

const allLines = (): Line[] => [
  ...scenarios.flatMap(s => Object.values(s.nodes).flatMap(n => [n, ...n.choices, ...(n.variants ?? []), ...(n.rephrase ? [n.rephrase] : [])])),
  ...repairs.flatMap(r => [r, r.response]),
  ...phrases.flatMap(p => [p, ...p.replies]),
];

describe('alignPinyin', () => {
  it('pairs each character with its syllable and leaves punctuation bare', () => {
    expect(alignPinyin('欢迎光临！', 'Huānyíng guānglín!')).toEqual([
      { text: '欢', rt: 'huān' }, { text: '迎', rt: 'yíng' }, { text: '光', rt: 'guāng' }, { text: '临', rt: 'lín' }, { text: '！' },
    ]);
  });

  it('handles erhua, apostrophes and ü', () => {
    expect(alignPinyin('你要去哪儿？', 'Nǐ yào qù nǎr?')!.map(r => r.rt)).toEqual(['nǐ', 'yào', 'qù', 'nǎr', '', undefined]);
    expect(alignPinyin('三十二号', "sānshí'èr hào")!.map(r => r.rt)).toEqual(['sān', 'shí', 'èr', 'hào']);
    expect(alignPinyin('不辣，有一点儿甜。', 'Bú là, yǒu yìdiǎnr tián.')!.map(r => r.rt)).toEqual(['bú', 'là', undefined, 'yǒu', 'yì', 'diǎnr', '', 'tián', undefined]);
    expect(alignPinyin('嗯？您说。', 'Ńg? Nín shuō.')!.map(r => r.rt)).toEqual(['ńg', undefined, 'nín', 'shuō', undefined]);
    expect(alignPinyin('一点儿甜', 'yìdiǎ nr tián')).toBeNull(); // interjections never take erhua
    expect(alignPinyin('红绿灯', 'hónglǜdēng')!.map(r => r.rt)).toEqual(['hóng', 'lǜ', 'dēng']);
  });

  it('returns null when the pinyin does not match the characters', () => {
    expect(alignPinyin('你好', 'Nǐ hǎo ma')).toBeNull();
  });

  it('aligns every line in the app', () => {
    const failed = allLines().filter(l => !alignPinyin(l.zh, l.pinyin)).map(l => `${l.zh} | ${l.pinyin}`);
    expect(failed).toEqual([]);
  });
});

describe('pinyinWords', () => {
  it('groups characters into the words the pinyin spells', () => {
    expect(pinyinWords('欢迎光临！请问几位？', 'Huānyíng guānglín! Qǐngwèn jǐ wèi?')).toEqual(['欢迎', '光临', '请问', '几', '位']);
    expect(pinyinWords('你要去哪儿？', 'Nǐ yào qù nǎr?')).toEqual(['你', '要', '去', '哪儿']);
    expect(pinyinWords('你好', 'Nǐ hǎo ma')).toBeNull();
  });

  it('covers every line, character for character', () => {
    for (const l of allLines()) expect(pinyinWords(l.zh, l.pinyin)!.join('')).toBe([...l.zh].filter(c => /\p{Script=Han}/u.test(c)).join(''));
  });
});
