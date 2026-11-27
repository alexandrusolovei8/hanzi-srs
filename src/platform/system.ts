// Real implementations of domain ports. The only place allowed to read the wall clock or generate UUIDs.
import type { Clock } from '../domain/clock.ts';
import type { EntityDeps } from '../domain/entity.ts';
import type { IdGenerator } from '../domain/ids.ts';

export const systemClock: Clock = { now: () => Date.now() };

export const uuid: IdGenerator = () => crypto.randomUUID();

export const systemDeps: EntityDeps = { clock: systemClock, newId: uuid };
