# SPEC — hanzi-srs

## 1. Goals

1. A daily-use app to learn Mandarin vocabulary (hanzi, pinyin, meaning) with spaced repetition and handwriting practice.
2. A portfolio project demonstrating clean architecture and an AI-assisted workflow with Claude Code.

## 2. Platform

- PWA, installable on iPhone via Safari "Add to Home Screen"; also usable on desktop browsers.
- Offline-first: all data local in IndexedDB. No backend in the MVP.
- Hosting: GitHub Pages (free HTTPS), deployed by GitHub Actions.

## 3. MVP scope

| Feature          | Description                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Import           | CSV file or pasted text (`hanzi[,pinyin][,meaning]`, also tab/semicolon separated). Preview before commit, dedupe by deck + hanzi.   |
| Enrichment       | Missing pinyin → `pinyin-pro`. Missing meaning → CC-CEDICT lookup (English). User can edit any field; `meaningSource` tracks origin. |
| Review (FSRS)    | `ts-fsrs` scheduling. Ratings Again/Hard/Good/Easy. Every review appends a `ReviewLog`.                                              |
| Card kinds       | `recognition`: hanzi → meaning + pinyin. `production`: meaning → write hanzi (Hanzi Writer quiz; stroke mistakes suggest a rating).  |
| Writing practice | Free stroke-order practice per character, outside the schedule.                                                                      |
| Backup           | Export/import full JSON backup with `schemaVersion`. Periodic reminder.                                                              |
| Stats            | Due today, reviewed today, streak (days).                                                                                            |

Out of scope (later phases): TTS audio, tone drills, photo → words, cross-device sync, AI tutor agent, push notifications.

## 4. Stack

React 19 · TypeScript (strict) · Vite · vite-plugin-pwa · Dexie 4 + dexie-react-hooks · ts-fsrs · pinyin-pro · hanzi-writer · react-router · Tailwind CSS · Vitest + fake-indexeddb + Testing Library · Playwright (WebKit).
Exact versions pinned in M0 (`npm view <pkg> version`).

## 5. Data model

All entities carry `id` (UUID), `createdAt`, `updatedAt` (epoch ms) and optional `deletedAt` (soft delete) — this makes later sync possible without a painful migration.

```ts
Deck      { id, name, createdAt, updatedAt, deletedAt? }
Word      { id, deckId, hanzi, pinyin, meaning, meaningSource: 'user' | 'cedict',
            tags: string[], createdAt, updatedAt, deletedAt? }        // unique [deckId+hanzi]
Character { hanzi /*PK*/, pinyin: string[], inStrokeData: boolean }   // derived from Words
Card      { id, wordId, kind: 'recognition' | 'production',
            due, stability, difficulty, elapsedDays, scheduledDays,
            reps, lapses, state, lastReview?, createdAt, updatedAt, deletedAt? }
ReviewLog { id, cardId, rating, reviewedAt, durationMs, fsrs: {...snapshot} } // append-only
```

Each new Word creates one `recognition` and one `production` card.

### Importer contract

```ts
interface Importer {
  id: string;                                   // 'csv' | 'text' | ...
  parse(input: string): Result<RawEntry[], ImportError[]>;
}
RawEntry = { hanzi: string; pinyin?: string; meaning?: string; tags?: string[] }
```

Pipeline: `parse → enrich → preview → commitImport` (dedupe + card creation, one transaction).

### Backup format

`{ schemaVersion, exportedAt, decks, words, cards, reviewLogs }`. Import validates the schema version and runs migrations before writing.

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
