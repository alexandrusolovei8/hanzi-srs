import { useId, useState, type SyntheticEvent } from 'react';
import type { Deck } from '../../domain/deck.ts';
import type { DeckTarget } from '../../db/repositories/index.ts';
import { FORMAT_HINT } from '../../importers/messages.ts';

/** `<select>` value for "create a new deck". Deck ids are UUIDs, so it cannot collide. */
const NEW_DECK = '__new__';

// iOS Files app: list both extensions and MIME types so .csv/.tsv/.txt files are not greyed out.
const ACCEPT =
  '.csv,.tsv,.txt,text/csv,text/comma-separated-values,text/tab-separated-values,text/plain';

const TEMPLATES = [
  { file: 'hanzi-srs-template.csv', label: 'Template (comma)' },
  { file: 'hanzi-srs-template-semicolon.csv', label: 'Template (semicolon, Excel ES/EU)' },
];

export interface ChooseFileResult {
  readonly file: File;
  readonly target: DeckTarget;
  readonly deckLabel: string;
}

interface Props {
  /** Undefined while loading. */
  readonly decks: readonly Deck[] | undefined;
  readonly errors: readonly string[];
  readonly busy: boolean;
  readonly onSubmit: (choice: ChooseFileResult) => void;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, '').trim();
}

export function ChooseFileStep({ decks, errors, busy, onSubmit }: Props) {
  const id = useId();
  const [file, setFile] = useState<File | undefined>();
  const [choice, setChoice] = useState<string | undefined>();
  const [newName, setNewName] = useState('');

  // Until the user picks, default to the first deck, or to a new deck if there are none.
  const deckChoice = choice ?? decks?.[0]?.id ?? NEW_DECK;
  const isNew = deckChoice === NEW_DECK;
  const deckName = isNew ? newName.trim() : decks?.find((d) => d.id === deckChoice)?.name;
  const canSubmit = file !== undefined && decks !== undefined && !!deckName && !busy;

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (!file || !deckName) return;
    const target: DeckTarget = isNew
      ? { kind: 'new', name: deckName }
      : { kind: 'existing', deckId: deckChoice };
    onSubmit({ file, target, deckLabel: deckName });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" aria-busy={busy}>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-file`} className="font-semibold">
          1. CSV file
        </label>
        <input
          id={`${id}-file`}
          type="file"
          accept={ACCEPT}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            const picked = e.currentTarget.files?.[0];
            setFile(picked);
            if (picked && newName === '') setNewName(baseName(picked.name));
          }}
          className="block w-full text-base file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-neutral-200 file:px-4 file:font-medium dark:file:bg-neutral-700 dark:file:text-neutral-100"
        />
        <p id={`${id}-hint`} className="text-sm text-neutral-600 dark:text-neutral-300">
          {FORMAT_HINT}
        </p>
        <ul className="flex flex-wrap gap-x-4 text-sm">
          {TEMPLATES.map((t) => (
            <li key={t.file}>
              <a
                href={`${import.meta.env.BASE_URL}templates/${t.file}`}
                download
                className="inline-flex min-h-11 items-center underline"
              >
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-deck`} className="font-semibold">
          2. Deck
        </label>
        <select
          id={`${id}-deck`}
          value={deckChoice}
          disabled={decks === undefined}
          onChange={(e) => {
            setChoice(e.currentTarget.value);
          }}
          className="min-h-11 rounded-lg border border-neutral-400 bg-transparent px-3 text-base"
        >
          {decks?.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          <option value={NEW_DECK}>New deck…</option>
        </select>
        {isNew && (
          <>
            <label htmlFor={`${id}-name`} className="text-sm">
              New deck name
            </label>
            <input
              id={`${id}-name`}
              type="text"
              value={newName}
              maxLength={100}
              onChange={(e) => {
                setNewName(e.currentTarget.value);
              }}
              className="min-h-11 rounded-lg border border-neutral-400 bg-transparent px-3 text-base"
            />
          </>
        )}
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-700 p-3 text-red-900 dark:text-red-200"
        >
          <p className="font-semibold">✕ The file was not imported</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="min-h-11 rounded-lg bg-red-700 px-4 font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Reading…' : 'Preview'}
      </button>
    </form>
  );
}
