import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseCsv, type Delimiter } from './parseCsv.ts';

function cells(text: string, delimiter: Delimiter = ',') {
  const result = parseCsv(text, delimiter);
  if (!result.ok) throw new Error(`unexpected ${JSON.stringify(result.error)}`);
  return result.value.map((r) => r.cells);
}

describe('detectDelimiter', () => {
  it('detects comma, semicolon and tab from the header', () => {
    expect(detectDelimiter('hanzi,pinyin,meaning\n你,nǐ,you')).toBe(',');
    expect(detectDelimiter('hanzi;pinyin;meaning\n你;nǐ;"a, b"')).toBe(';');
    expect(detectDelimiter('hanzi\tpinyin\n你\tnǐ')).toBe('\t');
  });

  it('only looks at the first row', () => {
    expect(detectDelimiter('hanzi;pinyin\n你,好,a,b,c;x')).toBe(';');
  });

  it('ignores separators inside quotes', () => {
    expect(detectDelimiter('"a,b,c";hanzi\n')).toBe(';');
  });

  it('defaults to comma for a single column', () => {
    expect(detectDelimiter('hanzi\n你好')).toBe(',');
    expect(detectDelimiter('')).toBe(',');
  });

  it('prefers tab, then semicolon, on a tie', () => {
    expect(detectDelimiter('a\tb;c,d')).toBe('\t');
    expect(detectDelimiter('a;b,c')).toBe(';');
  });
});

describe('parseCsv', () => {
  it('splits rows and cells', () => {
    expect(cells('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles LF, CRLF and CR line endings the same way', () => {
    const expected = [['a'], ['b'], ['c']];
    expect(cells('a\nb\nc\n')).toEqual(expected);
    expect(cells('a\r\nb\r\nc\r\n')).toEqual(expected);
    expect(cells('a\rb\rc')).toEqual(expected);
  });

  it('keeps empty cells and trailing separators', () => {
    expect(cells('a,,c,\n')).toEqual([['a', '', 'c', '']]);
  });

  it('reports blank lines as single empty cells', () => {
    expect(cells('a\n\nb')).toEqual([['a'], [''], ['b']]);
  });

  it('supports quoted cells with separators, escaped quotes and line breaks', () => {
    expect(cells('"a,b","say ""hi""","line1\r\nline2"\nx')).toEqual([
      ['a,b', 'say "hi"', 'line1\nline2'],
      ['x'],
    ]);
  });

  it('keeps an empty quoted cell', () => {
    expect(cells('""')).toEqual([['']]);
    expect(cells('a,""\n')).toEqual([['a', '']]);
  });

  it('keeps a quote inside an unquoted cell literally', () => {
    expect(cells('5"2,b')).toEqual([['5"2', 'b']]);
  });

  it('keeps text after a closing quote (lenient, like Excel)', () => {
    expect(cells('"a"b,c')).toEqual([['ab', 'c']]);
  });

  it('uses the given delimiter only', () => {
    expect(cells('a,b;c', ';')).toEqual([['a,b', 'c']]);
    expect(cells('a b\tc', '\t')).toEqual([['a b', 'c']]);
  });

  it('records the starting line of each row, counting breaks inside quotes', () => {
    const result = parseCsv('h\n"multi\nline",x\r\nlast', ',');
    expect(result.ok && result.value.map((r) => r.line)).toEqual([1, 2, 4]);
  });

  it('fails on an unclosed quote, pointing at the line where it opened', () => {
    expect(parseCsv('h\nok\n"never closed\nmore', ',')).toEqual({
      ok: false,
      error: { kind: 'unclosed-quote', line: 3 },
    });
  });

  it('returns no rows for empty text', () => {
    expect(cells('')).toEqual([]);
  });
});
