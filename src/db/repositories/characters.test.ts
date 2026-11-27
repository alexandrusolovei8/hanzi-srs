import { describe, expect, it } from 'vitest';
import { setupRepos, unwrap } from '../test-utils/setup.ts';

describe('CharacterRepository.rebuild', () => {
  it('derives characters from active words and preserves known stroke-data flags', async () => {
    const { db, repos } = setupRepos();
    const deck = unwrap(await repos.decks.create('D'));
    const base = { deckId: deck.id, meaning: '', meaningSource: 'user' as const };
    unwrap(await repos.words.add({ ...base, hanzi: '你好', pinyin: 'nǐ hǎo' }));
    const gone = unwrap(await repos.words.add({ ...base, hanzi: '再见', pinyin: 'zài jiàn' })).word;

    expect(await repos.characters.rebuild()).toBe(4);
    await db.characters.update('你', { inStrokeData: true });

    unwrap(await repos.words.softDelete(gone.id));
    expect(await repos.characters.rebuild()).toBe(2);

    expect(await repos.characters.list()).toEqual([
      { hanzi: '你', pinyin: ['nǐ'], inStrokeData: true },
      { hanzi: '好', pinyin: ['hǎo'], inStrokeData: false },
    ]);
    expect(await repos.characters.get('再')).toBeUndefined();
  });
});
