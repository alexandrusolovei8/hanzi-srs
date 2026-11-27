import { describe, expect, it } from 'vitest';
import { isDeleted, newEntityBase, restore, softDelete, touch, type EntityBase } from './entity.ts';
import { fakeDeps } from './test-utils/fakes.ts';

interface Note extends EntityBase {
  readonly text: string;
}

function makeNote() {
  const deps = fakeDeps();
  const note: Note = { ...newEntityBase(deps), text: 'hello' };
  return { deps, note };
}

describe('newEntityBase', () => {
  it('uses the injected id generator and clock', () => {
    const { deps, note } = makeNote();
    expect(note.id).toBe('id-1');
    expect(note.createdAt).toBe(deps.clock.now());
    expect(note.updatedAt).toBe(note.createdAt);
    expect(note).not.toHaveProperty('deletedAt');
    expect(isDeleted(note)).toBe(false);
  });
});

describe('touch', () => {
  it('applies changes and bumps updatedAt without touching identity', () => {
    const { deps, note } = makeNote();
    deps.clock.advance(1000);
    const edited = touch(note, deps.clock, { text: 'bye' });
    expect(edited).toEqual({ ...note, text: 'bye', updatedAt: note.createdAt + 1000 });
    expect(note.text).toBe('hello'); // original is not mutated
  });

  it('bumps updatedAt even without changes', () => {
    const { deps, note } = makeNote();
    deps.clock.advance(5);
    expect(touch(note, deps.clock).updatedAt).toBe(note.updatedAt + 5);
  });
});

describe('softDelete / restore', () => {
  it('softDelete sets deletedAt and updatedAt to now', () => {
    const { deps, note } = makeNote();
    deps.clock.advance(10);
    const deleted = softDelete(note, deps.clock);
    expect(isDeleted(deleted)).toBe(true);
    expect(deleted.deletedAt).toBe(note.createdAt + 10);
    expect(deleted.updatedAt).toBe(note.createdAt + 10);
    expect(isDeleted(note)).toBe(false);
  });

  it('restore keeps the id, removes deletedAt and bumps updatedAt', () => {
    const { deps, note } = makeNote();
    deps.clock.advance(10);
    const deleted = softDelete(note, deps.clock);
    deps.clock.advance(10);
    const restored = restore(deleted, deps.clock);
    expect(restored.id).toBe(note.id);
    expect(restored).not.toHaveProperty('deletedAt');
    expect(restored.updatedAt).toBe(note.createdAt + 20);
    expect(restored.createdAt).toBe(note.createdAt);
    expect(restored.text).toBe('hello');
  });
});
