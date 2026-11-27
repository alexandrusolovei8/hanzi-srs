import { describe, expect, it } from 'vitest';
import { checkPinyin, parsePinyin, samePinyin } from './pinyin.ts';

describe('parsePinyin', () => {
  it('records tone marks on the vowel and tone numbers on the last letter', () => {
    expect(parsePinyin('nǐ hǎo')).toEqual({
      letters: 'nihao',
      tones: [
        { index: 1, tone: 3 },
        { index: 3, tone: 3 },
      ],
    });
    expect(parsePinyin('ni3 hao3')).toEqual({
      letters: 'nihao',
      tones: [
        { index: 1, tone: 3 },
        { index: 4, tone: 3 },
      ],
    });
  });

  it('lowercases, drops separators and maps ü / u: / v to v', () => {
    expect(parsePinyin("Xī'ān").letters).toBe('xian');
    expect(parsePinyin('nǚ').letters).toBe('nv');
    expect(parsePinyin('nü3').letters).toBe('nv');
    expect(parsePinyin('nu:3').letters).toBe('nv');
    expect(parsePinyin('lv4').letters).toBe('lv');
  });

  it('ignores neutral-tone numbers and keeps unknown characters as letters', () => {
    expect(parsePinyin('ma5 ma0')).toEqual({ letters: 'mama', tones: [] });
    expect(parsePinyin('3ni')).toEqual({ letters: 'ni', tones: [] });
    expect(parsePinyin('你').letters).toBe('你');
  });

  it('handles decomposed (NFD) input', () => {
    expect(parsePinyin('nǐ'.normalize('NFD'))).toEqual(parsePinyin('nǐ'));
  });
});

describe('samePinyin', () => {
  it('ignores case, spacing and notation', () => {
    expect(samePinyin('Nǐ Hǎo', 'ni3hao3')).toBe(true);
    expect(samePinyin('nǐhǎo', 'nǐ hǎo')).toBe(true);
  });

  it('detects different tones or syllables', () => {
    expect(samePinyin('nǐ hǎo', 'ní hǎo')).toBe(false);
    expect(samePinyin('nǐ hǎo', 'nǐ')).toBe(false);
    expect(samePinyin('nǐ hǎo', 'nǐ hao')).toBe(false);
  });
});

describe('checkPinyin', () => {
  const nihao = [['nǐ', 'hǎo']];

  it('matches regardless of format', () => {
    expect(checkPinyin('nǐ hǎo', nihao)).toBe('match');
    expect(checkPinyin('NI3HAO3', nihao)).toBe('match');
  });

  it('reports pinyin without any tones', () => {
    expect(checkPinyin('ni hao', nihao)).toBe('no-tones');
  });

  it('reports a wrong tone', () => {
    expect(checkPinyin('nǐ hào', nihao)).toBe('mismatch');
  });

  it('reports a missing tone on the first syllable', () => {
    expect(checkPinyin('ni hǎo', nihao)).toBe('mismatch');
  });

  it('accepts a neutral tone on a later syllable (textbook style)', () => {
    expect(checkPinyin('xièxie', [['xiè', 'xiè']])).toBe('match');
  });

  it('reports pinyin of another word and an omitted syllable', () => {
    expect(checkPinyin('xiè xie', nihao)).toBe('mismatch');
    expect(checkPinyin('nǐ', nihao)).toBe('mismatch');
    expect(checkPinyin('ni', nihao)).toBe('mismatch');
  });

  it('accepts any of several readings (tone sandhi variants)', () => {
    const bushi = [
      ['bú', 'shì'],
      ['bù', 'shì'],
    ];
    expect(checkPinyin('bú shì', bushi)).toBe('match');
    expect(checkPinyin('bù shì', bushi)).toBe('match');
    expect(checkPinyin('bǔ shì', bushi)).toBe('mismatch');
  });

  it('rejects two tones within one syllable', () => {
    expect(checkPinyin('nǐ3 hǎo', nihao)).toBe('mismatch');
  });

  it('rejects a tone where the reading has a neutral tone', () => {
    expect(checkPinyin('lè', [['le']])).toBe('mismatch');
  });

  it('accepts a toneless reading when the word itself is neutral', () => {
    expect(checkPinyin('le', [['le'], ['liǎo']])).toBe('match');
  });
});
