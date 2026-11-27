import { CSV_COLUMNS, TAG_SEPARATOR } from './csv/csvImporter.ts';
import type { ImportError } from './types.ts';

const COLUMN_LIST = CSV_COLUMNS.join(', ');
const SAVE_AS_UTF8 = 'In Excel use File › Save As › "CSV UTF-8 (Comma delimited)".';

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** User-facing explanation of a file-level import error, saying exactly what to fix. */
export function describeImportError(error: ImportError): string {
  switch (error.kind) {
    case 'not-utf8':
      return `The file is not UTF-8 text, so Chinese characters would be garbled. Nothing was imported. ${SAVE_AS_UTF8}`;
    case 'file-too-large':
      return `The file is ${formatMegabytes(error.bytes)}; the limit is ${formatMegabytes(error.maxBytes)}. Split it into smaller files.`;
    case 'empty':
      return `The file is empty. The first row must be the header (${COLUMN_LIST}), followed by one word per row.`;
    case 'no-rows':
      return 'The file has a header but no words. Add one word per row below the header.';
    case 'too-many-rows':
      return `The file has ${String(error.rows)} rows; the limit is ${String(error.maxRows)}. Split it into smaller files.`;
    case 'unclosed-quote':
      return `A quote (") opened on line ${String(error.line)} is never closed. Close it, or remove it if it is not wrapping a cell.`;
    case 'missing-header':
      return `The first row looks like a word ("${error.firstRow}"), not a header. Insert a header row first, e.g. "${COLUMN_LIST}".`;
    case 'missing-hanzi-column': {
      const found =
        error.found.length > 0 ? `Found: ${error.found.join(', ')}.` : 'No column names found.';
      return `The header has no "hanzi" column, which is required. ${found} Valid columns: ${COLUMN_LIST}.`;
    }
    case 'unknown-column':
      return `Column ${String(error.position)} is named "${error.column}", which is not a valid column. Rename it to one of: ${COLUMN_LIST}, or delete it.`;
    case 'empty-column-name':
      return `Column ${String(error.position)} has no name in the header. Name it (${COLUMN_LIST}) or delete the column.`;
    case 'duplicate-column':
      return `The column "${error.column}" appears more than once in the header. Keep only one.`;
  }
}

/** Short format reminder shown next to the file picker. */
export const FORMAT_HINT = `UTF-8 CSV with a header row: ${COLUMN_LIST} (only hanzi is required). Separate several tags with "${TAG_SEPARATOR}".`;
