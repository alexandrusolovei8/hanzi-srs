import { Dexie, type DexieOptions, type EntityTable } from 'dexie';
import type { Card, ReviewLog } from '../domain/card.ts';
import type { Character } from '../domain/character.ts';
import type { Deck } from '../domain/deck.ts';
import type { Word } from '../domain/word.ts';
import { DB_VERSIONS, type DbVersion } from './schema.ts';

export type HanziDb = Dexie & {
  decks: EntityTable<Deck, 'id'>;
  words: EntityTable<Word, 'id'>;
  cards: EntityTable<Card, 'id'>;
  reviewLogs: EntityTable<ReviewLog, 'id'>;
  characters: EntityTable<Character, 'hanzi'>;
};

export const DEFAULT_DB_NAME = 'hanzi-srs';

export interface OpenDbOptions {
  readonly name?: string;
  /** Override for tests (e.g. adding a dummy v2). Defaults to the shipped versions. */
  readonly versions?: readonly DbVersion[];
  /** Inject `indexedDB` / `IDBKeyRange` (fake-indexeddb in tests). */
  readonly dexieOptions?: DexieOptions;
}

/** Creates the Dexie instance with every schema version registered. Opens lazily on first query. */
export function createDb(options: OpenDbOptions = {}): HanziDb {
  const db = new Dexie(options.name ?? DEFAULT_DB_NAME, options.dexieOptions) as HanziDb;
  for (const v of options.versions ?? DB_VERSIONS) {
    const version = db.version(v.version).stores({ ...v.stores });
    if (v.upgrade) version.upgrade(v.upgrade);
  }
  return db;
}
