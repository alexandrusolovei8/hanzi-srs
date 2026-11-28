import { describe, expect, it } from 'vitest';
import { decodeUtf8 } from '../decode.ts';
import { IMPORT_LIMITS } from '../types.ts';
import { csvImporter } from './csvImporter.ts';
import badHeader from './__fixtures__/bad-header.csv?raw';
import excelEs from './__fixtures__/excel-es-bom-semicolon.csv?raw';
import malformed from './__fixtures__/malformed-unclosed-quote.csv?raw';
import missingHanzi from './__fixtures__/missing-hanzi-column.csv?raw';
import noHeader from './__fixtures__/no-header.csv?raw';
import rowProblems from './__fixtures__/row-problems.csv?raw';
import tabSeparated from './__fixtures__/tab-separated.csv?raw';
import valid from './__fixtures__/valid.csv?raw';

/** Full path a file takes: bytes → strict UTF-8 decode → CSV parse. */
function importBytes(text: string) {
  const decoded = decodeUtf8(new TextEncoder().encode(text));
  if (!decoded.ok) throw new Error('fixture is not UTF-8');
  return csvImporter.parse(decoded.value);
}

function entries(text: string) {
  const result = importBytes(text);
  if (!result.ok) throw new Error(`unexpected ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('csvImporter: valid files', () => {
  it('reads all columns, quoted cells, multi-line cells and tags', () => {
    expect(entries(valid)).toEqual([
      { line: 2, hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', tags: ['greeting', 'hsk1'] },
      { line: 3, hanzi: '谢谢', pinyin: 'xièxie', meaning: 'thank you' },
      { line: 4, hanzi: '学生', pinyin: 'xué sheng', meaning: 'student, pupil', tags: ['school'] },
      {
        line: 5,
        hanzi: '老师',
        pinyin: 'lǎo shī',
        meaning: 'teacher\nmulti-line note',
        tags: ['school', 'people'],
      },
      { line: 7, hanzi: '朋友', meaning: 'friend' },
    ]);
  });

  it('reads an Excel (Spanish locale) file: BOM, semicolons, CRLF', () => {
    expect(excelEs.startsWith('﻿')).toBe(true);
    expect(excelEs).toContain('\r\n');
    expect(entries(excelEs)).toEqual([
      { line: 2, hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello', tags: ['greeting', 'hsk1'] },
      { line: 3, hanzi: '学生', pinyin: 'xuésheng', meaning: 'student; pupil', tags: ['school'] },
    ]);
  });

  it('also strips a BOM passed as text', () => {
    expect(csvImporter.parse('﻿hanzi\n你好')).toEqual({
      ok: true,
      value: [{ line: 2, hanzi: '你好' }],
    });
  });

  it('reads a tab-separated file (commas stay inside cells)', () => {
    expect(entries(tabSeparated)).toEqual([
      { line: 2, hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'hello, hi' },
      { line: 3, hanzi: '谢谢', pinyin: 'xièxie', meaning: 'thanks' },
    ]);
  });

  it('accepts columns in any order, any case, with only hanzi required', () => {
    expect(entries(' Meaning ,HANZI\nhello,你好\n')).toEqual([
      { line: 2, hanzi: '你好', meaning: 'hello' },
    ]);
    expect(entries('hanzi\n你好')).toEqual([{ line: 2, hanzi: '你好' }]);
  });

  it('ignores blank lines and trailing empty header cells', () => {
    expect(entries('\n\nhanzi,pinyin,,\n\n你好,nǐ hǎo\n\n')).toEqual([
      { line: 5, hanzi: '你好', pinyin: 'nǐ hǎo' },
    ]);
  });

  it('keeps row-level problems as data for the preview', () => {
    expect(entries(rowProblems)).toEqual([
      { line: 2, hanzi: '', pinyin: 'nǐ', meaning: 'missing hanzi' },
      { line: 3, hanzi: 'hello', meaning: 'no chinese at all' },
      { line: 4, hanzi: '你好!', meaning: 'non-chinese punctuation' },
      { line: 5, hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'first' },
      { line: 6, hanzi: '你好', pinyin: 'nǐ hǎo', meaning: 'in-file duplicate' },
      {
        line: 7,
        hanzi: '学生',
        pinyin: 'xuésheng',
        meaning: 'student',
        tags: ['school'],
        extraCells: 2,
      },
      { line: 8, hanzi: '朋友' },
    ]);
  });

  it('drops empty tags', () => {
    expect(entries('hanzi,tags\n你好," a | |b |"')).toEqual([
      { line: 2, hanzi: '你好', tags: ['a', 'b'] },
    ]);
    expect(entries('hanzi,tags\n你好,|')).toEqual([{ line: 2, hanzi: '你好' }]);
  });
});

describe('csvImporter: file-level errors', () => {
  it('rejects an empty file', () => {
    expect(csvImporter.parse('')).toEqual({ ok: false, error: [{ kind: 'empty' }] });
    expect(csvImporter.parse('﻿ \r\n\n')).toEqual({ ok: false, error: [{ kind: 'empty' }] });
    expect(csvImporter.parse(',,\n , ')).toEqual({ ok: false, error: [{ kind: 'empty' }] });
  });

  it('rejects a header with no data rows', () => {
    expect(csvImporter.parse('hanzi,pinyin\n\n')).toEqual({
      ok: false,
      error: [{ kind: 'no-rows' }],
    });
  });

  it('rejects an unclosed quote', () => {
    expect(importBytes(malformed)).toEqual({
      ok: false,
      error: [{ kind: 'unclosed-quote', line: 3 }],
    });
  });

  it('rejects a missing hanzi column, listing what was found', () => {
    expect(importBytes(missingHanzi)).toEqual({
      ok: false,
      error: [{ kind: 'missing-hanzi-column', found: ['pinyin', 'meaning'] }],
    });
  });

  it('detects a forgotten header row', () => {
    expect(importBytes(noHeader)).toEqual({
      ok: false,
      error: [{ kind: 'missing-header', firstRow: '你好, nǐ hǎo, hello' }],
    });
  });

  it('reports every header problem at once', () => {
    expect(importBytes(badHeader)).toEqual({
      ok: false,
      error: [
        { kind: 'unknown-column', column: 'pinyn', position: 2 },
        { kind: 'duplicate-column', column: 'meaning' },
      ],
    });
    expect(csvImporter.parse('hanzi,,meaning\n你,,you')).toEqual({
      ok: false,
      error: [{ kind: 'empty-column-name', position: 2 }],
    });
  });

  it('rejects files over the row limit', () => {
    const rows = Array.from({ length: IMPORT_LIMITS.maxRows + 1 }, () => '你');
    expect(csvImporter.parse(['hanzi', ...rows].join('\n'))).toEqual({
      ok: false,
      error: [{ kind: 'too-many-rows', rows: IMPORT_LIMITS.maxRows + 1, maxRows: 5000 }],
    });
    expect(csvImporter.parse(['hanzi', ...rows.slice(1)].join('\n')).ok).toBe(true);
  });
});
