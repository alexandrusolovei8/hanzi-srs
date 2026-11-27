import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createDb, type HanziDb, type OpenDbOptions } from '../database.ts';

/**
 * A database backed by a fresh in-memory fake IndexedDB. Each call is fully isolated,
 * so tests never share state and need no cleanup between them.
 */
export function createTestDb(options: Omit<OpenDbOptions, 'dexieOptions'> = {}): {
  db: HanziDb;
  indexedDB: IDBFactory;
} {
  const indexedDB = new IDBFactory();
  const db = createDb({ ...options, dexieOptions: { indexedDB, IDBKeyRange } });
  return { db, indexedDB };
}
