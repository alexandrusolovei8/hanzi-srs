import type { ValidationError } from '../../domain/validation.ts';

/** Expected failures of repository operations (returned as Result errors, never thrown). */
export type RepoError =
  | { readonly kind: 'validation'; readonly errors: readonly ValidationError[] }
  | { readonly kind: 'not-found'; readonly id: string }
  | { readonly kind: 'duplicate'; readonly existingId: string };
