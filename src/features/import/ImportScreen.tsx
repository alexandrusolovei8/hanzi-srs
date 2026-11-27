import { useEffect, useMemo, useState } from 'react';
import type { Deck } from '../../domain/deck.ts';
import type { CommitSummary, DeckTarget, Repositories } from '../../db/repositories/index.ts';
import { pinyinProTool, type PinyinTool } from '../../importers/enrich/pinyinTool.ts';
import { describeImportError } from '../../importers/messages.ts';
import {
  buildPreview,
  candidatesToCommit,
  withPinyin,
  type PreviewContext,
} from '../../importers/preview.ts';
import { readImportFile } from '../../importers/readFile.ts';
import type { RawEntry } from '../../importers/types.ts';
import { ChooseFileStep, type ChooseFileResult } from './ChooseFileStep.tsx';
import { PreviewStep } from './PreviewStep.tsx';

interface PreviewState {
  readonly step: 'preview';
  readonly fileName: string;
  readonly target: DeckTarget;
  readonly deckLabel: string;
  readonly entries: readonly RawEntry[];
  readonly context: PreviewContext;
}

type State =
  | { readonly step: 'choose' }
  | PreviewState
  | { readonly step: 'done'; readonly deckLabel: string; readonly summary: CommitSummary };

export interface ImportScreenProps {
  readonly repos: Pick<Repositories, 'decks' | 'imports'>;
  readonly onClose: () => void;
  /** Injectable for tests; pinyin-pro by default. */
  readonly pinyin?: PinyinTool;
}

/** Two steps: choose file + deck → preview + confirm. Loaded lazily (pulls in pinyin-pro). */
export default function ImportScreen({
  repos,
  onClose,
  pinyin = pinyinProTool,
}: ImportScreenProps) {
  const [state, setState] = useState<State>({ step: 'choose' });
  const [decks, setDecks] = useState<readonly Deck[] | undefined>();
  const [fileErrors, setFileErrors] = useState<readonly string[]>([]);
  const [commitError, setCommitError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void repos.decks.list().then((list) => {
      if (active) setDecks(list);
    });
    return () => {
      active = false;
    };
  }, [repos, state.step]);

  const preview = useMemo(
    () => (state.step === 'preview' ? buildPreview(state.entries, state.context) : undefined),
    [state],
  );

  async function handleChoose({ file, target, deckLabel }: ChooseFileResult) {
    setBusy(true);
    setFileErrors([]);
    try {
      const parsed = await readImportFile(file);
      if (!parsed.ok) {
        setFileErrors(parsed.error.map(describeImportError));
        return;
      }
      const saved =
        target.kind === 'existing'
          ? await repos.imports.previewContext(target.deckId)
          : { existing: [], deletedHanzi: new Set<string>() };
      setState({
        step: 'preview',
        fileName: file.name,
        target,
        deckLabel,
        entries: parsed.value,
        context: { ...saved, pinyin },
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(current: PreviewState, updateChanged: boolean) {
    const candidates = candidatesToCommit(buildPreview(current.entries, current.context), {
      updateChanged,
    });
    setBusy(true);
    setCommitError(undefined);
    try {
      const result = await repos.imports.commit(current.target, candidates, { updateChanged });
      if (result.ok)
        setState({ step: 'done', deckLabel: current.deckLabel, summary: result.value });
      else
        setCommitError(
          `Nothing was imported (${result.error.kind}). Check the rows and try again.`,
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="import-title" className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 id="import-title" className="text-2xl font-bold">
          Import words
        </h1>
        <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-3 underline">
          Close
        </button>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Step {state.step === 'choose' ? 1 : 2} of 2
      </p>

      {state.step === 'choose' && (
        <ChooseFileStep
          decks={decks}
          errors={fileErrors}
          busy={busy}
          onSubmit={(choice) => void handleChoose(choice)}
        />
      )}

      {state.step === 'preview' && preview && (
        <PreviewStep
          preview={preview}
          fileName={state.fileName}
          deckLabel={state.deckLabel}
          busy={busy}
          error={commitError}
          onUseSuggestion={(line, suggested) => {
            setState({ ...state, entries: withPinyin(state.entries, line, suggested) });
          }}
          onBack={() => {
            setCommitError(undefined);
            setState({ step: 'choose' });
          }}
          onConfirm={(updateChanged) => void handleConfirm(state, updateChanged)}
        />
      )}

      {state.step === 'done' && (
        <div className="flex flex-col gap-4">
          <div role="status" className="rounded-lg border-2 border-green-700 p-3">
            <p className="font-semibold">✓ Imported into {state.deckLabel}</p>
            <ul className="mt-1 list-disc pl-5">
              <li>Added: {state.summary.added}</li>
              <li>Restored: {state.summary.restored}</li>
              <li>Updated: {state.summary.updated}</li>
              <li>Skipped (already saved): {state.summary.skipped}</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              setState({ step: 'choose' });
            }}
            className="min-h-11 rounded-lg border border-neutral-500 px-4 font-medium"
          >
            Import another file
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg bg-red-700 px-4 font-semibold text-white"
          >
            Done
          </button>
        </div>
      )}
    </section>
  );
}
