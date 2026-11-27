import { describe, expect, it } from 'vitest';
import { validateBackup } from './validate.ts';

const t = 1_767_225_600_000;
const deck = { id: 'd1', name: 'HSK', createdAt: t, updatedAt: t };
const word = {
  id: 'w1',
  deckId: 'd1',
  hanzi: '你好',
  pinyin: 'nǐ hǎo',
  meaning: 'hello',
  meaningSource: 'cedict',
  tags: [],
  createdAt: t,
  updatedAt: t,
};
const fsrs = {
  dueAt: t,
  stability: 0,
  stabilityFast: 0,
  difficulty: 0,
  scheduledDays: 0,
  learningStep: 0,
  state: 0,
};
const card = {
  id: 'c1',
  wordId: 'w1',
  kind: 'production',
  reps: 0,
  lapses: 0,
  ...fsrs,
  createdAt: t,
  updatedAt: t,
};
const log = {
  id: 'l1',
  cardId: 'c1',
  rating: 3,
  reviewedAt: t,
  durationMs: 900,
  fsrs: { ...fsrs, lastReviewAt: t - 1 },
  createdAt: t,
  updatedAt: t,
};
const valid = {
  schemaVersion: 1,
  exportedAt: t,
  decks: [deck],
  words: [word],
  cards: [card],
  reviewLogs: [log],
};

function issuesOf(raw: unknown) {
  const r = validateBackup(raw);
  if (r.ok) throw new Error('expected invalid');
  return r.error;
}

describe('validateBackup', () => {
  it('accepts a valid backup and drops unknown properties', () => {
    const r = validateBackup({ ...valid, extra: 1, decks: [{ ...deck, hacked: true }] });
    if (!r.ok) throw new Error(JSON.stringify(r.error));
    expect(r.value).toEqual(valid);
    expect(r.value.decks[0]).not.toHaveProperty('hacked');
  });

  it('keeps optional fields only when present', () => {
    const r = validateBackup({ ...valid, decks: [{ ...deck, deletedAt: t + 1 }] });
    expect(r.ok && r.value.decks[0]?.deletedAt).toBe(t + 1);
    expect(r.ok && r.value.cards[0]).not.toHaveProperty('lastReviewAt');
    expect(r.ok && r.value.reviewLogs[0]?.fsrs.lastReviewAt).toBe(t - 1);
  });

  it('reports every issue with its JSON path', () => {
    const issues = issuesOf({
      ...valid,
      exportedAt: 'yesterday',
      decks: [{ ...deck, name: 5 }, 'oops'],
      words: [{ ...word, meaningSource: 'ai', tags: [1], deletedAt: null }],
      cards: [{ ...card, state: 7, kind: 'listening', dueAt: Number.NaN }],
      reviewLogs: [{ ...log, rating: 0, fsrs: 'none' }],
    });
    expect(issues.map((i) => i.path)).toEqual([
      'exportedAt',
      'decks[0].name',
      'decks[1]',
      'words[0].deletedAt',
      'words[0].meaningSource',
      'words[0].tags',
      'cards[0].dueAt',
      'cards[0].state',
      'cards[0].kind',
      'reviewLogs[0].rating',
      'reviewLogs[0].fsrs',
      'reviewLogs[0].fsrs.dueAt',
      'reviewLogs[0].fsrs.stability',
      'reviewLogs[0].fsrs.stabilityFast',
      'reviewLogs[0].fsrs.difficulty',
      'reviewLogs[0].fsrs.scheduledDays',
      'reviewLogs[0].fsrs.learningStep',
      'reviewLogs[0].fsrs.state',
    ]);
  });

  it('detects duplicate ids and broken references', () => {
    const issues = issuesOf({
      ...valid,
      words: [word, { ...word, deckId: 'ghost' }],
      cards: [{ ...card, wordId: 'nope' }],
      reviewLogs: [{ ...log, cardId: 'missing' }],
    });
    expect(issues).toEqual([
      { path: 'words[1].id', message: 'duplicate id w1' },
      { path: 'words[1].deckId', message: 'references unknown id ghost' },
      { path: 'cards[0].wordId', message: 'references unknown id nope' },
      { path: 'reviewLogs[0].cardId', message: 'references unknown id missing' },
    ]);
  });

  it('rejects wrong top-level shapes', () => {
    expect(issuesOf([])).toEqual([{ path: '', message: 'expected a JSON object' }]);
    expect(issuesOf({ ...valid, schemaVersion: 9, decks: {} }).map((i) => i.path)).toEqual([
      'schemaVersion',
      'decks',
      'words[0].deckId',
    ]);
    expect(issuesOf({ ...valid, decks: [{ ...deck, id: '' }] })[0]?.path).toBe('decks[0].id');
  });
});
