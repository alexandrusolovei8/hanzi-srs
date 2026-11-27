import { describe, expect, it } from 'vitest';
import { fakeDeps } from './test-utils/fakes.ts';
import { createWord, updateWord, type WordInput } from './word.ts';

const input: WordInput = {
  deckId: 'deck-1',
  hanzi: ' 你好 ',
  pinyin: ' nǐ hǎo ',
  meaning: ' hello ',
  meaningSource: 'user',
  tags: ['greeting', ' greeting ', '', 'hsk1'],
};

function created() {
  const deps = fakeDeps();
  const r = createWord(deps, input);
  if (!r.ok) throw new Error('setup failed');
  return { deps, word: r.value };
}

describe('createWord', () => {
  it('normalizes fields and dedupes tags', () => {
    const { deps, word } = created();
    expect(word).toEqual({
      id: 'id-1',
      deckId: 'deck-1',
      hanzi: '你好',
      pinyin: 'nǐ hǎo',
      meaning: 'hello',
      meaningSource: 'user',
      tags: ['greeting', 'hsk1'],
      createdAt: deps.clock.now(),
      updatedAt: deps.clock.now(),
    });
  });

  it('applies Unicode NFC so composed and decomposed pinyin are equal', () => {
    const decomposed = 'nǐ'; // n + i + combining caron
    const r = createWord(fakeDeps(), { ...input, pinyin: decomposed });
    expect(r.ok && r.value.pinyin).toBe('nǐ');
  });

  it('defaults tags to an empty list', () => {
    const { tags: _omit, ...withoutTags } = input;
    const r = createWord(fakeDeps(), withoutTags);
    expect(r.ok && r.value.tags).toEqual([]);
  });

  it('reports every invalid field at once', () => {
    const r = createWord(fakeDeps(), { ...input, deckId: ' ', hanzi: '' });
    expect(r).toEqual({
      ok: false,
      error: [
        { field: 'deckId', message: 'Deck is required' },
        { field: 'hanzi', message: 'Hanzi is required' },
      ],
    });
  });

  it('rejects hanzi without any Chinese character', () => {
    const r = createWord(fakeDeps(), { ...input, hanzi: 'hello' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error[0]?.field).toBe('hanzi');
  });

  it('allows empty pinyin and meaning (filled later by enrichment)', () => {
    const r = createWord(fakeDeps(), { ...input, pinyin: '', meaning: '' });
    expect(r.ok).toBe(true);
  });
});

describe('updateWord', () => {
  it('editing the meaning marks it as user-provided', () => {
    const { deps } = created();
    const fromDict = createWord(deps, { ...input, meaningSource: 'cedict' });
    if (!fromDict.ok) throw new Error('setup failed');
    deps.clock.advance(50);
    const r = updateWord(fromDict.value, deps.clock, { meaning: 'hi' });
    if (!r.ok) throw new Error('expected success');
    expect(r.value.meaning).toBe('hi');
    expect(r.value.meaningSource).toBe('user');
    expect(r.value.updatedAt).toBe(fromDict.value.createdAt + 50);
  });

  it('keeps meaningSource when the meaning is unchanged or explicitly set', () => {
    const { deps } = created();
    const fromDict = createWord(deps, { ...input, meaningSource: 'cedict' });
    if (!fromDict.ok) throw new Error('setup failed');
    const sameMeaning = updateWord(fromDict.value, deps.clock, { pinyin: 'ni3 hao3' });
    expect(sameMeaning.ok && sameMeaning.value.meaningSource).toBe('cedict');
    const explicit = updateWord(fromDict.value, deps.clock, {
      meaning: 'hey',
      meaningSource: 'cedict',
    });
    expect(explicit.ok && explicit.value.meaningSource).toBe('cedict');
  });

  it('validates edits and never changes id, deckId or createdAt', () => {
    const { deps, word } = created();
    expect(updateWord(word, deps.clock, { hanzi: 'abc' }).ok).toBe(false);
    const r = updateWord(word, deps.clock, { hanzi: '您好', tags: ['polite'] });
    if (!r.ok) throw new Error('expected success');
    expect(r.value).toMatchObject({
      id: word.id,
      deckId: word.deckId,
      createdAt: word.createdAt,
      hanzi: '您好',
      tags: ['polite'],
    });
  });
});
