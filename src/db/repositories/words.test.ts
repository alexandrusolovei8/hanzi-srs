import { describe, expect, it } from 'vitest';
import type { WordInput } from '../../domain/word.ts';
import { makeCard } from '../../domain/test-utils/fixtures.ts';
import { setupRepos, unwrap } from '../test-utils/setup.ts';

async function withDeck() {
  const ctx = setupRepos();
  const deck = unwrap(await ctx.repos.decks.create('HSK 1'));
  const input: WordInput = {
    deckId: deck.id,
    hanzi: '你好',
    pinyin: 'nǐ hǎo',
    meaning: 'hello',
    meaningSource: 'user',
  };
  return { ...ctx, deck, input };
}

describe('WordRepository.add', () => {
  it('adds a new word', async () => {
    const { repos, input } = await withDeck();
    const { word, restored } = unwrap(await repos.words.add(input));
    expect(restored).toBe(false);
    expect(await repos.words.getActive(word.id)).toEqual(word);
  });

  it('rejects a duplicate deck + hanzi among active words (after normalization)', async () => {
    const { repos, input } = await withDeck();
    const first = unwrap(await repos.words.add(input));
    const r = await repos.words.add({ ...input, hanzi: ' 你好 ', meaning: 'hi' });
    expect(r).toEqual({ ok: false, error: { kind: 'duplicate', existingId: first.word.id } });
  });

  it('allows the same hanzi in a different deck', async () => {
    const { repos, input } = await withDeck();
    const other = unwrap(await repos.decks.create('Other'));
    unwrap(await repos.words.add(input));
    expect((await repos.words.add({ ...input, deckId: other.id })).ok).toBe(true);
  });

  it('fails for a missing or deleted deck', async () => {
    const { repos, deck, input } = await withDeck();
    expect(await repos.words.add({ ...input, deckId: 'nope' })).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 'nope' },
    });
    unwrap(await repos.decks.softDelete(deck.id));
    expect((await repos.words.add(input)).ok).toBe(false);
  });

  it('returns validation errors without writing', async () => {
    const { db, repos, input } = await withDeck();
    const r = await repos.words.add({ ...input, hanzi: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('validation');
    expect(await db.words.count()).toBe(0);
  });
});

describe('WordRepository restore of a soft-deleted word', () => {
  it('keeps the UUID, clears deletedAt and bumps updatedAt', async () => {
    const { repos, deps, input } = await withDeck();
    const original = unwrap(await repos.words.add(input)).word;

    deps.clock.advance(1_000);
    unwrap(await repos.words.softDelete(original.id));
    expect(await repos.words.getActive(original.id)).toBeUndefined();

    deps.clock.advance(1_000);
    const { word, restored } = unwrap(
      await repos.words.add({ ...input, meaning: 'hi (again)', tags: ['back'] }),
    );

    expect(restored).toBe(true);
    expect(word.id).toBe(original.id);
    expect(word).not.toHaveProperty('deletedAt');
    expect(word.updatedAt).toBe(original.createdAt + 2_000);
    expect(word.createdAt).toBe(original.createdAt);
    expect(word).toMatchObject({ meaning: 'hi (again)', tags: ['back'] });
    expect(await repos.words.getActive(original.id)).toEqual(word);
  });

  it('restores the word cards so review history continues', async () => {
    const { db, repos, deps, input } = await withDeck();
    const { word } = unwrap(await repos.words.add(input));
    const card = makeCard(deps, word.id);
    await repos.cards.addMany([card]);

    unwrap(await repos.words.softDelete(word.id));
    expect(await repos.cards.listByWord(word.id)).toEqual([]);

    unwrap(await repos.words.add(input));
    const cards = await repos.cards.listByWord(word.id);
    expect(cards.map((c) => c.id)).toEqual([card.id]);
    expect(await db.words.count()).toBe(1);
  });
});

describe('WordRepository.update / softDelete / listByDeck', () => {
  it('updates fields and rejects renaming onto an existing active hanzi', async () => {
    const { repos, input } = await withDeck();
    const a = unwrap(await repos.words.add(input)).word;
    const b = unwrap(await repos.words.add({ ...input, hanzi: '谢谢', pinyin: 'xièxie' })).word;

    expect(unwrap(await repos.words.update(a.id, { meaning: 'hey' })).meaning).toBe('hey');
    expect(await repos.words.update(b.id, { hanzi: '你好' })).toEqual({
      ok: false,
      error: { kind: 'duplicate', existingId: a.id },
    });
    expect((await repos.words.update(b.id, { hanzi: 'xyz' })).ok).toBe(false);
    expect(await repos.words.update('nope', { meaning: 'x' })).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 'nope' },
    });
  });

  it('soft-deletes the word with its cards and hides them from listings', async () => {
    const { db, repos, deps, deck, input } = await withDeck();
    const { word } = unwrap(await repos.words.add(input));
    await repos.cards.addMany([makeCard(deps, word.id), makeCard(deps, word.id, 'production')]);

    unwrap(await repos.words.softDelete(word.id));

    expect(await repos.words.listByDeck(deck.id)).toEqual([]);
    expect((await db.cards.toArray()).every((c) => c.deletedAt !== undefined)).toBe(true);
    expect(await repos.words.softDelete(word.id)).toEqual({
      ok: false,
      error: { kind: 'not-found', id: word.id },
    });
  });

  it('lists active words of a deck in creation order', async () => {
    const { repos, deps, deck, input } = await withDeck();
    const first = unwrap(await repos.words.add(input)).word;
    deps.clock.advance(1);
    const second = unwrap(await repos.words.add({ ...input, hanzi: '谢谢' })).word;
    expect((await repos.words.listByDeck(deck.id)).map((w) => w.id)).toEqual([first.id, second.id]);
  });
});
