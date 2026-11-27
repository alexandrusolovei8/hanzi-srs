import { isDeleted, restore, softDelete, type EntityDeps } from '../../domain/entity.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import {
  createWord,
  updateWord,
  type Word,
  type WordChanges,
  type WordInput,
} from '../../domain/word.ts';
import type { HanziDb } from '../database.ts';
import type { RepoError } from './errors.ts';

export interface AddWordResult {
  readonly word: Word;
  /** True if a soft-deleted word with the same deck + hanzi was restored instead of creating a new one. */
  readonly restored: boolean;
}

export function createWordRepository(db: HanziDb, deps: EntityDeps) {
  function findByHanzi(deckId: string, hanzi: string): Promise<Word[]> {
    return db.words.where('[deckId+hanzi]').equals([deckId, hanzi]).toArray();
  }

  async function getActive(id: string): Promise<Word | undefined> {
    const word = await db.words.get(id);
    return word && !isDeleted(word) ? word : undefined;
  }

  return {
    getActive,

    async listByDeck(deckId: string): Promise<Word[]> {
      const words = await db.words.where('deckId').equals(deckId).toArray();
      return words.filter((w) => !isDeleted(w)).sort((a, b) => a.createdAt - b.createdAt);
    },

    /**
     * Adds a word, enforcing uniqueness of deck + hanzi among non-deleted words.
     * If a soft-deleted match exists, it is restored (same id, deletedAt cleared, updatedAt bumped)
     * with the new field values, and its cards are restored too, keeping review history.
     */
    async add(input: WordInput): Promise<Result<AddWordResult, RepoError>> {
      const candidate = createWord(deps, input);
      if (!candidate.ok) return err({ kind: 'validation', errors: candidate.error });
      const word = candidate.value;

      return db.transaction('rw', [db.decks, db.words, db.cards], async () => {
        const deck = await db.decks.get(word.deckId);
        if (!deck || isDeleted(deck)) return err({ kind: 'not-found', id: word.deckId });

        const matches = await findByHanzi(word.deckId, word.hanzi);
        const active = matches.find((w) => !isDeleted(w));
        if (active) return err({ kind: 'duplicate', existingId: active.id });

        const deleted = matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        if (deleted) {
          const restored: Word = {
            ...restore(deleted, deps.clock),
            pinyin: word.pinyin,
            meaning: word.meaning,
            meaningSource: word.meaningSource,
            tags: word.tags,
          };
          const cards = await db.cards.where('wordId').equals(deleted.id).toArray();
          await db.words.put(restored);
          await db.cards.bulkPut(cards.filter(isDeleted).map((c) => restore(c, deps.clock)));
          return ok({ word: restored, restored: true });
        }

        await db.words.add(word);
        return ok({ word, restored: false });
      });
    },

    async update(id: string, changes: WordChanges): Promise<Result<Word, RepoError>> {
      return db.transaction('rw', db.words, async () => {
        const word = await getActive(id);
        if (!word) return err({ kind: 'not-found', id });
        const updated = updateWord(word, deps.clock, changes);
        if (!updated.ok) return err({ kind: 'validation', errors: updated.error });
        if (updated.value.hanzi !== word.hanzi) {
          const clash = (await findByHanzi(word.deckId, updated.value.hanzi)).find(
            (w) => !isDeleted(w),
          );
          if (clash) return err({ kind: 'duplicate', existingId: clash.id });
        }
        await db.words.put(updated.value);
        return ok(updated.value);
      });
    },

    /** Soft-deletes the word and, atomically, its cards. Review logs are kept (append-only). */
    async softDelete(id: string): Promise<Result<void, RepoError>> {
      return db.transaction('rw', [db.words, db.cards], async () => {
        const word = await getActive(id);
        if (!word) return err({ kind: 'not-found', id });
        const cards = await db.cards.where('wordId').equals(id).toArray();
        await db.words.put(softDelete(word, deps.clock));
        await db.cards.bulkPut(
          cards.filter((c) => !isDeleted(c)).map((c) => softDelete(c, deps.clock)),
        );
        return ok(undefined);
      });
    },
  };
}

export type WordRepository = ReturnType<typeof createWordRepository>;
