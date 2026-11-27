# ROADMAP — hanzi-srs

Execution order: **M0 → M1 → M2 → M4 → M5 → M3** (MVP), then optional **M6**, **M7**.
A usable study app comes before the dictionary. Each milestone ends deployed to GitHub Pages.

Legend per milestone: **Deliverable** · **Acceptance** (how it's tested) · **Claude Code** feature learned · **SE concept** practiced.

---

## M0 — Scaffold & deploy

- [x] Vite + React + TS (strict), ESLint, Prettier, Vitest, Tailwind
- [x] vite-plugin-pwa (manifest, icons, app-shell precache), `base: '/hanzi-srs/'`
- [x] GitHub Actions workflow → GitHub Pages
- [x] Pin dependency versions (`npm view`)

**Status:** done 2026-11-27 — deployed to https://alexandrusolovei8.github.io/hanzi-srs/, CI green, verified on iPhone online and in airplane mode.

**Acceptance:** HTTPS URL opens on iPhone; "Add to Home Screen" launches standalone; shell loads in airplane mode; CI green.
**Claude Code:** CLAUDE.md (refine after `/init`) + permissions in `.claude/settings.json` — the base context every session reads.
**SE concept:** CI/CD and reproducible builds (lockfile, pinned versions, automated deploy).

## M1 — Domain & persistence

- [ ] Domain types (Deck, Word, Character, Card, ReviewLog), injectable clock
- [ ] Dexie schema v1 + repositories
- [ ] Backup export/import with `schemaVersion` + migration framework

**Acceptance:** backup round-trip yields identical data; dummy v1→v2 migration test passes (fake-indexeddb).
**Claude Code:** Hooks — PostToolUse (eslint/prettier on edited files), Stop (`tsc` + `vitest related`), so quality is enforced automatically from the core onwards.
**SE concept:** Layered architecture & Repository pattern; versioned schema migrations.

## M2 — Importers

- [ ] `Importer` interface + registry
- [ ] CSV importer, pasted-text importer (comma/tab/semicolon)
- [ ] Pinyin enrichment with pinyin-pro; preview screen; dedupe; `commitImport` transaction

**Acceptance:** valid & malformed CSV fixtures; pasting `你好` yields `nǐ hǎo`; re-import creates no duplicates.
**Claude Code:** Skill `add-importer` (scaffold module + tests + registration) — a pattern repeated for every new source.
**SE concept:** Input validation & parsing, Strategy/plugin pattern, `Result` types instead of exceptions.

## M4 — FSRS review

- [ ] Card generation (recognition + production) on word creation
- [ ] ts-fsrs wrapper in `domain/`; due queue
- [ ] Review session UI (recognition), ratings, ReviewLog append

**Acceptance:** fake-clock tests (Good pushes `due` forward, Again resets); e2e: complete a session, reload, due count updated.
**Claude Code:** Subagent `test-writer` + `/code-review` — separating author from reviewer.
**SE concept:** Functional core / imperative shell; deterministic tests via dependency injection (clock).

## M5 — Writing

- [ ] Hanzi Writer adapter; self-hosted stroke data with SW runtime cache
- [ ] Production cards (meaning → write hanzi) with mistake-based rating suggestion
- [ ] Free practice mode per character

**Acceptance:** Playwright e2e in WebKit with iPhone viewport; works in airplane mode after first load.
**Claude Code:** MCP (Playwright server) — Claude drives the real app, takes screenshots, verifies touch UI.
**SE concept:** Adapter pattern for third-party libraries; offline-first caching strategies (precache vs runtime cache).

## M3 — Dictionary (CC-CEDICT)

- [ ] `scripts/build-cedict.ts`: download → parse → bucketed JSON shards
- [ ] `dictionary/` lazy lookup; meaning enrichment in import pipeline
- [ ] About/attribution page; `public/data/LICENSES/`

**Acceptance:** lookup test on a mini-CEDICT fixture; shard served from SW cache offline; attribution visible.
**Claude Code:** Subagent `license-data-auditor` — checks diffs for license/attribution compliance in an isolated context.
**SE concept:** Data pipelines (ETL), lazy loading & sharding, open-data license compliance.

---

## M6 — Stats & persistence polish _(optional)_

- [ ] Due today, reviewed today, streak (timezone-aware day boundary)
- [ ] `navigator.storage.persist()`; backup reminder every N days; onboarding note on iOS storage

**Acceptance:** streak tests across midnight/timezones; manual check on iPhone.
**Claude Code:** Custom slash commands (`/release`, `/ios-check`) for repeatable checklists.
**SE concept:** Time & timezone correctness; defensive design against platform data loss.

## M7 — Automation _(optional)_

- [ ] `anthropics/claude-code-action` for PR review
- [ ] Headless `claude -p` step in CI
- [ ] Scheduled workflow: check dependency updates & new CC-CEDICT release → open issue

**Auth note:** works with a Pro subscription — run `claude setup-token` locally, store it as repo secret `CLAUDE_CODE_OAUTH_TOKEN`, pass it via the `claude_code_oauth_token` input. Usage counts against Pro limits; no API billing required. (API key needed only for shared org secrets.)
**Acceptance:** a test PR receives an automated review; scheduled job opens an issue.
**Claude Code:** Automation — Claude outside the terminal (CI, scheduled jobs).
**SE concept:** DevOps automation, LLM-in-the-loop code review, scheduled maintenance jobs.

---

## Later phases (post-MVP)

TTS audio · tone drills · photo → words · cross-device sync (Dexie Cloud or small backend) · AI tutor agent · push notifications.
