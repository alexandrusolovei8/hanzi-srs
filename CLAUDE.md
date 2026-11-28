# CLAUDE.md

Offline-first PWA for learning Mandarin (hanzi + pinyin) with FSRS spaced repetition and stroke-order practice. Target: iPhone Safari (installed to Home Screen) + desktop browsers. See `SPEC.md` (product/data model) and `ROADMAP.md` (milestones).

## Language rules

- Code, identifiers, comments, commits, PRs and technical docs: **English**.
- Conversation with the user: **Spanish**.
- UI strings: English. Word meanings are user-editable (CC-CEDICT fills English by default).

## Commands

> Scaffolded in M0 — update this section if scripts change.

- `npm run dev` — Vite dev server
- `npm run build` — type-check + production build (`dist/`)
- `npm run preview` — serve the production build at `http://localhost:4173/hanzi-srs/` (test PWA/offline here, not in dev)
- `npm run typecheck` — `tsc -b` only
- `npm test` — Vitest (unit + component); `npm run test:watch` for watch mode
- `npm run test:coverage` — tests + coverage gate (≥80% lines/branches/functions/statements on `src/domain` and `src/db`)
- `npx vitest related <files>` — tests affected by given files
- `npm run lint` (zero warnings) / `npm run format` / `npm run format:check`
- `npm run generate-pwa-assets` — regenerate icons in `public/` from `public/icon.svg` (commit the output)
- `npm run e2e` — Playwright (WebKit, iPhone viewport) — _not yet added (M4/M5)_
- `npm run build:cedict` — regenerate dictionary shards — _not yet added (M3)_

CI (`.github/workflows/ci.yml`) runs `npm ci` → lint → format:check → test:coverage → build, then deploys `dist/` on push to `main`. Run the same sequence locally before committing.

## Claude Code hooks (`.claude/settings.json`, scripts in `.claude/hooks/`)

- **PostToolUse (Edit|Write):** Prettier + `eslint --fix` on the edited file; remaining lint errors are reported back (exit 2) and must be fixed.
- **Stop:** `tsc -b` + `vitest related` on uncommitted code (full suite if config changed). Blocks once on failure; on the automatic retry it only warns (`stop_hook_active`). Skips when nothing changed since the last green run.
- Hooks are Node scripts run without a shell (Windows/Linux parity). Add imports before their first use in a file, or the per-edit lint will flag the intermediate state.

## Dependencies

- Exact versions only (`.npmrc` has `save-exact` + `engine-strict`). Resolve versions with `npm view`, check `peerDependencies`/`engines` before bumping.
- Known pins: `typescript` 6.0.x (typescript-eslint requires `<6.1`); `jsdom` 29.x (30+ needs Node ≥24.15).
- GitHub Actions are pinned to commit SHAs with the tag in a comment.

## Architecture

```
features/* (React UI)  ──useLiveQuery──►  db/ (Dexie repositories, migrations, backup)
        │                                     ▲
        └──────────► domain/ (pure TS) ◄──────┘
importers/csv ──► importers/preview (+ enrich/pinyin-pro) ──► db repos.imports.commit
Service worker: precache app shell; runtime-cache dictionary shards + Hanzi Writer stroke data
```

- `src/domain/` — pure TypeScript: types, FSRS scheduling wrapper, card generation, stats. **No React, no Dexie, no `Date.now()`** — inject a `Clock` / `IdGenerator` (`EntityDeps`). Test fakes in `domain/test-utils/` (`fakeDeps`, `makeCard`, `makeReviewLog`).
- `src/platform/` — real implementations of domain ports (`systemClock`, `uuid`, `systemDeps`). The only place allowed to read the wall clock or generate UUIDs.
- `src/db/` — the only module that touches IndexedDB.
  - `schema.ts`: `DB_VERSIONS` is append-only — never edit a shipped version; add a new one (with `upgrade` if rows change) + a migration test.
  - `repositories/`: return `Result<_, RepoError>`, hide soft-deleted rows, wrap multi-table writes in transactions. Word dedupe (deck + hanzi) lives here, restoring soft-deleted words.
  - `backup/`: export / validate / migrate / import. Import replaces all data in one transaction. Changing the backup shape requires bumping `BACKUP_SCHEMA_VERSION` + a `BACKUP_MIGRATIONS` step + tests.
  - Tests: `createTestDb()` gives an isolated fake IndexedDB per test; `setupRepos()` adds repositories + fake clock.
- FSRS fields follow `ts-fsrs` 6.x / FSRS-7 names (see SPEC §5 "FSRS alignment"); dates stay epoch ms.
- `src/importers/` — each importer is an independent module implementing `Importer` and registered in `importers/index.ts` (only `csv` for now). Input is untrusted: strict UTF-8 (`decode.ts`), size/row limits, `Result` errors with user-facing text in `messages.ts`. `preview.ts` is pure; pinyin-pro sits behind the `PinyinTool` port. Format: `docs/import-format.md`; templates in `public/templates/` (tested by `templates.test.ts`). CSV fixtures in `__fixtures__/` keep exact bytes (`-text` in `.gitattributes`, Prettier-ignored).
- `src/dictionary/` — lazy CC-CEDICT shard lookup.
- `src/features/<name>/` — UI per feature (import, review, writing, stats, decks, settings). Screens take repositories as props (tests pass `setupRepos().repos`); `src/services.ts` is the composition root with the real ones. Heavy features are `React.lazy` chunks (import → pinyin-pro).
- `src/ui/` — shared presentational components.

## Conventions

- TypeScript strict; no `any` (use `unknown` + narrowing). Prefer `Result`-style returns over throwing in parsers.
- All entities: UUID `id`, `createdAt`, `updatedAt`, optional `deletedAt` (soft delete). `ReviewLog` is append-only. These keep the model sync-ready — don't break them.
- Timestamps stored as epoch ms (number). Day boundaries computed in `domain/` with the user's timezone.
- Tests live next to code (`*.test.ts`). Every domain/db/importer change ships with tests. Use `fake-indexeddb` for db tests.
- No new runtime dependency without stating why in the PR/commit body.
- Small commits, Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).

## Data licensing (do not violate)

- CC-CEDICT → CC BY-SA. Derived shards stay BY-SA; keep attribution in `public/data/LICENSES/` and the About page.
- Hanzi Writer stroke data → Arphic Public License. Ship unmodified with `ARPHICPL.TXT`.
- App code → MIT (`LICENSE`). Never mix data files into `src/`.

## iOS PWA gotchas

- Home Screen app storage is **separate** from Safari tab storage.
- Storage may be evicted; always keep backup export reachable and remind the user.
- Test offline/PWA behavior with `npm run preview` or the deployed site, never `dev`.
- No Web Push in MVP.

## Deploy

GitHub Pages via GitHub Actions on push to `main`. Vite `base` is `/hanzi-srs/`.
