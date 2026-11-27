import { describe, expect, it } from 'vitest';
import { readImportFile } from './readFile.ts';
import { IMPORT_LIMITS } from './types.ts';

describe('readImportFile', () => {
  it('reads a UTF-8 file with BOM into entries', async () => {
    const file = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), 'hanzi,pinyin\r\n你好,nǐ hǎo\r\n']);
    expect(await readImportFile(file)).toEqual({
      ok: true,
      value: [{ line: 2, hanzi: '你好', pinyin: 'nǐ hǎo' }],
    });
  });

  it('rejects invalid UTF-8 without importing anything', async () => {
    // 你好 in GBK, built in the test: no binary fixture.
    const file = new Blob(['hanzi\n', new Uint8Array([0xc4, 0xe3, 0xba, 0xc3])]);
    expect(await readImportFile(file)).toEqual({ ok: false, error: [{ kind: 'not-utf8' }] });
  });

  it('rejects an oversized file before reading it', async () => {
    const file = new Blob([new Uint8Array(IMPORT_LIMITS.maxFileBytes + 1)]);
    expect(await readImportFile(file)).toEqual({
      ok: false,
      error: [
        {
          kind: 'file-too-large',
          bytes: IMPORT_LIMITS.maxFileBytes + 1,
          maxBytes: IMPORT_LIMITS.maxFileBytes,
        },
      ],
    });
  });

  it('passes parse errors through', async () => {
    expect(await readImportFile(new Blob(['pinyin\nni']))).toEqual({
      ok: false,
      error: [{ kind: 'missing-hanzi-column', found: ['pinyin'] }],
    });
  });
});
