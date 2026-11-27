// Card and review-log types aligned with ts-fsrs 6.0.1 (FSRS-7 DefaultScheduler), checked against its
// type definitions without installing it. Differences on purpose: dates are epoch ms (not Date),
// `lastReviewAt` is optional (not null), and `scheduleStatus` is not stored (derived from `state`).
// The ts-fsrs adapter (M4) converts between both shapes. See SPEC.md §5 "FSRS alignment".
import type { EntityBase } from './entity.ts';

export type CardKind = 'recognition' | 'production';
export const CARD_KINDS: readonly CardKind[] = ['recognition', 'production'];

/** Same numeric values as ts-fsrs `State`. */
export const CardState = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const;
export type CardState = (typeof CardState)[keyof typeof CardState];

/** Same numeric values as ts-fsrs `Grade` (Rating without `Manual = 0`). */
export const Grade = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Grade = (typeof Grade)[keyof typeof Grade];

/** FSRS memory/scheduling state of a card (FSRS-7 card fields). */
export interface FsrsCardState {
  readonly dueAt: number;
  readonly lastReviewAt?: number;
  readonly stability: number;
  /** FSRS-7 only: short-term stability component. */
  readonly stabilityFast: number;
  readonly difficulty: number;
  readonly scheduledDays: number;
  readonly learningStep: number;
  readonly state: CardState;
}

export interface Card extends EntityBase, FsrsCardState {
  readonly wordId: string;
  readonly kind: CardKind;
  readonly reps: number;
  readonly lapses: number;
}

/**
 * One review event. Append-only: never updated or deleted (updatedAt === createdAt).
 * `fsrs` is the card's FSRS state *before* the review, which is what ts-fsrs needs to undo it.
 */
export interface ReviewLog extends EntityBase {
  readonly cardId: string;
  readonly rating: Grade;
  readonly reviewedAt: number;
  readonly durationMs: number;
  readonly fsrs: FsrsCardState;
}

export function isCardState(value: unknown): value is CardState {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function isGrade(value: unknown): value is Grade {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function isCardKind(value: unknown): value is CardKind {
  return value === 'recognition' || value === 'production';
}
