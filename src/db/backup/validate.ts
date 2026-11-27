// Hand-written validation of untrusted backup JSON (`unknown` -> typed), no schema library.
// Builds fresh objects with only known fields, so unexpected properties are never stored.
import {
  isCardKind,
  isCardState,
  isGrade,
  type Card,
  type FsrsCardState,
  type ReviewLog,
} from '../../domain/card.ts';
import type { Deck } from '../../domain/deck.ts';
import type { EntityBase } from '../../domain/entity.ts';
import { err, ok, type Result } from '../../domain/result.ts';
import type { MeaningSource, Word } from '../../domain/word.ts';
import { BACKUP_SCHEMA_VERSION, type Backup, type BackupIssue } from './format.ts';

type Obj = Readonly<Record<string, unknown>>;

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Field readers that record an issue (and return a placeholder) instead of throwing. */
function fields(obj: Obj, path: string, issues: BackupIssue[]) {
  const fail = (key: string, message: string) => {
    issues.push({ path: `${path}.${key}`, message });
  };
  return {
    string(key: string): string {
      const v = obj[key];
      if (typeof v === 'string') return v;
      fail(key, 'expected a string');
      return '';
    },
    id(key: string): string {
      const v = obj[key];
      if (typeof v === 'string' && v !== '') return v;
      fail(key, 'expected a non-empty string id');
      return '';
    },
    number(key: string): number {
      const v = obj[key];
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      fail(key, 'expected a finite number');
      return 0;
    },
    optionalNumber(key: string): number | undefined {
      const v = obj[key];
      if (v === undefined) return undefined;
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      fail(key, 'expected a finite number or absent');
      return undefined;
    },
    oneOf<T>(key: string, guard: (v: unknown) => v is T, expected: string, fallback: T): T {
      const v = obj[key];
      if (guard(v)) return v;
      fail(key, `expected ${expected}`);
      return fallback;
    },
    stringArray(key: string): string[] {
      const v = obj[key];
      if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v;
      fail(key, 'expected an array of strings');
      return [];
    },
    object(key: string): Obj {
      const v = obj[key];
      if (isObj(v)) return v;
      fail(key, 'expected an object');
      return {};
    },
  };
}

type Fields = ReturnType<typeof fields>;

function base(f: Fields): EntityBase {
  const deletedAt = f.optionalNumber('deletedAt');
  return {
    id: f.id('id'),
    createdAt: f.number('createdAt'),
    updatedAt: f.number('updatedAt'),
    ...(deletedAt === undefined ? {} : { deletedAt }),
  };
}

function fsrsState(f: Fields): FsrsCardState {
  const lastReviewAt = f.optionalNumber('lastReviewAt');
  return {
    dueAt: f.number('dueAt'),
    ...(lastReviewAt === undefined ? {} : { lastReviewAt }),
    stability: f.number('stability'),
    stabilityFast: f.number('stabilityFast'),
    difficulty: f.number('difficulty'),
    scheduledDays: f.number('scheduledDays'),
    learningStep: f.number('learningStep'),
    state: f.oneOf('state', isCardState, 'a card state 0-3', 0),
  };
}

const isMeaningSource = (v: unknown): v is MeaningSource => v === 'user' || v === 'cedict';

const readers = {
  deck: (f: Fields): Deck => ({ ...base(f), name: f.string('name') }),
  word: (f: Fields): Word => ({
    ...base(f),
    deckId: f.id('deckId'),
    hanzi: f.string('hanzi'),
    pinyin: f.string('pinyin'),
    meaning: f.string('meaning'),
    meaningSource: f.oneOf('meaningSource', isMeaningSource, "'user' or 'cedict'", 'user'),
    tags: f.stringArray('tags'),
  }),
  card: (f: Fields): Card => ({
    ...base(f),
    ...fsrsState(f),
    wordId: f.id('wordId'),
    kind: f.oneOf('kind', isCardKind, "'recognition' or 'production'", 'recognition'),
    reps: f.number('reps'),
    lapses: f.number('lapses'),
  }),
  reviewLog: (f: Fields, path: string, issues: BackupIssue[]): ReviewLog => ({
    ...base(f),
    cardId: f.id('cardId'),
    rating: f.oneOf('rating', isGrade, 'a grade 1-4', 1),
    reviewedAt: f.number('reviewedAt'),
    durationMs: f.number('durationMs'),
    fsrs: fsrsState(fields(f.object('fsrs'), `${path}.fsrs`, issues)),
  }),
};

function readList<T extends EntityBase>(
  root: Obj,
  key: string,
  read: (f: Fields, path: string, issues: BackupIssue[]) => T,
  issues: BackupIssue[],
): T[] {
  const list = root[key];
  if (!Array.isArray(list)) {
    issues.push({ path: key, message: 'expected an array' });
    return [];
  }
  const seen = new Set<string>();
  return list
    .map((item: unknown, i) => {
      const path = `${key}[${String(i)}]`;
      if (!isObj(item)) {
        issues.push({ path, message: 'expected an object' });
        return undefined;
      }
      const entity = read(fields(item, path, issues), path, issues);
      if (entity.id !== '' && seen.has(entity.id)) {
        issues.push({ path: `${path}.id`, message: `duplicate id ${entity.id}` });
      }
      seen.add(entity.id);
      return entity;
    })
    .filter((e): e is T => e !== undefined);
}

function checkReferences<T>(
  items: readonly T[],
  key: string,
  refKey: string,
  ref: (item: T) => string,
  targets: ReadonlySet<string>,
  issues: BackupIssue[],
) {
  items.forEach((item, i) => {
    const target = ref(item);
    if (target !== '' && !targets.has(target)) {
      issues.push({
        path: `${key}[${String(i)}].${refKey}`,
        message: `references unknown id ${target}`,
      });
    }
  });
}

/**
 * Validates a backup at the *current* schema version (migrations run before this).
 * Collects every issue instead of stopping at the first one.
 */
export function validateBackup(raw: unknown): Result<Backup, BackupIssue[]> {
  if (!isObj(raw)) return err([{ path: '', message: 'expected a JSON object' }]);
  const issues: BackupIssue[] = [];

  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: `expected ${String(BACKUP_SCHEMA_VERSION)}` });
  }
  const exportedAt = fields(raw, '', issues).number('exportedAt');
  const decks = readList(raw, 'decks', readers.deck, issues);
  const words = readList(raw, 'words', readers.word, issues);
  const cards = readList(raw, 'cards', readers.card, issues);
  const reviewLogs = readList(raw, 'reviewLogs', readers.reviewLog, issues);

  const ids = (list: readonly EntityBase[]) => new Set(list.map((e) => e.id));
  checkReferences(words, 'words', 'deckId', (w) => w.deckId, ids(decks), issues);
  checkReferences(cards, 'cards', 'wordId', (c) => c.wordId, ids(words), issues);
  checkReferences(reviewLogs, 'reviewLogs', 'cardId', (l) => l.cardId, ids(cards), issues);

  if (issues.length > 0) return err(issues.map((i) => ({ ...i, path: i.path.replace(/^\./, '') })));
  return ok({ schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt, decks, words, cards, reviewLogs });
}
