import type { Clock } from './clock.ts';
import { newEntityBase, touch, type EntityBase, type EntityDeps } from './entity.ts';
import { err, ok, type Result } from './result.ts';
import { normalizeText, type ValidationError } from './validation.ts';

export interface Deck extends EntityBase {
  readonly name: string;
}

export const DECK_NAME_MAX_LENGTH = 100;

function validateName(raw: string): Result<string, ValidationError> {
  const name = normalizeText(raw);
  if (name === '') return err({ field: 'name', message: 'Deck name is required' });
  if (name.length > DECK_NAME_MAX_LENGTH) {
    return err({
      field: 'name',
      message: `Deck name must be at most ${String(DECK_NAME_MAX_LENGTH)} characters`,
    });
  }
  return ok(name);
}

export function createDeck(deps: EntityDeps, name: string): Result<Deck, ValidationError> {
  const validated = validateName(name);
  if (!validated.ok) return validated;
  return ok({ ...newEntityBase(deps), name: validated.value });
}

export function renameDeck(deck: Deck, clock: Clock, name: string): Result<Deck, ValidationError> {
  const validated = validateName(name);
  if (!validated.ok) return validated;
  return ok(touch(deck, clock, { name: validated.value }));
}
