import { csvImporter } from './csv/csvImporter.ts';
import type { Importer } from './types.ts';

/** Registered importers (Strategy pattern). Add new sources here. */
export const IMPORTERS: readonly Importer[] = [csvImporter];

export function getImporter(id: string): Importer | undefined {
  return IMPORTERS.find((importer) => importer.id === id);
}

export type { ImportError, Importer, RawEntry } from './types.ts';
export { IMPORT_LIMITS } from './types.ts';
