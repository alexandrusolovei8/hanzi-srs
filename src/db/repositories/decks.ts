import { createDeck, renameDeck, type Deck } from '../../domain/deck.ts';
import { isDeleted, softDelete, type EntityDeps } from '../../domain/entity.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import type { HanziDb } from '../database.ts';
import type { RepoError } from './errors.ts';

export function createDeckRepository(db: HanziDb, deps: EntityDeps) {
  async function getActive(id: string): Promise<Deck | undefined> {
    const deck = await db.decks.get(id);
    return deck && !isDeleted(deck) ? deck : undefined;
  }

  return {
    getActive,

    /** Non-deleted decks sorted by name. */
    async list(): Promise<Deck[]> {
      const decks = await db.decks.filter((d) => !isDeleted(d)).toArray();
      return decks.sort((a, b) => a.name.localeCompare(b.name));
    },

    async create(name: string): Promise<Result<Deck, RepoError>> {
      const deck = createDeck(deps, name);
      if (!deck.ok) return err({ kind: 'validation', errors: [deck.error] });
      await db.decks.add(deck.value);
      return ok(deck.value);
    },

    async rename(id: string, name: string): Promise<Result<Deck, RepoError>> {
      return db.transaction('rw', db.decks, async () => {
        const deck = await getActive(id);
        if (!deck) return err({ kind: 'not-found', id });
        const renamed = renameDeck(deck, deps.clock, name);
        if (!renamed.ok) return err({ kind: 'validation', errors: [renamed.error] });
        await db.decks.put(renamed.value);
        return ok(renamed.value);
      });
    },

    /** Soft-deletes the deck and, atomically, all its words and their cards. */
    async softDelete(id: string): Promise<Result<void, RepoError>> {
      return db.transaction('rw', [db.decks, db.words, db.cards], async () => {
        const deck = await getActive(id);
        if (!deck) return err({ kind: 'not-found', id });
        const words = (await db.words.where('deckId').equals(id).toArray()).filter(
          (w) => !isDeleted(w),
        );
        const cards = (
          await db.cards
            .where('wordId')
            .anyOf(words.map((w) => w.id))
            .toArray()
        ).filter((c) => !isDeleted(c));
        await db.decks.put(softDelete(deck, deps.clock));
        await db.words.bulkPut(words.map((w) => softDelete(w, deps.clock)));
        await db.cards.bulkPut(cards.map((c) => softDelete(c, deps.clock)));
        return ok(undefined);
      });
    },
  };
}

export type DeckRepository = ReturnType<typeof createDeckRepository>;
