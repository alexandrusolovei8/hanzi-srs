import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { createDb, type HanziDb, type OpenDbOptions } from '../database.ts';

/**
 * A database backed by an in-memory fake IndexedDB. Each call gets a fresh, isolated factory
 * unless `indexedDB` is passed — reuse it to reopen the same database (e.g. with a newer schema).
 */
export function createTestDb(
  options: Omit<OpenDbOptions, 'dexieOptions'> & { indexedDB?: IDBFactory } = {},
): { db: HanziDb; indexedDB: IDBFactory } {
  const { indexedDB = new IDBFactory(), ...rest } = options;
  const db = createDb({ ...rest, dexieOptions: { indexedDB, IDBKeyRange } });
  return { db, indexedDB };
}
