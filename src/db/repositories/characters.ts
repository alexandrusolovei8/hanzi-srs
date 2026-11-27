import { deriveCharacters, type Character } from '../../domain/character.ts';
import type { HanziDb } from '../database.ts';

/** Characters are derived data: rebuilt from words, never edited directly. */
export function createCharacterRepository(db: HanziDb) {
  return {
    get(hanzi: string): Promise<Character | undefined> {
      return db.characters.get(hanzi);
    },

    list(): Promise<Character[]> {
      return db.characters.orderBy('hanzi').toArray();
    },

    /**
     * Recomputes the table from all non-deleted words in one transaction.
     * Preserves `inStrokeData` flags already known for characters that still exist.
     */
    async rebuild(): Promise<number> {
      return db.transaction('rw', [db.words, db.characters], async () => {
        const known = new Map((await db.characters.toArray()).map((c) => [c.hanzi, c]));
        const derived = deriveCharacters(await db.words.toArray()).map((c) => ({
          ...c,
          inStrokeData: known.get(c.hanzi)?.inStrokeData ?? c.inStrokeData,
        }));
        await db.characters.clear();
        await db.characters.bulkAdd(derived);
        return derived.length;
      });
    },
  };
}

export type CharacterRepository = ReturnType<typeof createCharacterRepository>;
