import { describe, expect, it } from 'vitest';
import { fakeClock, sequentialIds } from './fakes.ts';

describe('test fakes', () => {
  it('fakeClock only moves when told to', () => {
    const clock = fakeClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
    clock.set(42);
    expect(clock.now()).toBe(42);
  });

  it('sequentialIds yields predictable ids', () => {
    const next = sequentialIds('w');
    expect([next(), next()]).toEqual(['w-1', 'w-2']);
  });
});
