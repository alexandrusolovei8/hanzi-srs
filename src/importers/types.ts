import type { Result } from '../domain/result.ts';

/** Upper bounds for untrusted import files. Generous for vocabulary lists, small enough for a phone. */
export const IMPORT_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024,
  maxRows: 5000,
} as const;

/**
 * One data row as read from the source, before enrichment. Optional fields are absent when the
 * column is missing or the cell is empty. `line` is the 1-based line where the row starts.
 */
export interface RawEntry {
  readonly line: number;
  readonly hanzi: string;
  readonly pinyin?: string;
  readonly meaning?: string;
  readonly tags?: readonly string[];
  /** Non-empty cells beyond the header's columns (usually a separator or quoting mistake). */
  readonly extraCells?: number;
}

/** File-level problems: nothing is imported when any of these occur. */
export type ImportError =
  | { readonly kind: 'not-utf8' }
  | { readonly kind: 'file-too-large'; readonly bytes: number; readonly maxBytes: number }
  | { readonly kind: 'empty' }
  | { readonly kind: 'no-rows' }
  | { readonly kind: 'too-many-rows'; readonly rows: number; readonly maxRows: number }
  | { readonly kind: 'unclosed-quote'; readonly line: number }
  | { readonly kind: 'missing-header'; readonly firstRow: string }
  | { readonly kind: 'missing-hanzi-column'; readonly found: readonly string[] }
  | { readonly kind: 'unknown-column'; readonly column: string; readonly position: number }
  | { readonly kind: 'empty-column-name'; readonly position: number }
  | { readonly kind: 'duplicate-column'; readonly column: string };

/** A source format (Strategy pattern). Each importer is registered in `importers/index.ts`. */
export interface Importer {
  readonly id: string;
  parse(input: string): Result<RawEntry[], ImportError[]>;
}
