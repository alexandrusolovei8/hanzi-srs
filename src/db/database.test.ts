import { describe, expect, it } from 'vitest';
import { CURRENT_DB_VERSION, DB_VERSIONS } from './schema.ts';
import { createTestDb } from './test-utils/testDb.ts';

describe('database schema v1', () => {
  it('opens at the current version with all tables', async () => {
    const { db } = createTestDb();
    await db.open();
    expect(db.verno).toBe(CURRENT_DB_VERSION);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      'cards',
      'characters',
      'decks',
      'reviewLogs',
      'words',
    ]);
    db.close();
  });

  it('declares the expected primary keys and indexes', async () => {
    const { db } = createTestDb();
    await db.open();
    const indexes = (table: string) =>
      db
        .table(table)
        .schema.indexes.map((i) => i.name)
        .sort();
    expect(db.characters.schema.primKey.name).toBe('hanzi');
    expect(db.words.schema.primKey.name).toBe('id');
    expect(indexes('words')).toEqual(['[deckId+hanzi]', 'deckId', 'updatedAt']);
    expect(indexes('cards')).toEqual(['dueAt', 'updatedAt', 'wordId']);
    expect(indexes('reviewLogs')).toEqual(['cardId', 'reviewedAt']);
    db.close();
  });

  it('does not make [deckId+hanzi] unique (repository enforces it, allowing restore)', async () => {
    const { db } = createTestDb();
    await db.open();
    const compound = db.words.schema.idxByName['[deckId+hanzi]'];
    expect(compound?.unique).toBeFalsy();
    db.close();
  });

  it('keeps version numbers strictly increasing', () => {
    const numbers = DB_VERSIONS.map((v) => v.version);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
  });
});
