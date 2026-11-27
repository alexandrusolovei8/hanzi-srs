import { describe, expect, it } from 'vitest';
import { CardState, Grade, isCardKind, isCardState, isGrade } from './card.ts';

describe('FSRS enums', () => {
  // These values must match ts-fsrs 6.x (`State`, `Rating`); the M4 adapter relies on it.
  it('CardState mirrors ts-fsrs State', () => {
    expect(CardState).toEqual({ New: 0, Learning: 1, Review: 2, Relearning: 3 });
  });

  it('Grade mirrors ts-fsrs Rating without Manual', () => {
    expect(Grade).toEqual({ Again: 1, Hard: 2, Good: 3, Easy: 4 });
  });
});

describe('type guards', () => {
  it.each([0, 1, 2, 3])('isCardState(%j) is true', (v) => {
    expect(isCardState(v)).toBe(true);
  });
  it.each([-1, 4, '1', null, 1.5])('isCardState(%j) is false', (v) => {
    expect(isCardState(v)).toBe(false);
  });
  it.each([1, 2, 3, 4])('isGrade(%j) is true', (v) => {
    expect(isGrade(v)).toBe(true);
  });
  it.each([0, 5, '3', undefined])('isGrade(%j) is false', (v) => {
    expect(isGrade(v)).toBe(false);
  });
  it('isCardKind accepts only known kinds', () => {
    expect(isCardKind('recognition')).toBe(true);
    expect(isCardKind('production')).toBe(true);
    expect(isCardKind('listening')).toBe(false);
  });
});
