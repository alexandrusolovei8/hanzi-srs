import { describe, expect, it } from 'vitest';
import { systemClock, uuid } from './system.ts';

describe('platform implementations', () => {
  it('uuid returns RFC 4122 v4 ids', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid()).not.toBe(uuid());
  });

  it('systemClock returns the current epoch ms', () => {
    const before = Date.now();
    const now = systemClock.now();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
