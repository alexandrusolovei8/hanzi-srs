import type { Transaction } from 'dexie';

/**
 * One IndexedDB schema version. Versions are append-only: never edit a shipped version,
 * add a new one (with an `upgrade` if existing rows must change). Every new version needs a test.
 *
 * Index syntax (Dexie): first key is the primary key; `[a+b]` is a compound index.
 */
export interface DbVersion {
  readonly version: number;
  readonly stores: Readonly<Record<string, string | null>>;
  readonly upgrade?: (tx: Transaction) => Promise<void>;
}

export const DB_VERSIONS: readonly DbVersion[] = [
  {
    version: 1,
    stores: {
      decks: 'id, updatedAt',
      // [deckId+hanzi] is NOT unique: uniqueness among non-deleted words is enforced by
      // WordRepository so a soft-deleted word can be restored (SPEC §5).
      words: 'id, deckId, [deckId+hanzi], updatedAt',
      cards: 'id, wordId, dueAt, updatedAt',
      reviewLogs: 'id, cardId, reviewedAt',
      characters: 'hanzi',
    },
  },
];

export const CURRENT_DB_VERSION = DB_VERSIONS.reduce((max, v) => Math.max(max, v.version), 0);
