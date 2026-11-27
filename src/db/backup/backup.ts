import { deriveCharacters } from '../../domain/character.ts';
import type { Clock } from '../../domain/clock.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import type { HanziDb } from '../database.ts';
import { BACKUP_SCHEMA_VERSION, type Backup, type BackupError } from './format.ts';
import { migrateBackup } from './migrations.ts';
import { validateBackup } from './validate.ts';

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Consistent snapshot of all user data, read in one transaction. Includes soft-deleted rows
 * (they are part of the sync-ready state). Rows are sorted by id for deterministic output.
 */
export async function exportBackup(db: HanziDb, clock: Clock): Promise<Backup> {
  return db.transaction('r', [db.decks, db.words, db.cards, db.reviewLogs], async () => ({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: clock.now(),
    decks: (await db.decks.toArray()).sort(byId),
    words: (await db.words.toArray()).sort(byId),
    cards: (await db.cards.toArray()).sort(byId),
    reviewLogs: (await db.reviewLogs.toArray()).sort(byId),
  }));
}

export function parseBackupJson(text: string): Result<unknown, BackupError> {
  try {
    return ok(JSON.parse(text));
  } catch (e) {
    return err({ kind: 'invalid-json', message: e instanceof Error ? e.message : String(e) });
  }
}

export interface ImportSummary {
  readonly decks: number;
  readonly words: number;
  readonly cards: number;
  readonly reviewLogs: number;
  readonly characters: number;
}

/**
 * Replaces ALL local data with the backup (SPEC §5: merge is deferred until sync exists).
 * Old backups are migrated to the current format, then validated, before any write; the write is a single transaction, so on any failure
 * IndexedDB rolls back and the previous data stays intact.
 */
export async function importBackup(
  db: HanziDb,
  raw: unknown,
): Promise<Result<ImportSummary, BackupError>> {
  const migrated = migrateBackup(raw);
  if (!migrated.ok) return migrated;

  const validated = validateBackup(migrated.value);
  if (!validated.ok) return err({ kind: 'invalid', issues: validated.error });
  const backup = validated.value;

  try {
    return ok(
      await db.transaction(
        'rw',
        [db.decks, db.words, db.cards, db.reviewLogs, db.characters],
        async () => {
          const strokeFlags = new Map(
            (await db.characters.toArray()).map((c) => [c.hanzi, c.inStrokeData]),
          );
          await Promise.all([
            db.decks.clear(),
            db.words.clear(),
            db.cards.clear(),
            db.reviewLogs.clear(),
            db.characters.clear(),
          ]);
          await db.decks.bulkAdd([...backup.decks]);
          await db.words.bulkAdd([...backup.words]);
          await db.cards.bulkAdd([...backup.cards]);
          await db.reviewLogs.bulkAdd([...backup.reviewLogs]);
          const characters = deriveCharacters(backup.words).map((c) => ({
            ...c,
            inStrokeData: strokeFlags.get(c.hanzi) ?? c.inStrokeData,
          }));
          await db.characters.bulkAdd(characters);
          return {
            decks: backup.decks.length,
            words: backup.words.length,
            cards: backup.cards.length,
            reviewLogs: backup.reviewLogs.length,
            characters: characters.length,
          };
        },
      ),
    );
  } catch (e) {
    return err({ kind: 'write-failed', message: e instanceof Error ? e.message : String(e) });
  }
}
