import { err, ok, type Result } from '../../domain/result.ts';
import { BACKUP_SCHEMA_VERSION, type BackupError } from './format.ts';

type Json = Record<string, unknown>;

/**
 * Upgrades backup JSON from `from` to `from + 1`. Must be pure: receives a private deep copy and
 * returns the new shape. The runner sets `schemaVersion`, so a migration cannot forget it.
 */
export interface BackupMigration {
  readonly from: number;
  readonly migrate: (data: Json) => Json;
}

/** Shipped migrations, ordered by `from`. Empty while the format is still at v1. */
export const BACKUP_MIGRATIONS: readonly BackupMigration[] = [];

/**
 * Brings an old backup up to `target` by applying each step in order (v1 -> v2 -> … -> target).
 * Rejects backups from a newer app version and gaps in the migration chain.
 * The returned value is still untrusted: validate it afterwards.
 */
export function migrateBackup(
  raw: unknown,
  target: number = BACKUP_SCHEMA_VERSION,
  migrations: readonly BackupMigration[] = BACKUP_MIGRATIONS,
): Result<unknown, BackupError> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return err({ kind: 'invalid', issues: [{ path: '', message: 'expected a JSON object' }] });
  }
  const found = (raw as Json).schemaVersion;
  const unsupported = err({ kind: 'unsupported-version', found, supported: target } as const);
  if (typeof found !== 'number' || !Number.isInteger(found) || found < 1 || found > target) {
    return unsupported;
  }

  // Resolve the whole chain first, so a gap is reported before any step runs.
  const chain: BackupMigration[] = [];
  for (let version = found; version < target; version++) {
    const step = migrations.find((m) => m.from === version);
    if (!step) return unsupported;
    chain.push(step);
  }

  let data: Json = structuredClone(raw as Json);
  for (const step of chain) {
    data = { ...step.migrate(data), schemaVersion: step.from + 1 };
  }
  return ok(data);
}
