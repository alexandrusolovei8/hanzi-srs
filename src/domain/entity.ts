import type { Clock } from './clock.ts';
import type { IdGenerator } from './ids.ts';

/**
 * Fields shared by every synced entity. Keeping them on all entities (plus soft delete)
 * lets a future sync layer merge by `updatedAt` without a schema migration.
 */
export interface EntityBase {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly deletedAt?: number;
}

/** Dependencies needed to create or change entities. */
export interface EntityDeps {
  readonly clock: Clock;
  readonly newId: IdGenerator;
}

export function newEntityBase(deps: EntityDeps): EntityBase {
  const now = deps.clock.now();
  return { id: deps.newId(), createdAt: now, updatedAt: now };
}

export function isDeleted(entity: EntityBase): boolean {
  return entity.deletedAt !== undefined;
}

/** Returns a copy with `changes` applied and `updatedAt` bumped. Identity and createdAt never change. */
export function touch<T extends EntityBase>(
  entity: T,
  clock: Clock,
  changes: Partial<Omit<T, keyof EntityBase>> = {},
): T {
  return { ...entity, ...changes, updatedAt: clock.now() };
}

export function softDelete<T extends EntityBase>(entity: T, clock: Clock): T {
  const now = clock.now();
  return { ...entity, deletedAt: now, updatedAt: now };
}

/** Undoes a soft delete: same id, `deletedAt` removed, `updatedAt` bumped. */
export function restore<T extends EntityBase>(entity: T, clock: Clock): T {
  const { deletedAt, ...rest } = entity;
  return { ...rest, updatedAt: clock.now() } as T;
}
