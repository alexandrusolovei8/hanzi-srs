import { describe, expect, it } from 'vitest';
import { hanOnly, pinyinProTool } from './pinyinTool.ts';

describe('hanOnly', () => {
  it('keeps only Chinese characters', () => {
    expect(hanOnly('你好!')).toBe('你好');
    expect(hanOnly('A 你 b')).toBe('你');
    expect(hanOnly('abc')).toBe('');
  });
});

describe('pinyinProTool', () => {
  it('suggests pinyin with tone marks (acceptance: 你好 → nǐ hǎo)', () => {
    expect(pinyinProTool.suggest('你好')).toBe('nǐ hǎo');
    expect(pinyinProTool.suggest('你好!')).toBe('nǐ hǎo');
  });

  it('returns both tone-sandhi variants for 不 and 一', () => {
    expect(pinyinProTool.readings('不是')).toEqual([
      ['bú', 'shì'],
      ['bù', 'shì'],
    ]);
    expect(pinyinProTool.readings('一天')).toEqual([
      ['yì', 'tiān'],
      ['yī', 'tiān'],
    ]);
  });

  it('adds a neutral second syllable for reduplicated characters only', () => {
    expect(pinyinProTool.readings('谢谢')).toEqual([
      ['xiè', 'xiè'],
      ['xiè', 'xie'],
    ]);
    expect(pinyinProTool.readings('学习')).toEqual([['xué', 'xí']]);
  });

  it('returns every reading of a single polyphonic character', () => {
    expect(pinyinProTool.readings('了')).toEqual(
      expect.arrayContaining([['le'], ['liǎo']]) as unknown,
    );
  });

  it('returns no readings without Chinese characters', () => {
    expect(pinyinProTool.readings('hello')).toEqual([]);
  });
});
