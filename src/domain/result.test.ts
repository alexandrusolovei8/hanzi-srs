import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from './result.ts';

function parsePositive(n: number): Result<number, string> {
  return n > 0 ? ok(n) : err('not positive');
}

describe('Result', () => {
  it('ok wraps a value', () => {
    const r = parsePositive(3);
    expect(r).toEqual({ ok: true, value: 3 });
  });

  it('err wraps an error and narrows by `ok`', () => {
    const r = parsePositive(-1);
    if (r.ok) throw new Error('expected failure');
    expect(r.error).toBe('not positive');
  });
});
