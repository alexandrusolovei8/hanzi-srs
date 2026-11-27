import { isDeleted, type EntityDeps } from '../../domain/entity.ts';
import { candidateChanges, type ImportCandidate } from '../../domain/importCandidate.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import { normalizeText } from '../../domain/validation.ts';
import type { Word } from '../../domain/word.ts';
import type { HanziDb } from '../database.ts';
import { createCharacterRepository } from './characters.ts';
import { createDeckRepository } from './decks.ts';
import type { RepoError } from './errors.ts';
import { createWordRepository } from './words.ts';

/** Import into an existing deck, or create the deck as part of the same transaction. */
export type DeckTarget =
  | { readonly kind: 'existing'; readonly deckId: string }
  | { readonly kind: 'new'; readonly name: string };

export interface CommitOptions {
  /** Update saved words whose pinyin/meaning/tags differ in the file (bumps `updatedAt`). */
  readonly updateChanged: boolean;
}

export interface CommitSummary {
  readonly deckId: string;
  readonly added: number;
  readonly restored: number;
  readonly updated: number;
  /** Already saved: identical, or changed but `updateChanged` was off. */
  readonly skipped: number;
}

/** Thrown inside the transaction to roll it back; carries the Result error out. */
class AbortImport extends Error {
  readonly repoError: RepoError;
  constructor(repoError: RepoError) {
    super('import aborted');
    this.repoError = repoError;
  }
}

function unwrapOrAbort<T>(result: Result<T, RepoError>): T {
  if (!result.ok) throw new AbortImport(result.error);
  return result.value;
}

export function createImportRepository(db: HanziDb, deps: EntityDeps) {
  const decks = createDeckRepository(db, deps);
  const words = createWordRepository(db, deps);
  const characters = createCharacterRepository(db);

  return {
    /** Data the preview needs to classify rows against a deck. */
    async previewContext(deckId: string): Promise<{ existing: Word[]; deletedHanzi: Set<string> }> {
      const all = await db.words.where('deckId').equals(deckId).toArray();
      return {
        existing: all.filter((w) => !isDeleted(w)),
        deletedHanzi: new Set(all.filter(isDeleted).map((w) => w.hanzi)),
      };
    },

    /**
     * Writes the candidates in ONE transaction: all rows are written or none (e.g. a validation
     * failure halfway rolls back earlier rows and a newly created deck).
     * State is re-checked against the database here, not trusted from the preview.
     * Characters are rebuilt in the same transaction.
     */
    async commit(
      target: DeckTarget,
      candidates: readonly ImportCandidate[],
      options: CommitOptions,
    ): Promise<Result<CommitSummary, RepoError>> {
      try {
        const summary = await db.transaction(
          'rw',
          [db.decks, db.words, db.cards, db.characters],
          async () => {
            const deckId =
              target.kind === 'new'
                ? unwrapOrAbort(await decks.create(target.name)).id
                : target.deckId;
            let added = 0;
            let restored = 0;
            let updated = 0;
            let skipped = 0;

            for (const candidate of candidates) {
              const existing = (
                await db.words
                  .where('[deckId+hanzi]')
                  .equals([deckId, normalizeText(candidate.hanzi)])
                  .toArray()
              ).find((w) => !isDeleted(w));

              if (existing) {
                const changes = candidateChanges(existing, candidate);
                if (options.updateChanged && Object.keys(changes).length > 0) {
                  unwrapOrAbort(await words.update(existing.id, changes));
                  updated++;
                } else {
                  skipped++;
                }
                continue;
              }

              const result = unwrapOrAbort(
                await words.add({
                  deckId,
                  hanzi: candidate.hanzi,
                  pinyin: candidate.pinyin,
                  meaning: candidate.meaning,
                  meaningSource: 'user',
                  tags: candidate.tags,
                }),
              );
              if (result.restored) restored++;
              else added++;
            }

            await characters.rebuild();
            return { deckId, added, restored, updated, skipped };
          },
        );
        return ok(summary);
      } catch (error) {
        if (error instanceof AbortImport) return err(error.repoError);
        throw error;
      }
    },
  };
}

export type ImportRepository = ReturnType<typeof createImportRepository>;
