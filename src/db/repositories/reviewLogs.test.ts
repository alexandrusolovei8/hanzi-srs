import { describe, expect, it } from 'vitest';
import { Grade } from '../../domain/card.ts';
import { makeCard, makeReviewLog } from '../../domain/test-utils/fixtures.ts';
import { setupRepos, unwrap } from '../test-utils/setup.ts';

describe('ReviewLogRepository (append-only)', () => {
  it('appends logs and lists them per card chronologically', async () => {
    const { repos, deps } = setupRepos();
    const card = makeCard(deps, 'w1');
    const t = deps.clock.now();
    const second = makeReviewLog(deps, card, { reviewedAt: t + 2, rating: Grade.Again });
    const first = makeReviewLog(deps, card, { reviewedAt: t + 1 });
    const other = makeReviewLog(deps, makeCard(deps, 'w2'), { reviewedAt: t + 3 });
    for (const log of [second, first, other]) unwrap(await repos.reviewLogs.append(log));

    expect(await repos.reviewLogs.listByCard(card.id)).toEqual([first, second]);
    expect((await repos.reviewLogs.listBetween(t + 1, t + 3)).map((l) => l.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
  });

  it('refuses to overwrite an existing log', async () => {
    const { repos, deps } = setupRepos();
    const log = makeReviewLog(deps, makeCard(deps, 'w1'));
    unwrap(await repos.reviewLogs.append(log));
    const r = await repos.reviewLogs.append({ ...log, rating: Grade.Easy });
    expect(r).toEqual({ ok: false, error: { kind: 'duplicate', existingId: log.id } });
    expect((await repos.reviewLogs.listByCard(log.cardId))[0]?.rating).toBe(Grade.Good);
  });

  it('exposes no update or delete operations', () => {
    const { repos } = setupRepos();
    expect(Object.keys(repos.reviewLogs).sort()).toEqual(['append', 'listBetween', 'listByCard']);
  });
});
