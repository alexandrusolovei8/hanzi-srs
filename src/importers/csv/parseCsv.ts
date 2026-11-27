import { err, ok, type Result } from '../../domain/result.ts';

export type Delimiter = ',' | ';' | '\t';

/** Candidates in tie-break order: tab and semicolon rarely appear by accident in a header. */
const DELIMITERS: readonly Delimiter[] = ['\t', ';', ','];

export interface CsvRow {
  /** 1-based line where the row starts (rows can span lines inside quoted cells). */
  readonly line: number;
  readonly cells: readonly string[];
}

/**
 * Picks the separator that appears most often in the first row (outside quotes).
 * Excel saves ";" under Spanish/European locale settings, "," elsewhere; "\t" for "Text".
 * A single-column file has none of them and defaults to ",".
 */
export function detectDelimiter(text: string): Delimiter {
  const counts = new Map<Delimiter, number>(DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (char === '\n' || char === '\r')) break;
    else if (!inQuotes && counts.has(char as Delimiter)) {
      counts.set(char as Delimiter, (counts.get(char as Delimiter) ?? 0) + 1);
    }
  }
  let best: Delimiter = ',';
  let bestCount = 0;
  for (const d of DELIMITERS) {
    const count = counts.get(d) ?? 0;
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * RFC 4180 tokenizer, lenient where Excel is:
 * - cells may be wrapped in double quotes; `""` inside quotes is a literal quote;
 * - quoted cells may contain the separator and line breaks;
 * - line endings may be CRLF, LF or CR;
 * - a quote in the middle of an unquoted cell is kept literally.
 * Fails only on a quote that is never closed (the rest of the file would be swallowed).
 */
export function parseCsv(
  text: string,
  delimiter: Delimiter,
): Result<CsvRow[], { readonly kind: 'unclosed-quote'; readonly line: number }> {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let atCellStart = true;
  let line = 1;
  let rowLine = 1;
  let quoteLine = 1;

  const endCell = () => {
    cells.push(cell);
    cell = '';
    atCellStart = true;
  };
  const endRow = () => {
    endCell();
    rows.push({ line: rowLine, cells });
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const isNewline = char === '\n' || char === '\r';
    // A CRLF pair is one line break.
    const lineBreak = isNewline && !(char === '\r' && text.charAt(i + 1) === '\n');

    if (inQuotes) {
      if (char === '"') {
        if (text.charAt(i + 1) === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if (isNewline && !lineBreak) {
        // CR of a CRLF inside a quoted cell: keep only the LF so cell text is the same on every OS.
        continue;
      } else {
        cell += char;
        if (lineBreak) line++;
      }
      continue;
    }

    if (char === '"' && atCellStart) {
      inQuotes = true;
      atCellStart = false;
      quoteLine = line;
    } else if (char === delimiter) {
      endCell();
    } else if (isNewline) {
      if (lineBreak) {
        endRow();
        line++;
        rowLine = line;
      }
    } else {
      cell += char;
      atCellStart = false;
    }
  }

  if (inQuotes) return err({ kind: 'unclosed-quote', line: quoteLine });
  // Text not ending in a newline leaves a final row pending.
  if (cell !== '' || cells.length > 0 || !atCellStart) endRow();
  return ok(rows);
}
