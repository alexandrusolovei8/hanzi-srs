import { fakeDeps } from '../../domain/test-utils/fakes.ts';
import { createRepositories } from '../repositories/index.ts';
import { createTestDb } from './testDb.ts';

/** Isolated db + repositories + controllable clock/ids for one test. */
export function setupRepos() {
  const deps = fakeDeps();
  const { db, indexedDB } = createTestDb();
  const repos = createRepositories(db, deps);
  return { db, indexedDB, deps, repos };
}

/** Unwraps a Result in tests, failing loudly with the error. */
export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`Expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}
