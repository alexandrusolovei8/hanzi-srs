/** A validation failure on a single field. */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

/** Trims and applies Unicode NFC so visually equal strings compare equal (important for dedupe). */
export function normalizeText(value: string): string {
  return value.normalize('NFC').trim();
}

/** True if the string contains at least one Han (Chinese) character. */
export function containsHan(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

/** Trimmed, non-empty, unique tags in first-seen order. */
export function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map(normalizeText).filter((t) => t !== ''))];
}
