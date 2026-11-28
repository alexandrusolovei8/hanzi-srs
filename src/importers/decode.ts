import { err, ok, type Result } from '../domain/result.ts';
import { IMPORT_LIMITS, type ImportError } from './types.ts';

/**
 * Decodes file bytes as strict UTF-8. Any invalid byte sequence rejects the whole file
 * (no silent U+FFFD replacement). A leading BOM is removed.
 */
export function decodeUtf8(
  bytes: Uint8Array,
  maxBytes: number = IMPORT_LIMITS.maxFileBytes,
): Result<string, ImportError> {
  if (bytes.byteLength > maxBytes) {
    return err({ kind: 'file-too-large', bytes: bytes.byteLength, maxBytes });
  }
  try {
    // ignoreBOM: false (default) strips a leading BOM.
    return ok(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return err({ kind: 'not-utf8' });
  }
}
