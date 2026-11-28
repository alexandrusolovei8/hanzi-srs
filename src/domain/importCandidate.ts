import { samePinyin } from './pinyin.ts';
import { normalizeTags, normalizeText } from './validation.ts';
import type { Word, WordChanges } from './word.ts';

export type ImportField = 'pinyin' | 'meaning' | 'tags';

/**
 * A word ready to be committed by an import. `provided` says which fields came from the file:
 * only those may overwrite an existing word (generated pinyin or an empty cell never does).
 */
export interface ImportCandidate {
  readonly hanzi: string;
  readonly pinyin: string;
  readonly meaning: string;
  readonly tags: readonly string[];
  readonly provided: Readonly<Record<ImportField, boolean>>;
}

function sameTags(a: readonly string[], b: readonly string[]): boolean {
  const left = new Set(normalizeTags(a));
  const right = new Set(normalizeTags(b));
  return left.size === right.size && [...left].every((t) => right.has(t));
}

/**
 * Fields of `existing` that the candidate would change. Empty when the import brings nothing new.
 * Pinyin is compared ignoring notation (`nǐ hǎo` = `ni3hao3`), tags ignoring order.
 */
export function changedFields(existing: Word, candidate: ImportCandidate): ImportField[] {
  const fields: ImportField[] = [];
  const { provided } = candidate;
  if (provided.pinyin && !samePinyin(existing.pinyin, candidate.pinyin)) fields.push('pinyin');
  if (provided.meaning && normalizeText(existing.meaning) !== normalizeText(candidate.meaning)) {
    fields.push('meaning');
  }
  if (provided.tags && !sameTags(existing.tags, candidate.tags)) fields.push('tags');
  return fields;
}

/** The `WordChanges` that apply the candidate's changed fields to `existing`. */
export function candidateChanges(existing: Word, candidate: ImportCandidate): WordChanges {
  const changes: { pinyin?: string; meaning?: string; tags?: readonly string[] } = {};
  for (const field of changedFields(existing, candidate)) {
    if (field === 'tags') changes.tags = candidate.tags;
    else changes[field] = candidate[field];
  }
  return changes;
}
