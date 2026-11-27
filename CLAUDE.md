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
- `npm run preview` — serve the production build (test PWA/offline here, not in dev)
- `npm test` — Vitest (unit + component)
- `npx vitest related <files>` — tests affected by given files
- `npm run e2e` — Playwright (WebKit, iPhone viewport)
- `npm run lint` / `npm run format`
- `npm run build:cedict` — regenerate dictionary shards (M3)

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
