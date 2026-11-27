import { err, ok, type Result } from '../../domain/result.ts';
import { containsHan } from '../../domain/validation.ts';
import { IMPORT_LIMITS, type ImportError, type Importer, type RawEntry } from '../types.ts';
import { detectDelimiter, parseCsv, type CsvRow } from './parseCsv.ts';

export const CSV_COLUMNS = ['hanzi', 'pinyin', 'meaning', 'tags'] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** Separates tags inside the `tags` cell. Not ";" because that is also a CSV separator. */
export const TAG_SEPARATOR = '|';

function isCsvColumn(name: string): name is CsvColumn {
  return (CSV_COLUMNS as readonly string[]).includes(name);
}

function isBlank(row: CsvRow): boolean {
  return row.cells.every((c) => c.trim() === '');
}

/**
 * Maps header cells to known columns. Names are matched ignoring case and surrounding spaces;
 * empty cells at the end (left by Excel) are ignored. Every problem is reported at once.
 */
function readHeader(header: CsvRow): Result<CsvColumn[], ImportError[]> {
  const names = header.cells.map((c) => c.trim().toLowerCase());
  while (names.length > 0 && names[names.length - 1] === '') names.pop();

  if (!names.includes('hanzi')) {
    // A first row with Chinese text is data, not a header: the header row was forgotten.
    if (header.cells.some(containsHan)) {
      return err([{ kind: 'missing-header', firstRow: header.cells.join(', ') }]);
    }
    return err([{ kind: 'missing-hanzi-column', found: names.filter((n) => n !== '') }]);
  }

  const errors: ImportError[] = [];
  const columns: CsvColumn[] = [];
  names.forEach((name, i) => {
    if (name === '') errors.push({ kind: 'empty-column-name', position: i + 1 });
    else if (!isCsvColumn(name))
      errors.push({ kind: 'unknown-column', column: name, position: i + 1 });
    else if (columns.includes(name)) errors.push({ kind: 'duplicate-column', column: name });
    else columns.push(name);
  });
  return errors.length > 0 ? err(errors) : ok(columns);
}

function toEntry(row: CsvRow, columns: readonly CsvColumn[]): RawEntry {
  const entry: { -readonly [K in keyof RawEntry]: RawEntry[K] } = { line: row.line, hanzi: '' };
  columns.forEach((column, i) => {
    const value = (row.cells[i] ?? '').trim();
    if (value === '') return;
    if (column === 'tags') {
      const tags = value
        .split(TAG_SEPARATOR)
        .map((t) => t.trim())
        .filter((t) => t !== '');
      if (tags.length > 0) entry.tags = tags;
    } else {
      entry[column] = value;
    }
  });
  const extraCells = row.cells.slice(columns.length).filter((c) => c.trim() !== '').length;
  if (extraCells > 0) entry.extraCells = extraCells;
  return entry;
}

/**
 * CSV / TSV with a header row: `hanzi` (required), `pinyin`, `meaning`, `tags` in any order.
 * The separator (",", ";" or tab) is detected from the header. See docs/import-format.md.
 */
export const csvImporter: Importer = {
  id: 'csv',

  parse(input) {
    const text = input.startsWith('﻿') ? input.slice(1) : input;
    if (text.trim() === '') return err([{ kind: 'empty' }]);

    const parsed = parseCsv(text, detectDelimiter(text.trimStart()));
    if (!parsed.ok) return err([parsed.error]);

    const rows = parsed.value.filter((row) => !isBlank(row));
    const [header, ...data] = rows;
    if (!header) return err([{ kind: 'empty' }]);

    const columns = readHeader(header);
    if (!columns.ok) return columns;
    if (data.length === 0) return err([{ kind: 'no-rows' }]);
    if (data.length > IMPORT_LIMITS.maxRows) {
      return err([{ kind: 'too-many-rows', rows: data.length, maxRows: IMPORT_LIMITS.maxRows }]);
    }
    return ok(data.map((row) => toEntry(row, columns.value)));
  },
};
