import type { EntityDeps } from '../../domain/entity.ts';
import type { HanziDb } from '../database.ts';
import { createCardRepository } from './cards.ts';
import { createCharacterRepository } from './characters.ts';
import { createDeckRepository } from './decks.ts';
import { createImportRepository } from './imports.ts';
import { createReviewLogRepository } from './reviewLogs.ts';
import { createWordRepository } from './words.ts';

export type { RepoError } from './errors.ts';
export type { CommitOptions, CommitSummary, DeckTarget } from './imports.ts';

export function createRepositories(db: HanziDb, deps: EntityDeps) {
  return {
    decks: createDeckRepository(db, deps),
    words: createWordRepository(db, deps),
    cards: createCardRepository(db, deps),
    reviewLogs: createReviewLogRepository(db),
    characters: createCharacterRepository(db),
    imports: createImportRepository(db, deps),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
