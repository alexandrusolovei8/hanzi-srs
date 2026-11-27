import { describe, expect, it } from 'vitest';
import { fakeDeps } from '../domain/test-utils/fakes.ts';
import { makeCard } from '../domain/test-utils/fixtures.ts';
import { createRepositories } from './repositories/index.ts';
import { DB_VERSIONS, type DbVersion } from './schema.ts';
import { createTestDb } from './test-utils/testDb.ts';
import { unwrap } from './test-utils/setup.ts';

/** Dummy v2 (test-only): adds an indexed `searchKey` to words, computed for existing rows. */
const dummyV2: DbVersion = {
  version: 2,
  stores: { words: 'id, deckId, [deckId+hanzi], updatedAt, searchKey' },
  upgrade: async (tx) => {
    await tx
      .table<{ hanzi: string; pinyin: string; searchKey?: string }>('words')
      .toCollection()
      .modify((w) => {
        w.searchKey = `${w.hanzi} ${w.pinyin}`.toLowerCase();
      });
  },
};

const failingV2: DbVersion = {
  ...dummyV2,
  upgrade: () => Promise.reject(new Error('upgrade bug')),
};

/** Creates a v1 database with data, closes it, and returns its (fake) IndexedDB factory. */
async function v1DatabaseWithData() {
  const { db, indexedDB } = createTestDb();
  const deps = fakeDeps();
  const repos = createRepositories(db, deps);
  const deck = unwrap(await repos.decks.create('HSK'));
  const base = { deckId: deck.id, meaning: '', meaningSource: 'user' as const };
  const word = unwrap(await repos.words.add({ ...base, hanzi: '你好', pinyin: 'Nǐ Hǎo' })).word;
  await repos.cards.addMany([makeCard(deps, word.id)]);
  const snapshot = {
    decks: await db.decks.toArray(),
    words: await db.words.toArray(),
    cards: await db.cards.toArray(),
  };
  expect(db.verno).toBe(1);
  db.close();
  return { indexedDB, snapshot };
}

describe('IndexedDB schema migration (dummy v1 -> v2)', () => {
  it('upgrades existing data on open and keeps everything else intact', async () => {
    const { indexedDB, snapshot } = await v1DatabaseWithData();

    const { db } = createTestDb({ indexedDB, versions: [...DB_VERSIONS, dummyV2] });
    await db.open();

    expect(db.verno).toBe(2);
    const words = await db.words.toArray();
    // Existing row gained the computed field; every other field is untouched.
    expect(words).toEqual(snapshot.words.map((w) => ({ ...w, searchKey: '你好 nǐ hǎo' })));
    expect(await db.words.where('searchKey').equals('你好 nǐ hǎo').count()).toBe(1);
    expect(await db.decks.toArray()).toEqual(snapshot.decks);
    expect(await db.cards.toArray()).toEqual(snapshot.cards);
    db.close();
  });

  it('a failing upgrade aborts: the database stays at v1 with its data', async () => {
    const { indexedDB, snapshot } = await v1DatabaseWithData();

    const broken = createTestDb({ indexedDB, versions: [...DB_VERSIONS, failingV2] }).db;
    await expect(broken.open()).rejects.toThrow(/upgrade bug/);
    broken.close();

    const { db } = createTestDb({ indexedDB });
    await db.open();
    expect(db.verno).toBe(1);
    expect(await db.words.toArray()).toEqual(snapshot.words);
    expect(await db.cards.toArray()).toEqual(snapshot.cards);
    db.close();
  });
});
