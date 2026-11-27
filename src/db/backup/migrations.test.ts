import { describe, expect, it } from 'vitest';
import { BACKUP_MIGRATIONS, migrateBackup, type BackupMigration } from './migrations.ts';

// Dummy v1 -> v2 (test-only): word.meaning (string) becomes word.meanings (string[]).
const v1ToV2: BackupMigration = {
  from: 1,
  migrate: (data) => ({
    ...data,
    words: (data.words as { meaning: string }[]).map(({ meaning, ...rest }) => ({
      ...rest,
      meanings: meaning.split(';').map((m) => m.trim()),
    })),
  }),
};

// Dummy v2 -> v3 (test-only): adds a top-level field, to prove steps chain in order.
const v2ToV3: BackupMigration = {
  from: 2,
  migrate: (data) => ({ ...data, settings: { dailyLimit: 20 } }),
};

const v1 = {
  schemaVersion: 1,
  exportedAt: 1,
  words: [{ id: 'w1', hanzi: '好', meaning: 'good; well' }],
};

describe('migrateBackup', () => {
  it('migrates a v1 backup to v2 and sets schemaVersion', () => {
    const r = migrateBackup(v1, 2, [v1ToV2]);
    expect(r).toEqual({
      ok: true,
      value: {
        schemaVersion: 2,
        exportedAt: 1,
        words: [{ id: 'w1', hanzi: '好', meanings: ['good', 'well'] }],
      },
    });
  });

  it('does not mutate the input', () => {
    const input = structuredClone(v1);
    migrateBackup(input, 2, [v1ToV2]);
    expect(input).toEqual(v1);
  });

  it('chains several steps in order, regardless of array order', () => {
    const r = migrateBackup(v1, 3, [v2ToV3, v1ToV2]);
    expect(r.ok && r.value).toMatchObject({
      schemaVersion: 3,
      settings: { dailyLimit: 20 },
      words: [{ meanings: ['good', 'well'] }],
    });
  });

  it('returns data unchanged (but copied) when already at the target version', () => {
    const r = migrateBackup(v1, 1, []);
    expect(r).toEqual({ ok: true, value: v1 });
    expect(r.ok && r.value).not.toBe(v1);
  });

  it.each([
    ['a newer backup than the app', { schemaVersion: 3 }, 2],
    ['a gap in the migration chain', { schemaVersion: 1 }, 3],
    ['a missing version', {}, 2],
    ['a non-integer version', { schemaVersion: 1.5 }, 2],
    ['version 0', { schemaVersion: 0 }, 2],
  ])('rejects %s', (_label, raw, target) => {
    const r = migrateBackup(raw, target, [v1ToV2]);
    expect(!r.ok && r.error).toEqual({
      kind: 'unsupported-version',
      found: (raw as { schemaVersion?: unknown }).schemaVersion,
      supported: target,
    });
  });

  it('rejects non-object input', () => {
    for (const raw of ['nope', [], null]) {
      const r = migrateBackup(raw);
      expect(!r.ok && r.error.kind).toBe('invalid');
    }
  });

  it('ships a contiguous migration chain up to the current version', () => {
    const froms = BACKUP_MIGRATIONS.map((m) => m.from).sort((a, b) => a - b);
    froms.forEach((from, i) => {
      expect(from).toBe(i + 1);
    });
  });
});
