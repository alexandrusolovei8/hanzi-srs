import type { EntityDeps } from '../../domain/entity.ts';
import type { HanziDb } from '../database.ts';
import { createCardRepository } from './cards.ts';
import { createCharacterRepository } from './characters.ts';
import { createDeckRepository } from './decks.ts';
import { createReviewLogRepository } from './reviewLogs.ts';
import { createWordRepository } from './words.ts';

export type { RepoError } from './errors.ts';

export function createRepositories(db: HanziDb, deps: EntityDeps) {
  return {
    decks: createDeckRepository(db, deps),
    words: createWordRepository(db, deps),
    cards: createCardRepository(db, deps),
    reviewLogs: createReviewLogRepository(db),
    characters: createCharacterRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
