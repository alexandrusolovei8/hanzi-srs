import { describe, expect, it, vi } from 'vitest';
import { CardState, Grade } from '../../domain/card.ts';
import { fakeDeps } from '../../domain/test-utils/fakes.ts';
import { makeCard, makeReviewLog } from '../../domain/test-utils/fixtures.ts';
import type { HanziDb } from '../database.ts';
import { createRepositories } from '../repositories/index.ts';
import { createTestDb } from '../test-utils/testDb.ts';
import { unwrap } from '../test-utils/setup.ts';
import { exportBackup, importBackup, parseBackupJson } from './backup.ts';

/** Seeds a realistic dataset, including soft-deleted rows and optional fields. */
async function seed(db: HanziDb, idPrefix: string) {
  const deps = {
    ...fakeDeps(),
    newId: (() => {
      let n = 0;
      return () => `${idPrefix}-${String(++n)}`;
    })(),
  };
  const repos = createRepositories(db, deps);
  const deck = unwrap(await repos.decks.create('HSK 1'));
  const base = { deckId: deck.id, meaningSource: 'user' as const };
  const hello = unwrap(
    await repos.words.add({
      ...base,
      hanzi: '你好',
      pinyin: 'nǐ hǎo',
      meaning: 'hello',
      tags: ['a'],
    }),
  ).word;
  const bye = unwrap(
    await repos.words.add({ ...base, hanzi: '再见', pinyin: 'zài jiàn', meaning: 'bye' }),
  ).word;
  const card = makeCard(deps, hello.id, 'recognition', {
    state: CardState.Review,
    lastReviewAt: deps.clock.now(),
    stability: 3.17,
    stabilityFast: 0.42,
  });
  await repos.cards.addMany([card, makeCard(deps, hello.id, 'production')]);
  unwrap(await repos.reviewLogs.append(makeReviewLog(deps, card, { rating: Grade.Hard })));
  unwrap(await repos.words.softDelete(bye.id));
  await repos.characters.rebuild();
  return deps;
}

/** Simulates writing the backup to a file and reading it back. */
function throughJson(value: unknown): unknown {
  return unwrap(parseBackupJson(JSON.stringify(value)));
}

describe('backup round-trip', () => {
  it('export -> JSON -> import -> export yields identical data', async () => {
    const source = createTestDb().db;
    const deps = await seed(source, 'src');
    const first = await exportBackup(source, deps.clock);

    const target = createTestDb().db;
    const summary = unwrap(await importBackup(target, throughJson(first)));
    const second = await exportBackup(target, deps.clock);

    expect(second).toEqual(first);
    expect(summary).toEqual({ decks: 1, words: 2, cards: 2, reviewLogs: 1, characters: 2 });
    expect(await target.characters.toArray()).toEqual(await source.characters.toArray());
    expect(first.words.find((w) => w.hanzi === '再见')?.deletedAt).toBeDefined();
  });

  it('import replaces all existing data', async () => {
    const backupDb = createTestDb().db;
    const deps = await seed(backupDb, 'new');
    const backup = await exportBackup(backupDb, deps.clock);

    const { db } = createTestDb();
    await seed(db, 'old');
    unwrap(await importBackup(db, throughJson(backup)));

    const ids = (await db.words.toArray()).map((w) => w.id);
    expect(ids.every((id) => id.startsWith('new-'))).toBe(true);
    expect(await exportBackup(db, deps.clock)).toEqual(backup);
  });
});

describe('import atomicity', () => {
  it.each([
    ['in the middle (cards)', 'cards'],
    ['at the last step (characters)', 'characters'],
  ] as const)('a failure %s leaves previous data intact', async (_label, table) => {
    const incomingDb = createTestDb().db;
    const deps = await seed(incomingDb, 'new');
    const incoming = await exportBackup(incomingDb, deps.clock);

    const { db } = createTestDb();
    await seed(db, 'old');
    const before = await exportBackup(db, deps.clock);
    const charactersBefore = await db.characters.toArray();

    vi.spyOn(db[table], 'bulkAdd').mockRejectedValueOnce(
      new Error('QuotaExceededError (simulated)'),
    );
    const result = await importBackup(db, throughJson(incoming));

    expect(result).toEqual({
      ok: false,
      error: { kind: 'write-failed', message: 'QuotaExceededError (simulated)' },
    });
    expect(await exportBackup(db, deps.clock)).toEqual(before);
    expect(await db.characters.toArray()).toEqual(charactersBefore);
  });

  it('invalid backups are rejected before touching the database', async () => {
    const { db } = createTestDb();
    const deps = await seed(db, 'old');
    const before = await exportBackup(db, deps.clock);
    const r = await importBackup(db, { ...before, words: [{ id: 'x' }] });
    expect(r.ok).toBe(false);
    expect(await exportBackup(db, deps.clock)).toEqual(before);
  });
});

describe('import errors', () => {
  it('reports invalid JSON', () => {
    const r = parseBackupJson('{not json');
    expect(!r.ok && r.error.kind).toBe('invalid-json');
  });

  it.each([undefined, 2, '1', 0])('rejects unsupported schemaVersion %j', async (schemaVersion) => {
    const { db } = createTestDb();
    expect(await importBackup(db, { schemaVersion })).toEqual({
      ok: false,
      error: { kind: 'unsupported-version', found: schemaVersion, supported: 1 },
    });
  });

  it('rejects non-object input', async () => {
    const { db } = createTestDb();
    expect((await importBackup(db, null)).ok).toBe(false);
  });
});
