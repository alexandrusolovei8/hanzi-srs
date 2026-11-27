import { describe, expect, it } from 'vitest';
import { CardState } from '../../domain/card.ts';
import { makeCard } from '../../domain/test-utils/fixtures.ts';
import { setupRepos, unwrap } from '../test-utils/setup.ts';

describe('CardRepository', () => {
  it('lists only active cards due at or before now, earliest first', async () => {
    const { repos, deps } = setupRepos();
    const now = deps.clock.now();
    const late = makeCard(deps, 'w1', 'recognition', { dueAt: now - 10 });
    const early = makeCard(deps, 'w2', 'recognition', { dueAt: now - 100 });
    const future = makeCard(deps, 'w3', 'recognition', { dueAt: now + 1 });
    const deleted = makeCard(deps, 'w4', 'recognition', { dueAt: now - 50, deletedAt: now });
    await repos.cards.addMany([late, early, future, deleted]);

    expect((await repos.cards.listDue(now)).map((c) => c.id)).toEqual([early.id, late.id]);
    expect(await repos.cards.listDue(now, 1)).toHaveLength(1);
  });

  it('updates scheduling fields and bumps updatedAt', async () => {
    const { repos, deps } = setupRepos();
    const card = makeCard(deps, 'w1');
    await repos.cards.addMany([card]);
    deps.clock.advance(60_000);
    const updated = unwrap(
      await repos.cards.updateSchedule(card.id, {
        state: CardState.Learning,
        reps: 1,
        dueAt: deps.clock.now() + 600_000,
        lastReviewAt: deps.clock.now(),
      }),
    );
    expect(updated).toMatchObject({
      id: card.id,
      wordId: 'w1',
      state: CardState.Learning,
      reps: 1,
    });
    expect(updated.updatedAt).toBe(card.createdAt + 60_000);
    expect(await repos.cards.getActive(card.id)).toEqual(updated);
  });

  it('cannot update a missing or deleted card', async () => {
    const { repos, deps } = setupRepos();
    const gone = makeCard(deps, 'w1', 'recognition', { deletedAt: 1 });
    await repos.cards.addMany([gone]);
    expect(await repos.cards.getActive(gone.id)).toBeUndefined();
    expect(await repos.cards.updateSchedule(gone.id, { reps: 2 })).toEqual({
      ok: false,
      error: { kind: 'not-found', id: gone.id },
    });
  });
});
