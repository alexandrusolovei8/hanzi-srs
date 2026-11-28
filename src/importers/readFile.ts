import { err, type Result } from '../domain/result.ts';
import { csvImporter } from './csv/csvImporter.ts';
import { decodeUtf8 } from './decode.ts';
import { IMPORT_LIMITS, type ImportError, type Importer, type RawEntry } from './types.ts';

/**
 * Untrusted file → entries: size check (before reading into memory) → strict UTF-8 → parse.
 * `file` is a Blob so it works with the `File` from an `<input type="file">` on any browser.
 */
export async function readImportFile(
  file: Blob,
  importer: Importer = csvImporter,
): Promise<Result<RawEntry[], ImportError[]>> {
  if (file.size > IMPORT_LIMITS.maxFileBytes) {
    return err([
      { kind: 'file-too-large', bytes: file.size, maxBytes: IMPORT_LIMITS.maxFileBytes },
    ]);
  }
  const text = decodeUtf8(new Uint8Array(await file.arrayBuffer()));
  if (!text.ok) return err([text.error]);
  return importer.parse(text.value);
}
