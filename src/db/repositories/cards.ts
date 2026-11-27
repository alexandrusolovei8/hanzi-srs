import type { Card } from '../../domain/card.ts';
import { isDeleted, touch, type EntityDeps } from '../../domain/entity.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import type { HanziDb } from '../database.ts';
import type { RepoError } from './errors.ts';

/** Card persistence. Card creation/scheduling logic arrives with the FSRS wrapper in M4. */
export function createCardRepository(db: HanziDb, deps: EntityDeps) {
  return {
    async addMany(cards: readonly Card[]): Promise<void> {
      await db.cards.bulkAdd([...cards]);
    },

    async getActive(id: string): Promise<Card | undefined> {
      const card = await db.cards.get(id);
      return card && !isDeleted(card) ? card : undefined;
    },

    async listByWord(wordId: string): Promise<Card[]> {
      const cards = await db.cards.where('wordId').equals(wordId).toArray();
      return cards.filter((c) => !isDeleted(c));
    },

    /** Non-deleted cards due at or before `now`, earliest first. */
    async listDue(now: number, limit = 100): Promise<Card[]> {
      return db.cards
        .where('dueAt')
        .belowOrEqual(now)
        .filter((c) => !isDeleted(c))
        .limit(limit)
        .toArray();
    },

    /** Replaces the card's scheduling fields (bumps updatedAt). Identity fields cannot change. */
    async updateSchedule(
      id: string,
      changes: Partial<
        Omit<Card, 'id' | 'wordId' | 'kind' | 'createdAt' | 'updatedAt' | 'deletedAt'>
      >,
    ): Promise<Result<Card, RepoError>> {
      return db.transaction('rw', db.cards, async () => {
        const card = await db.cards.get(id);
        if (!card || isDeleted(card)) return err({ kind: 'not-found', id });
        const updated = touch(card, deps.clock, changes);
        await db.cards.put(updated);
        return ok(updated);
      });
    },
  };
}

export type CardRepository = ReturnType<typeof createCardRepository>;
