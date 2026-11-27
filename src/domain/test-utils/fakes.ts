import type { Clock } from '../clock.ts';
import type { EntityDeps } from '../entity.ts';
import type { IdGenerator } from '../ids.ts';

export interface FakeClock extends Clock {
  advance(ms: number): void;
  set(epochMs: number): void;
}

/** Manually controlled clock for deterministic tests. */
export function fakeClock(start = Date.UTC(2026, 0, 1)): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (epochMs) => {
      current = epochMs;
    },
  };
}

/** Ids like `id-1`, `id-2`, … */
export function sequentialIds(prefix = 'id'): IdGenerator {
  let n = 0;
  return () => `${prefix}-${String(++n)}`;
}

export function fakeDeps(clock: FakeClock = fakeClock()): EntityDeps & { clock: FakeClock } {
  return { clock, newId: sequentialIds() };
}
