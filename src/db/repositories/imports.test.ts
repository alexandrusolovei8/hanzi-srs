import { describe, expect, it } from 'vitest';
import type { ImportCandidate } from '../../domain/importCandidate.ts';
import { setupRepos, unwrap } from '../test-utils/setup.ts';

const ALL = { pinyin: true, meaning: true, tags: true };

function candidate(hanzi: string, overrides: Partial<ImportCandidate> = {}): ImportCandidate {
  return { hanzi, pinyin: '', meaning: '', tags: [], provided: ALL, ...overrides };
}

const nihao = candidate('你好', { pinyin: 'nǐ hǎo', meaning: 'hello', tags: ['hsk1'] });
const xiexie = candidate('谢谢', { pinyin: 'xièxie', meaning: 'thanks' });

async function withDeck() {
  const ctx = setupRepos();
  const deck = unwrap(await ctx.repos.decks.create('Lesson 1'));
  return { ...ctx, deck, target: { kind: 'existing', deckId: deck.id } as const };
}

describe('ImportRepository.commit', () => {
  it('adds words and rebuilds characters', async () => {
    const { repos, deck, target } = await withDeck();
    const summary = unwrap(
      await repos.imports.commit(target, [nihao, xiexie], { updateChanged: false }),
    );
    expect(summary).toEqual({ deckId: deck.id, added: 2, restored: 0, updated: 0, skipped: 0 });
    const saved = await repos.words.listByDeck(deck.id);
    expect(saved.map((w) => [w.hanzi, w.pinyin, w.meaning, w.meaningSource, w.tags])).toEqual([
      ['你好', 'nǐ hǎo', 'hello', 'user', ['hsk1']],
      ['谢谢', 'xièxie', 'thanks', 'user', []],
    ]);
    expect((await repos.characters.list()).map((c) => c.hanzi)).toEqual(['你', '好', '谢']);
  });

  it('importing the same rows twice creates no duplicates', async () => {
    const { db, repos, target } = await withDeck();
    unwrap(await repos.imports.commit(target, [nihao, xiexie], { updateChanged: false }));
    const second = unwrap(
      await repos.imports.commit(target, [nihao, xiexie], { updateChanged: true }),
    );
    expect(second).toMatchObject({ added: 0, updated: 0, skipped: 2 });
    expect(await db.words.count()).toBe(2);
  });

  it('restores a soft-deleted word with the same id', async () => {
    const { repos, deck, target } = await withDeck();
    const first = unwrap(await repos.imports.commit(target, [nihao], { updateChanged: false }));
    expect(first.added).toBe(1);
    const [original] = await repos.words.listByDeck(deck.id);
    unwrap(await repos.words.softDelete(original?.id ?? ''));

    const again = unwrap(await repos.imports.commit(target, [nihao], { updateChanged: false }));
    expect(again).toMatchObject({ added: 0, restored: 1 });
    expect((await repos.words.listByDeck(deck.id)).map((w) => w.id)).toEqual([original?.id]);
  });

  it('skips changed words by default and updates them on request', async () => {
    const { repos, deps, deck, target } = await withDeck();
    unwrap(await repos.imports.commit(target, [nihao], { updateChanged: false }));
    const changed = { ...nihao, meaning: 'hi', tags: ['greeting'] };

    const skipped = unwrap(await repos.imports.commit(target, [changed], { updateChanged: false }));
    expect(skipped).toMatchObject({ updated: 0, skipped: 1 });
    expect((await repos.words.listByDeck(deck.id))[0]?.meaning).toBe('hello');

    deps.clock.advance(5_000);
    const updated = unwrap(await repos.imports.commit(target, [changed], { updateChanged: true }));
    expect(updated).toMatchObject({ updated: 1, skipped: 0 });
    const [word] = await repos.words.listByDeck(deck.id);
    expect(word).toMatchObject({ meaning: 'hi', tags: ['greeting'], pinyin: 'nǐ hǎo' });
    expect(word?.updatedAt).toBe((word?.createdAt ?? 0) + 5_000);
  });

  it('does not overwrite fields the file did not provide', async () => {
    const { repos, deck, target } = await withDeck();
    unwrap(await repos.imports.commit(target, [nihao], { updateChanged: false }));
    const generated = candidate('你好', {
      pinyin: 'nǐ hao',
      provided: { pinyin: false, meaning: false, tags: false },
    });
    const r = unwrap(await repos.imports.commit(target, [generated], { updateChanged: true }));
    expect(r).toMatchObject({ updated: 0, skipped: 1 });
    expect((await repos.words.listByDeck(deck.id))[0]).toMatchObject({
      pinyin: 'nǐ hǎo',
      meaning: 'hello',
    });
  });

  it('matches saved words by normalized hanzi', async () => {
    const { db, repos, target } = await withDeck();
    unwrap(await repos.imports.commit(target, [nihao], { updateChanged: false }));
    const r = unwrap(
      await repos.imports.commit(target, [{ ...nihao, hanzi: ' 你好 ' }], { updateChanged: false }),
    );
    expect(r.skipped).toBe(1);
    expect(await db.words.count()).toBe(1);
  });

  it('creates a new deck in the same transaction', async () => {
    const { repos } = setupRepos();
    const r = unwrap(
      await repos.imports.commit({ kind: 'new', name: 'Imported' }, [nihao], {
        updateChanged: false,
      }),
    );
    expect((await repos.decks.getActive(r.deckId))?.name).toBe('Imported');
    expect(await repos.words.listByDeck(r.deckId)).toHaveLength(1);
  });

  it('is all-or-nothing: a failing row rolls back earlier rows and the new deck', async () => {
    const { db, repos } = setupRepos();
    const bad = candidate('abc'); // no Chinese character: domain validation fails
    const r = await repos.imports.commit({ kind: 'new', name: 'Doomed' }, [nihao, bad], {
      updateChanged: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('validation');
    expect(await db.words.count()).toBe(0);
    expect(await db.decks.count()).toBe(0);
    expect(await db.characters.count()).toBe(0);
  });

  it('fails for an invalid new deck name or a missing deck', async () => {
    const { repos } = setupRepos();
    const blank = await repos.imports.commit({ kind: 'new', name: '  ' }, [nihao], {
      updateChanged: false,
    });
    expect(blank.ok).toBe(false);
    const missing = await repos.imports.commit({ kind: 'existing', deckId: 'nope' }, [nihao], {
      updateChanged: false,
    });
    expect(missing).toEqual({ ok: false, error: { kind: 'not-found', id: 'nope' } });
  });

  it('rethrows unexpected errors', async () => {
    const { db, repos, target } = await withDeck();
    db.close();
    await expect(repos.imports.commit(target, [nihao], { updateChanged: false })).rejects.toThrow();
  });
});

describe('ImportRepository.previewContext', () => {
  it('splits active words from soft-deleted hanzi', async () => {
    const { repos, deck, target } = await withDeck();
    unwrap(await repos.imports.commit(target, [nihao, xiexie], { updateChanged: false }));
    const [first] = await repos.words.listByDeck(deck.id);
    unwrap(await repos.words.softDelete(first?.id ?? ''));

    const ctx = await repos.imports.previewContext(deck.id);
    expect(ctx.existing.map((w) => w.hanzi)).toEqual(['谢谢']);
    expect([...ctx.deletedHanzi]).toEqual(['你好']);
  });
});
