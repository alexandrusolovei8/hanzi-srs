import { describe, expect, it } from 'vitest';
import { candidateChanges, changedFields, type ImportCandidate } from './importCandidate.ts';
import { fakeDeps } from './test-utils/fakes.ts';
import { createWord, type Word } from './word.ts';

function existingWord(): Word {
  const word = createWord(fakeDeps(), {
    deckId: 'deck',
    hanzi: '你好',
    pinyin: 'nǐ hǎo',
    meaning: 'hello',
    meaningSource: 'user',
    tags: ['greeting', 'hsk1'],
  });
  if (!word.ok) throw new Error('fixture');
  return word.value;
}

const allProvided = { pinyin: true, meaning: true, tags: true };

function candidate(overrides: Partial<ImportCandidate> = {}): ImportCandidate {
  return {
    hanzi: '你好',
    pinyin: 'nǐ hǎo',
    meaning: 'hello',
    tags: ['greeting', 'hsk1'],
    provided: allProvided,
    ...overrides,
  };
}

describe('changedFields', () => {
  it('is empty for an identical word', () => {
    expect(changedFields(existingWord(), candidate())).toEqual([]);
  });

  it('ignores pinyin notation, meaning whitespace and tag order', () => {
    const c = candidate({ pinyin: 'Ni3Hao3', meaning: ' hello ', tags: ['hsk1', 'greeting'] });
    expect(changedFields(existingWord(), c)).toEqual([]);
  });

  it('lists every changed field', () => {
    const c = candidate({ pinyin: 'ní hǎo', meaning: 'hi', tags: ['greeting'] });
    expect(changedFields(existingWord(), c)).toEqual(['pinyin', 'meaning', 'tags']);
  });

  it('never reports fields the file did not provide', () => {
    const c = candidate({
      pinyin: 'ní hǎo',
      meaning: '',
      tags: [],
      provided: { pinyin: false, meaning: false, tags: false },
    });
    expect(changedFields(existingWord(), c)).toEqual([]);
  });
});

describe('candidateChanges', () => {
  it('builds WordChanges for the changed fields only', () => {
    const c = candidate({ meaning: 'hi', tags: ['new'] });
    expect(candidateChanges(existingWord(), c)).toEqual({ meaning: 'hi', tags: ['new'] });
    expect(candidateChanges(existingWord(), candidate({ pinyin: 'ni2 hao3' }))).toEqual({
      pinyin: 'ni2 hao3',
    });
  });
});
