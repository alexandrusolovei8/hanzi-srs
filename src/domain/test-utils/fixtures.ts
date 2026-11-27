import { CardState, Grade, type Card, type CardKind, type ReviewLog } from '../card.ts';
import { newEntityBase, type EntityDeps } from '../entity.ts';

/** A brand-new card (FSRS "New" state, due now). Test-only until card generation lands in M4. */
export function makeCard(
  deps: EntityDeps,
  wordId: string,
  kind: CardKind = 'recognition',
  overrides: Partial<Card> = {},
): Card {
  const base = newEntityBase(deps);
  return {
    ...base,
    wordId,
    kind,
    dueAt: base.createdAt,
    stability: 0,
    stabilityFast: 0,
    difficulty: 0,
    scheduledDays: 0,
    learningStep: 0,
    reps: 0,
    lapses: 0,
    state: CardState.New,
    ...overrides,
  };
}

export function makeReviewLog(
  deps: EntityDeps,
  card: Card,
  overrides: Partial<ReviewLog> = {},
): ReviewLog {
  const base = newEntityBase(deps);
  return {
    ...base,
    cardId: card.id,
    rating: Grade.Good,
    reviewedAt: base.createdAt,
    durationMs: 4200,
    fsrs: {
      dueAt: card.dueAt,
      stability: card.stability,
      stabilityFast: card.stabilityFast,
      difficulty: card.difficulty,
      scheduledDays: card.scheduledDays,
      learningStep: card.learningStep,
      state: card.state,
    },
    ...overrides,
  };
}
