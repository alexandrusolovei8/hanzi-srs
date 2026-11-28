import { useId, useState } from 'react';
import {
  describeRowError,
  describeRowStatus,
  describeRowWarning,
  STATUS_LABEL,
} from '../../importers/messages.ts';
import {
  candidatesToCommit,
  pinyinSuggestion,
  type Preview,
  type PreviewRow,
  type RowStatus,
} from '../../importers/preview.ts';

/** Symbol + text + color: status is never conveyed by color alone. */
const STATUS_STYLE: Readonly<Record<RowStatus, { symbol: string; className: string }>> = {
  new: { symbol: '+', className: 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100' },
  restore: { symbol: '↺', className: 'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100' },
  duplicate: { symbol: '=', className: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100' },
  changed: { symbol: '≠', className: 'bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100' },
  error: { symbol: '✕', className: 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100' },
}; // prettier-ignore

const SUMMARY_ORDER: readonly RowStatus[] = ['new', 'restore', 'changed', 'duplicate', 'error'];

function StatusBadge({ status }: { status: RowStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-medium ${style.className}`}
    >
      <span aria-hidden="true">{style.symbol}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}

function WarningBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
      <span aria-hidden="true">⚠</span>
      Warning
    </span>
  );
}

interface RowProps {
  readonly row: PreviewRow;
  readonly onUseSuggestion: (line: number, pinyin: string) => void;
}

function Row({ row, onUseSuggestion }: RowProps) {
  const { entry } = row;
  const suggestion = pinyinSuggestion(row);
  const statusNote = describeRowStatus(row);
  const notes = [
    ...row.errors.map(describeRowError),
    ...row.warnings.map(describeRowWarning),
    ...(statusNote === '' ? [] : [statusNote]),
  ];
  const pinyin = row.candidate?.pinyin ?? entry.pinyin ?? '';
  const meaning = row.candidate?.meaning ?? entry.meaning ?? '';

  return (
    <tr className="border-t border-neutral-300 align-top dark:border-neutral-700">
      <td className="px-2 py-2 text-sm text-neutral-600 tabular-nums dark:text-neutral-300">
        {entry.line}
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={row.status} />
          {row.status !== 'error' && row.warnings.length > 0 && <WarningBadge />}
        </div>
      </td>
      <td lang="zh-CN" className="px-2 py-2 text-lg">
        {entry.hanzi || <span className="text-sm text-neutral-500">(empty)</span>}
      </td>
      <td className="px-2 py-2">
        {pinyin}
        {row.pinyinGenerated && (
          <span className="block text-xs text-neutral-600 dark:text-neutral-300">generated</span>
        )}
      </td>
      <td className="px-2 py-2 whitespace-pre-line">
        {meaning || <span className="text-sm text-neutral-500">(empty)</span>}
      </td>
      <td className="px-2 py-2 text-sm">
        {notes.length > 0 && (
          <ul className="flex flex-col gap-1">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
        {suggestion !== undefined && (
          <button
            type="button"
            onClick={() => {
              onUseSuggestion(entry.line, suggestion);
            }}
            aria-label={`Use suggestion ${suggestion} for ${entry.hanzi}`}
            className="mt-2 min-h-11 rounded-lg border border-neutral-500 px-3 font-medium"
          >
            Use suggestion
          </button>
        )}
      </td>
    </tr>
  );
}

interface Props {
  readonly preview: Preview;
  readonly fileName: string;
  readonly deckLabel: string;
  readonly busy: boolean;
  readonly error: string | undefined;
  readonly onUseSuggestion: (line: number, pinyin: string) => void;
  readonly onBack: () => void;
  readonly onConfirm: (updateChanged: boolean) => void;
}

export function PreviewStep({
  preview,
  fileName,
  deckLabel,
  busy,
  error,
  onUseSuggestion,
  onBack,
  onConfirm,
}: Props) {
  const id = useId();
  const [updateChanged, setUpdateChanged] = useState(false);
  const { summary } = preview;
  const toWrite = candidatesToCommit(preview, { updateChanged }).length;

  return (
    <div className="flex flex-col gap-4" aria-busy={busy}>
      <p>
        <span className="font-semibold">{fileName}</span> → deck{' '}
        <span className="font-semibold">{deckLabel}</span>
      </p>

      <section
        aria-labelledby={`${id}-summary`}
        className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700"
      >
        <h2 id={`${id}-summary`} className="mb-2 font-semibold">
          Summary: {summary.total} rows
        </h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          {SUMMARY_ORDER.map((status) => (
            <div key={status} className="flex justify-between gap-2">
              <dt>
                <StatusBadge status={status} />
              </dt>
              <dd className="tabular-nums">{summary.byStatus[status]}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-2">
            <dt>
              <WarningBadge />
            </dt>
            <dd className="tabular-nums">{summary.withWarnings}</dd>
          </div>
        </dl>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
          Warnings never block a row and never change your data. Errors and duplicates are skipped.
        </p>
      </section>

      {summary.byStatus.changed > 0 && (
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={updateChanged}
            onChange={(e) => {
              setUpdateChanged(e.currentTarget.checked);
            }}
            className="size-6"
          />
          <span>
            Update the changed words ({summary.byStatus.changed}) with the file&apos;s data
          </span>
        </label>
      )}

      <div
        className="max-h-[60dvh] overflow-auto rounded-lg border border-neutral-300 dark:border-neutral-700"
        tabIndex={0}
        role="region"
        aria-label="Rows in the file (scrollable)"
      >
        <table className="w-full min-w-[40rem] border-collapse text-left">
          <caption className="sr-only">Preview of every row in the file</caption>
          <thead className="sticky top-0 bg-neutral-100 text-sm dark:bg-neutral-800">
            <tr>
              <th scope="col" className="px-2 py-2">
                Line
              </th>
              <th scope="col" className="px-2 py-2">
                Status
              </th>
              <th scope="col" className="px-2 py-2">
                Hanzi
              </th>
              <th scope="col" className="px-2 py-2">
                Pinyin
              </th>
              <th scope="col" className="px-2 py-2">
                Meaning
              </th>
              <th scope="col" className="px-2 py-2">
                Notes
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <Row key={row.entry.line} row={row} onUseSuggestion={onUseSuggestion} />
            ))}
          </tbody>
        </table>
      </div>

      {error !== undefined && (
        <p
          role="alert"
          className="rounded-lg border-2 border-red-700 p-3 text-red-900 dark:text-red-200"
        >
          ✕ {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={toWrite === 0 || busy}
          onClick={() => {
            onConfirm(updateChanged);
          }}
          className="min-h-11 rounded-lg bg-red-700 px-4 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Importing…' : `Import ${String(toWrite)} word${toWrite === 1 ? '' : 's'}`}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="min-h-11 rounded-lg border border-neutral-500 px-4 font-medium"
        >
          Back
        </button>
      </div>
    </div>
  );
}
