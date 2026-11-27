import { Dexie } from 'dexie';
import type { ReviewLog } from '../../domain/card.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import type { HanziDb } from '../database.ts';
import type { RepoError } from './errors.ts';

/**
 * Append-only review history: there are deliberately no update or delete methods,
 * and `append` refuses to overwrite an existing id.
 */
export function createReviewLogRepository(db: HanziDb) {
  return {
    async append(log: ReviewLog): Promise<Result<ReviewLog, RepoError>> {
      try {
        await db.reviewLogs.add(log);
        return ok(log);
      } catch (e) {
        if (e instanceof Dexie.ConstraintError)
          return err({ kind: 'duplicate', existingId: log.id });
        throw e;
      }
    },

    /** Reviews of a card in chronological order. */
    async listByCard(cardId: string): Promise<ReviewLog[]> {
      const logs = await db.reviewLogs.where('cardId').equals(cardId).toArray();
      return logs.sort((a, b) => a.reviewedAt - b.reviewedAt);
    },

    /** Reviews with reviewedAt in [from, to). */
    async listBetween(from: number, to: number): Promise<ReviewLog[]> {
      return db.reviewLogs.where('reviewedAt').between(from, to, true, false).toArray();
    },
  };
}

export type ReviewLogRepository = ReturnType<typeof createReviewLogRepository>;
