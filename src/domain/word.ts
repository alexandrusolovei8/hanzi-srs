import type { Clock } from './clock.ts';
import { newEntityBase, touch, type EntityBase, type EntityDeps } from './entity.ts';
import { err, ok, type Result } from './result.ts';
import { containsHan, normalizeTags, normalizeText, type ValidationError } from './validation.ts';

/** Where the meaning came from: typed/edited by the user, or filled from CC-CEDICT. */
export type MeaningSource = 'user' | 'cedict';

export interface Word extends EntityBase {
  readonly deckId: string;
  readonly hanzi: string;
  readonly pinyin: string;
  readonly meaning: string;
  readonly meaningSource: MeaningSource;
  readonly tags: readonly string[];
}

export interface WordInput {
  readonly deckId: string;
  readonly hanzi: string;
  readonly pinyin: string;
  readonly meaning: string;
  readonly meaningSource: MeaningSource;
  readonly tags?: readonly string[];
}

export type WordChanges = Partial<Omit<WordInput, 'deckId'>>;

type WordFields = Omit<Word, keyof EntityBase>;

function validate(input: WordInput): Result<WordFields, ValidationError[]> {
  const errors: ValidationError[] = [];
  const deckId = input.deckId.trim();
  const hanzi = normalizeText(input.hanzi);

  if (deckId === '') errors.push({ field: 'deckId', message: 'Deck is required' });
  if (hanzi === '') errors.push({ field: 'hanzi', message: 'Hanzi is required' });
  else if (!containsHan(hanzi)) {
    errors.push({ field: 'hanzi', message: 'Hanzi must contain at least one Chinese character' });
  }
  if (errors.length > 0) return err(errors);

  return ok({
    deckId,
    hanzi,
    pinyin: normalizeText(input.pinyin),
    meaning: normalizeText(input.meaning),
    meaningSource: input.meaningSource,
    tags: normalizeTags(input.tags ?? []),
  });
}

export function createWord(deps: EntityDeps, input: WordInput): Result<Word, ValidationError[]> {
  const fields = validate(input);
  if (!fields.ok) return fields;
  return ok({ ...newEntityBase(deps), ...fields.value });
}

/**
 * Applies user edits. Editing the meaning marks it as user-provided unless the caller
 * explicitly sets `meaningSource` (e.g. re-filling from the dictionary).
 */
export function updateWord(
  word: Word,
  clock: Clock,
  changes: WordChanges,
): Result<Word, ValidationError[]> {
  const meaningEdited = changes.meaning !== undefined && changes.meaning !== word.meaning;
  const fields = validate({
    deckId: word.deckId,
    hanzi: changes.hanzi ?? word.hanzi,
    pinyin: changes.pinyin ?? word.pinyin,
    meaning: changes.meaning ?? word.meaning,
    meaningSource: changes.meaningSource ?? (meaningEdited ? 'user' : word.meaningSource),
    tags: changes.tags ?? word.tags,
  });
  if (!fields.ok) return fields;
  return ok(touch(word, clock, fields.value));
}
