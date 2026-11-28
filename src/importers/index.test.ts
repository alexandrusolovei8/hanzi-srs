import { describe, expect, it } from 'vitest';
import { csvImporter } from './csv/csvImporter.ts';
import { getImporter, IMPORTERS } from './index.ts';

describe('importer registry', () => {
  it('registers the CSV importer under a unique id', () => {
    expect(getImporter('csv')).toBe(csvImporter);
    expect(new Set(IMPORTERS.map((i) => i.id)).size).toBe(IMPORTERS.length);
  });

  it('returns undefined for an unknown id', () => {
    expect(getImporter('xlsx')).toBeUndefined();
  });
});
