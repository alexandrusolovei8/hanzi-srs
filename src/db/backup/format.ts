import type { Card, ReviewLog } from '../../domain/card.ts';
import type { Deck } from '../../domain/deck.ts';
import type { Word } from '../../domain/word.ts';

/**
 * Version of the backup JSON format (independent of the IndexedDB schema version).
 * Bump it only together with a migration in `migrations.ts`.
 */
export const BACKUP_SCHEMA_VERSION = 1;

/** Backup file contents. Characters are not included: they are derived and rebuilt on import. */
export interface Backup {
  readonly schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  readonly exportedAt: number;
  readonly decks: readonly Deck[];
  readonly words: readonly Word[];
  readonly cards: readonly Card[];
  readonly reviewLogs: readonly ReviewLog[];
}

export interface BackupIssue {
  /** JSON path of the offending value, e.g. `words[3].hanzi`. */
  readonly path: string;
  readonly message: string;
}

export type BackupError =
  | { readonly kind: 'invalid-json'; readonly message: string }
  | { readonly kind: 'unsupported-version'; readonly found: unknown; readonly supported: number }
  | { readonly kind: 'invalid'; readonly issues: readonly BackupIssue[] }
  | { readonly kind: 'write-failed'; readonly message: string };
