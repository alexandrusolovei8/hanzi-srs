import { describe, expect, it } from 'vitest';
import { createDeck, DECK_NAME_MAX_LENGTH, renameDeck } from './deck.ts';
import { fakeDeps } from './test-utils/fakes.ts';

describe('createDeck', () => {
  it('creates a deck with a trimmed name', () => {
    const deps = fakeDeps();
    const r = createDeck(deps, '  HSK 1  ');
    expect(r).toEqual({
      ok: true,
      value: {
        id: 'id-1',
        name: 'HSK 1',
        createdAt: deps.clock.now(),
        updatedAt: deps.clock.now(),
      },
    });
  });

  it.each(['', '   '])('rejects an empty name (%j)', (name) => {
    const r = createDeck(fakeDeps(), name);
    expect(r).toEqual({ ok: false, error: { field: 'name', message: 'Deck name is required' } });
  });

  it('rejects names longer than the maximum', () => {
    expect(createDeck(fakeDeps(), 'x'.repeat(DECK_NAME_MAX_LENGTH)).ok).toBe(true);
    const r = createDeck(fakeDeps(), 'x'.repeat(DECK_NAME_MAX_LENGTH + 1));
    expect(r.ok).toBe(false);
  });
});

describe('renameDeck', () => {
  it('renames and bumps updatedAt', () => {
    const deps = fakeDeps();
    const created = createDeck(deps, 'Old');
    if (!created.ok) throw new Error('setup failed');
    deps.clock.advance(100);
    const r = renameDeck(created.value, deps.clock, 'New');
    if (!r.ok) throw new Error('expected success');
    expect(r.value.name).toBe('New');
    expect(r.value.id).toBe(created.value.id);
    expect(r.value.updatedAt).toBe(created.value.createdAt + 100);
  });

  it('rejects an invalid new name and leaves the deck untouched', () => {
    const deps = fakeDeps();
    const created = createDeck(deps, 'Old');
    if (!created.ok) throw new Error('setup failed');
    expect(renameDeck(created.value, deps.clock, ' ').ok).toBe(false);
    expect(created.value.name).toBe('Old');
  });
});
