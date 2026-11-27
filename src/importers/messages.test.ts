import { describe, expect, it } from 'vitest';
import { describeImportError, FORMAT_HINT } from './messages.ts';
import type { ImportError } from './types.ts';

describe('describeImportError', () => {
  it('tells the user to save as CSV UTF-8 when decoding fails', () => {
    expect(describeImportError({ kind: 'not-utf8' })).toContain('CSV UTF-8');
  });

  it.each<[ImportError, string]>([
    [{ kind: 'file-too-large', bytes: 3 * 1024 * 1024, maxBytes: 2 * 1024 * 1024 }, '3.0 MB'],
    [{ kind: 'empty' }, 'hanzi, pinyin, meaning, tags'],
    [{ kind: 'no-rows' }, 'no words'],
    [{ kind: 'too-many-rows', rows: 6000, maxRows: 5000 }, '6000 rows'],
    [{ kind: 'unclosed-quote', line: 7 }, 'line 7'],
    [{ kind: 'missing-header', firstRow: '你好, nǐ hǎo' }, '"你好, nǐ hǎo"'],
    [{ kind: 'missing-hanzi-column', found: ['pinyin'] }, 'Found: pinyin.'],
    [{ kind: 'missing-hanzi-column', found: [] }, 'No column names found.'],
    [{ kind: 'unknown-column', column: 'pinyn', position: 2 }, 'Column 2 is named "pinyn"'],
    [{ kind: 'empty-column-name', position: 3 }, 'Column 3 has no name'],
    [{ kind: 'duplicate-column', column: 'meaning' }, '"meaning" appears more than once'],
  ])('describes %o', (error, expected) => {
    expect(describeImportError(error)).toContain(expected);
  });

  it('documents the tag separator in the format hint', () => {
    expect(FORMAT_HINT).toContain('"|"');
  });
});
