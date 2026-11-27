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
- `npx vitest related <files>` — tests affected by given files
- `npm run lint` (zero warnings) / `npm run format` / `npm run format:check`
- `npm run generate-pwa-assets` — regenerate icons in `public/` from `public/icon.svg` (commit the output)
- `npm run e2e` — Playwright (WebKit, iPhone viewport) — _not yet added (M4/M5)_
- `npm run build:cedict` — regenerate dictionary shards — _not yet added (M3)_

CI (`.github/workflows/ci.yml`) runs `npm ci` → lint → format:check → test → build, then deploys `dist/` on push to `main`. Run the same sequence locally before committing.

## Dependencies

- Exact versions only (`.npmrc` has `save-exact` + `engine-strict`). Resolve versions with `npm view`, check `peerDependencies`/`engines` before bumping.
- Known pins: `typescript` 6.0.x (typescript-eslint requires `<6.1`); `jsdom` 29.x (30+ needs Node ≥24.15).
- GitHub Actions are pinned to commit SHAs with the tag in a comment.

## Architecture

```
features/* (React UI)  ──useLiveQuery──►  db/ (Dexie repositories, migrations, backup)
        │                                     ▲
        └──────────► domain/ (pure TS) ◄──────┘
importers/{csv,text} ──► importers/enrich (pinyin-pro + dictionary/) ──► db.commitImport
Service worker: precache app shell; runtime-cache dictionary shards + Hanzi Writer stroke data
```

- `src/domain/` — pure TypeScript: types, FSRS scheduling wrapper, card generation, stats. **No React, no Dexie, no `Date.now()`** — inject a clock.
- `src/db/` — the only module that touches IndexedDB. Schema changes require a new Dexie version + migration + test.
- `src/importers/` — each importer is an independent module implementing `Importer` and registered in `importers/index.ts`.
- `src/dictionary/` — lazy CC-CEDICT shard lookup.
- `src/features/<name>/` — UI per feature (import, review, writing, stats, decks, settings).
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
