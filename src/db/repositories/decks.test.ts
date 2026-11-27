import { describe, expect, it } from 'vitest';
import { makeCard } from '../../domain/test-utils/fixtures.ts';
import { setupRepos, unwrap } from '../test-utils/setup.ts';

describe('DeckRepository', () => {
  it('creates, lists (sorted by name) and renames decks', async () => {
    const { repos, deps } = setupRepos();
    const b = unwrap(await repos.decks.create('Zhōng'));
    unwrap(await repos.decks.create('Animals'));
    deps.clock.advance(10);
    const renamed = unwrap(await repos.decks.rename(b.id, 'Basics'));
    expect(renamed.updatedAt).toBe(b.createdAt + 10);
    expect((await repos.decks.list()).map((d) => d.name)).toEqual(['Animals', 'Basics']);
  });

  it('returns validation and not-found errors', async () => {
    const { repos } = setupRepos();
    const created = await repos.decks.create('  ');
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.kind).toBe('validation');

    const deck = unwrap(await repos.decks.create('A'));
    const rename = await repos.decks.rename(deck.id, '');
    expect(!rename.ok && rename.error.kind).toBe('validation');
    expect(await repos.decks.rename('nope', 'B')).toEqual({
      ok: false,
      error: { kind: 'not-found', id: 'nope' },
    });
  });

  it('soft-delete cascades to words and cards atomically', async () => {
    const { db, repos, deps } = setupRepos();
    const deck = unwrap(await repos.decks.create('HSK'));
    const keep = unwrap(await repos.decks.create('Keep'));
    const base = { pinyin: '', meaning: '', meaningSource: 'user' as const };
    const w1 = unwrap(await repos.words.add({ ...base, deckId: deck.id, hanzi: '一' })).word;
    const w2 = unwrap(await repos.words.add({ ...base, deckId: keep.id, hanzi: '二' })).word;
    await repos.cards.addMany([makeCard(deps, w1.id), makeCard(deps, w2.id)]);

    deps.clock.advance(5);
    unwrap(await repos.decks.softDelete(deck.id));

    expect(await repos.decks.getActive(deck.id)).toBeUndefined();
    expect((await repos.decks.list()).map((d) => d.id)).toEqual([keep.id]);
    expect((await db.words.get(w1.id))?.deletedAt).toBe(deps.clock.now());
    expect((await db.words.get(w2.id))?.deletedAt).toBeUndefined();
    expect(await repos.cards.listByWord(w1.id)).toEqual([]);
    expect(await repos.cards.listByWord(w2.id)).toHaveLength(1);
    expect(await repos.decks.softDelete(deck.id)).toEqual({
      ok: false,
      error: { kind: 'not-found', id: deck.id },
    });
  });
});
