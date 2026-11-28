# SPEC — hanzi-srs

## 1. Goals

1. A daily-use app to learn Mandarin vocabulary (hanzi, pinyin, meaning) with spaced repetition and handwriting practice.
2. A portfolio project demonstrating clean architecture and an AI-assisted workflow with Claude Code.

## 2. Platform

- PWA, installable on iPhone via Safari "Add to Home Screen"; also usable on desktop browsers.
- Offline-first: all data local in IndexedDB. No backend in the MVP.
- Hosting: GitHub Pages (free HTTPS), deployed by GitHub Actions.

## 3. MVP scope

| Feature          | Description                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Import           | UTF-8 CSV file with header `hanzi,pinyin,meaning,tags` (comma/semicolon/tab auto-detected). Preview before commit, dedupe by deck + hanzi. |
| Enrichment       | Missing pinyin → `pinyin-pro`. Missing meaning → CC-CEDICT lookup (English). User can edit any field; `meaningSource` tracks origin.       |
| Review (FSRS)    | `ts-fsrs` scheduling. Ratings Again/Hard/Good/Easy. Every review appends a `ReviewLog`.                                                    |
| Card kinds       | `recognition`: hanzi → meaning + pinyin. `production`: meaning → write hanzi (Hanzi Writer quiz; stroke mistakes suggest a rating).        |
| Writing practice | Free stroke-order practice per character, outside the schedule.                                                                            |
| Backup           | Export/import full JSON backup with `schemaVersion`. Periodic reminder.                                                                    |
| Stats            | Due today, reviewed today, streak (days).                                                                                                  |

Out of scope (later phases): TTS audio, tone drills, photo → words, cross-device sync, AI tutor agent, push notifications.

## 4. Stack

React 19 · TypeScript (strict) · Vite · vite-plugin-pwa · Dexie 4 + dexie-react-hooks · ts-fsrs · pinyin-pro · hanzi-writer · react-router · Tailwind CSS · Vitest + fake-indexeddb + Testing Library · Playwright (WebKit).
Exact versions pinned in M0 (`npm view <pkg> version`).

## 5. Data model

All entities carry `id` (UUID), `createdAt`, `updatedAt` (epoch ms) and optional `deletedAt` (soft delete) — this makes later sync possible without a painful migration.

```ts
Deck      { id, name, createdAt, updatedAt, deletedAt? }
Word      { id, deckId, hanzi, pinyin, meaning, meaningSource: 'user' | 'cedict',
            tags: string[], createdAt, updatedAt, deletedAt? }
            // [deckId+hanzi] unique among non-deleted words, enforced by the repository
            // (not a unique DB index): re-adding a soft-deleted word restores it, keeping its id.
Character { hanzi /*PK*/, pinyin: string[], inStrokeData: boolean }   // derived from Words
Card      { id, wordId, kind: 'recognition' | 'production',
            dueAt, lastReviewAt?, stability, stabilityFast, difficulty,
            scheduledDays, learningStep, reps, lapses, state,
            createdAt, updatedAt, deletedAt? }
ReviewLog { id, cardId, rating, reviewedAt, durationMs,
            fsrs: { state, dueAt, lastReviewAt?, stability, stabilityFast, difficulty,
                    scheduledDays, learningStep },   // pre-review snapshot (enables undo)
            createdAt, updatedAt }                   // append-only: never updated or deleted
```

Each new Word creates one `recognition` and one `production` card.

**FSRS alignment** (checked against `ts-fsrs` 6.0.1 type definitions, 2026-11-27): field names follow ts-fsrs v6
(`dueAt`, `lastReviewAt`, `scheduledDays`, `learningStep`, `stabilityFast`); model is **FSRS-7**
(`DefaultScheduler` default). v5's `elapsed_days` no longer exists — derive it from timestamps.
`state`: New 0 · Learning 1 · Review 2 · Relearning 3. `rating` is a Grade: Again 1 · Hard 2 · Good 3 · Easy 4
(ts-fsrs `Manual` 0 is not used). Dates are stored as epoch ms; the M4 adapter converts to/from `Date`.
`scheduleStatus` is not stored (derived from `state`).

### Importer contract

```ts
interface Importer {
  id: string;                                   // 'csv' (only importer in the MVP)
  parse(input: string): Result<RawEntry[], ImportError[]>;   // ImportError = file-level problem
}
RawEntry = { line: number; hanzi: string; pinyin?: string; meaning?: string; tags?: string[];
             extraCells?: number }   // line = source line, for the preview; extraCells = row error
```

File format: see `docs/import-format.md`. Bytes are decoded as strict UTF-8 (`TextDecoder` `fatal: true`);
invalid UTF-8 rejects the whole file. Limits: 2 MB, 5000 rows. Tags inside a cell are separated by `|`.

Preview row status: `new` · `restore` (soft-deleted word comes back, same id) · `duplicate` (same data, or
repeated in the file: first row wins) · `changed` (saved word, file brings different pinyin/meaning/tags:
skipped unless the user ticks "update changed") · `error`. Warnings (pinyin differs from pinyin-pro, no tone
marks, non-Chinese characters) never block a row and never rewrite data. Only fields present in the file can
update a saved word. `commitImport` writes everything in one transaction and re-checks the database.

**Future improvement:** persist `pinyinSource: 'user' | 'generated'` on `Word` (needs IndexedDB v2 +
backup v2 migration). In M2 the "generated" mark exists only in the import preview.

Pipeline: `parse → enrich → preview → commitImport` (dedupe, one transaction). Card creation for imported words arrives with M4.

### Backup format

`{ schemaVersion, exportedAt, decks, words, cards, reviewLogs }`. Import validates the schema version and runs migrations before writing.

- **Import replaces all local data** in a single transaction (all-or-nothing: on any failure the previous data stays intact). The UI must confirm before importing.
- **Merge** (combining a backup with existing data by `id`/`updatedAt`) is deferred until cross-device sync exists.
- `Character` rows are not exported; they are derived from Words and rebuilt after import.

## 6. Dictionary

- `scripts/build-cedict.ts` downloads CC-CEDICT, parses it and writes JSON shards to `public/data/cedict/` keyed by first character (bucketed).
- Shards are fetched lazily and cached by the service worker (no full precache).

## 7. Licensing

| Asset                                                     | License                          | Obligations                                  |
| --------------------------------------------------------- | -------------------------------- | -------------------------------------------- |
| App code                                                  | MIT                              | —                                            |
| CC-CEDICT (and derived shards)                            | CC BY-SA (3.0 per official site) | Attribution; derived data under same license |
| Hanzi Writer library                                      | MIT                              | Notice                                       |
| Hanzi Writer stroke data (Make Me a Hanzi / Arphic fonts) | Arphic Public License            | Ship unmodified with `ARPHICPL.TXT`          |

All data licenses live in `public/data/LICENSES/` and are linked from the About page.

## 8. iOS PWA constraints

- Home Screen app storage is separate from Safari tab storage → onboarding tells the user to import inside the installed app.
- No guaranteed persistence: call `navigator.storage.persist()` (best effort) and keep backup prominent.
- Web Push only for installed apps on iOS ≥ 16.4; not used in MVP.
- Known iOS 26 IndexedDB issue in PWAs using push — another reason to avoid push for now.

## 9. Non-functional

- Works fully offline after first load (except first fetch of a dictionary shard / stroke data).
- Review screen usable one-handed on iPhone; touch targets ≥ 44 px.
- Domain and db layers ≥ 80% test coverage.
