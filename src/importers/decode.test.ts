import { describe, expect, it } from 'vitest';
import { decodeUtf8 } from './decode.ts';

const utf8 = (text: string) => new TextEncoder().encode(text);

describe('decodeUtf8', () => {
  it('decodes valid UTF-8', () => {
    expect(decodeUtf8(utf8('hanzi\n你好'))).toEqual({ ok: true, value: 'hanzi\n你好' });
  });

  it('strips a leading BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('hanzi')]);
    expect(decodeUtf8(bytes)).toEqual({ ok: true, value: 'hanzi' });
  });

  it('rejects invalid UTF-8 instead of replacing bytes', () => {
    // "hanzi\n" followed by 你好 encoded in GBK (C4 E3 BA C3), which is not valid UTF-8.
    const gbk = new Uint8Array([...utf8('hanzi\n'), 0xc4, 0xe3, 0xba, 0xc3]);
    expect(decodeUtf8(gbk)).toEqual({ ok: false, error: { kind: 'not-utf8' } });
  });

  it('rejects a truncated multi-byte sequence', () => {
    const truncated = utf8('你').slice(0, 2);
    expect(decodeUtf8(truncated)).toEqual({ ok: false, error: { kind: 'not-utf8' } });
  });

  it('rejects files over the size limit before decoding', () => {
    expect(decodeUtf8(utf8('12345'), 4)).toEqual({
      ok: false,
      error: { kind: 'file-too-large', bytes: 5, maxBytes: 4 },
    });
    expect(decodeUtf8(utf8('1234'), 4).ok).toBe(true);
  });
});
