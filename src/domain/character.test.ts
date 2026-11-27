import { describe, expect, it } from 'vitest';
import { deriveCharacters } from './character.ts';
import { fakeDeps } from './test-utils/fakes.ts';
import { createWord, type Word } from './word.ts';

function words(...entries: [hanzi: string, pinyin: string][]): Word[] {
  const deps = fakeDeps();
  return entries.map(([hanzi, pinyin]) => {
    const r = createWord(deps, { deckId: 'd', hanzi, pinyin, meaning: '', meaningSource: 'user' });
    if (!r.ok) throw new Error(`bad fixture ${hanzi}`);
    return r.value;
  });
}

describe('deriveCharacters', () => {
  it('splits words into characters with aligned pinyin, merged and sorted', () => {
    const result = deriveCharacters(words(['你好', 'nǐ hǎo'], ['好人', 'Hǎo rén']));
    expect(result).toEqual([
      { hanzi: '人', pinyin: ['rén'], inStrokeData: false },
      { hanzi: '你', pinyin: ['nǐ'], inStrokeData: false },
      { hanzi: '好', pinyin: ['hǎo'], inStrokeData: false },
    ]);
  });

  it('collects multiple readings of the same character', () => {
    const result = deriveCharacters(words(['长', 'cháng'], ['长', 'zhǎng']));
    expect(result).toEqual([{ hanzi: '长', pinyin: ['cháng', 'zhǎng'], inStrokeData: false }]);
  });

  it('skips pinyin when syllables do not align with characters', () => {
    const result = deriveCharacters(words(['你好', 'nihao']));
    expect(result.map((c) => c.pinyin)).toEqual([[], []]);
  });

  it('ignores non-Han characters and soft-deleted words', () => {
    const [kept, removed] = words(['A你', 'nǐ'], ['我', 'wǒ']);
    if (!kept || !removed) throw new Error('fixture');
    const result = deriveCharacters([kept, { ...removed, deletedAt: 1 }]);
    expect(result).toEqual([{ hanzi: '你', pinyin: ['nǐ'], inStrokeData: false }]);
  });

  it('handles characters outside the Basic Multilingual Plane', () => {
    const result = deriveCharacters(words(['𠮷', 'jí']));
    expect(result).toEqual([{ hanzi: '𠮷', pinyin: ['jí'], inStrokeData: false }]);
  });
});
