# Campaign 009 — Architecture debt candidates for the NEXT campaign (W16)

Author: W16 · Read-only audit; no code changed. Six concrete candidates,
ordered by recommended priority. Each has evidence (file:line), rationale,
effort estimate, and risk. Deliberately scoped as next-campaign work, not
current scope creep.

---

## D1. Shared GameHost consolidation — extract the per-game boilerplate

**Priority: 1 · Value: HIGH · Effort: MEDIUM-LARGE (2–3 swarm waves) · Risk: MEDIUM**

Evidence (identical scaffolding duplicated in all ~36 game screens):

- `newSessionId()` / `randomSeed()` re-defined per screen — e.g.
  `games/attention-odd-one-out/screen.tsx:78-85`, with 35+ more copies
  (`grep "function newSessionId" src/games` → 36 hits).
- AppState auto-pause effect copy-pasted in every screen (e.g.
  `games/attention-odd-one-out/screen.tsx:339-346`,
  `games/flexibility-task-switch/screen.tsx:391`, etc.).
- Tutorial open/complete/skip wiring, QA-panel gating (`isDevBuild()`),
  intro/difficulty/start layout, pause/resume plumbing repeated everywhere.
- Scale indicator: a single game screen is ~600 lines
  (`attention-odd-one-out/screen.tsx`, 596 lines), majority boilerplate.

Rationale: every new game re-implements the same contract surface; a fix to
pause/back/QA semantics must touch 36 files today (this campaign's W-workers
each patched their own copies). A `<GameHost>` component + `useGameSession`
hook owning session id/seed creation, AppState pause, tutorial lifecycle, QA
panel, intro layout, and pause-overlay mount would reduce each game to its
reducer + generator + view.

Risk & mitigation: big-bang is dangerous; migrate per category
(attention → speed → …) with the existing visual-baseline snapshots
(`src/app/__tests__/__snapshots__/visual-baselines.test.tsx.snap`) and
per-game screen tests as guardrails.

## D2. Backup transport production wiring (device persistence)

**Priority: 2 · Value: HIGH · Effort: SMALL-MEDIUM (1 wave) · Risk: LOW-MEDIUM**

Evidence:

- `src/data-portability/transport.ts:34-55` ships only
  `createMemoryTransport()`; the header comment explicitly defers filesystem/
  share/picker wiring ("PRODUCTION INTEGRATION (owner: merge session)").
- None of `expo-file-system` / `expo-sharing` / `expo-document-picker` are in
  `apps/mobile/package.json`.

Consequence: on device, export/import never reach disk — backups die with the
process. The engine (`serialize/apply/checksum/wipe`) is complete and tested;
only the seam is unwired.

Proposal: one packet implementing `FileBackupTransport`
(expo-file-system under `documentDirectory`), share-sheet handoff
(expo-sharing) and restore via DocumentPicker. Requires a parent manifest
commit (shared hotspot). Genuinely cross-platform-sensitive: Android SAF vs
iOS document picker semantics differ; see xplat-audit A4/B7 for permission and
backup-restore interactions.

## D3. Session identity + sync-readiness seams

**Priority: 3 · Value: MEDIUM (cheap now, expensive later) · Effort: SMALL · Risk: LOW**

Evidence:

- Session ids are wall-clock+random strings duplicated per game:
  `` `${GAME_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}` ``
  (`games/attention-odd-one-out/screen.tsx:83-85` and 35 siblings). Not
  collision-safe across devices; depends on device clock.
- Schema is timestamp-rich but identity-poor: epoch-ms `created_at`/
  `updated_at` everywhere (`db/schema.ts:40-41,85,138,178,…`), no
  device-instance id or uuid columns.
- Good seed already present: `currency_ledger.operation_id` idempotency key
  (`db/sessions.ts:47-48`).

Proposal: move id generation into the shared SDK (single collision-safe
generator, `crypto.randomUUID` with Hermes-safe fallback); add a migration for
a device-instance id while the catalog and user base are small. Defer full
sync design; freeze only the seams. Note: `db/schema.ts` + `migrate.ts` are
W10-owned this campaign — next-campaign work only.

## D4. Performance instrumentation program

**Priority: 4 · Value: MEDIUM · Effort: SMALL-MEDIUM · Risk: LOW**

Evidence: zero perf marks/metrics in `src` (the only `performance` reference
is the monotonic clock, `sdk/timing.ts:21-26`). QA artifacts capture
screenshots/logs but no frame timings or DB-write durations. Games update
countdown text per tick (e.g. `attention-odd-one-out/screen.tsx:369`) — fine
today, unmeasured at 120 Hz.

Proposal: lightweight, dependency-free instrumentation — marks around
game-start→first-interaction latency, session-completion DB write duration,
progress-list scroll jank; emit into the existing structured-log/QA-artifact
pipeline. Constitution-aligned (QA observability requirements) and cheap.

## D5. Accessibility hardening program (continue what W12 started)

**Priority: 5 · Value: MEDIUM-HIGH · Effort: MEDIUM · Risk: LOW**

Evidence:

- `components/a11y.ts` (MinTouchTarget contract) landed during this campaign
  and was adopted by shell screens (`app/results.tsx:15,77`,
  `app/game-detail/[id].tsx`, `data-management.tsx`, tab bars) — but
  `components/game-ui/*` (GameButton, DifficultySelector) do not consume it
  yet.
- Font-scaling caps absent tree-wide; single `allowFontScaling={false}` at
  `games/attention-symbol-tracker/components/cell.tsx:79` (xplat-audit B1).
- Glyph-stimulus fallback strategy undefined (xplat-audit B2).

Proposal: dedicated campaign packet set — game-ui touch-target sweep, font-
scale caps plus tests at fontScale 2.0, per-template screen-reader walkthrough
scripts, dark-mode contrast audit of `theme/tokens.ts`. Builds directly on the
visual-baseline snapshot infrastructure.

## D6. Catalog/content-pack architecture — explicitly DEFER

**Priority: 6 (defer until ~60 games) · Value: LOW now · Effort: LARGE later · Risk of doing now: MEDIUM**

Evidence: `src/content/registry.ts|storage.ts` and per-module `game.json` +
generated registry (`scripts/generate-game-registry.mjs`) scale fine at 38
modules. The real present-day inconsistency is convention drift across modules
(duplicated `versions.ts` shapes, difficulty naming), not packaging.

Recommendation: do **not** centralize now — the constitution favors
independently editable modules and forbids shared-file hotspots; a content-pack
loader would create exactly that hotspot prematurely. Revisit when the catalog
doubles or when a second non-word content pack (e.g. image packs) forces the
abstraction. Near-term alternative: lint/convention checks enforcing module
layout consistency instead of new architecture.

---

### Explicitly considered and rejected as debt candidates

- **Result-screen consolidation:** `/results` is already a single shared route
  (`app/results.tsx`) consumed by all games via `?id=`; no per-game result
  screens exist. No consolidation debt found.
- **Navigation restructure:** the tabs-vs-stack split
  (`app/_layout.tsx:188-199`) is deliberate and documented; NativeTabs
  constraints are handled correctly.
