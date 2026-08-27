# Durable Project State

**State schema:** 1
**Last update:** 2026-08-26 (Campaign 014 ACTIVE at f4aa44c: W1 depth audit;
W2 13-game mechanical deepening; W3-W6 mastery engine + Daily Spotlight +
Workout V3 signal-ranked ordering + Progress/Home/discovery surfaces; W7
word-scramble distractor integrity; W8 two-week repeated-use simulation over
real sqlite; storage-size visibility. Gates green: tsc, lint 0/0, Jest 483
suites / 5973 tests, registry/provenance/ownership/offline. REMAINING:
Android device journeys (dedicated AVD dropped offline mid-session; foreign
AVD must not be adopted) + docs-final sweep + terminal checkpoint.)
**Canonical branch:** `main`
**Active campaign:** 014-experience-depth-replayability

## Current status

Campaign 014 — Experience Depth & Replayability is **ACTIVE** at
`f4aa44c` (W1–W9 landed and pushed; remaining: Workout V3/canary device
journeys + docs-final reconciliation + game-feel/perf evidence before the
terminal checkpoint). Campaign 013's release gate remains GREEN as the
v1 baseline (42/42 certify, SHA ba6dd84), but active work is 014.

### What landed in 014 (commits eb348dd → f4aa44c, pushed)

- W1 product-depth audit: evidence-driven rubric over all 42 games + major
  shared surfaces (`.agent/CAMPAIGN014_AUDIT.md`).
- W2 13-game mechanical deepening (six parallel packets + orchestrator
  convergence, 968554a): route-path memory, Go/No-Go, proximity spread,
  uncued inference, hidden-source transform improvements, etc.; registry
  regenerated, tsc/lint/Jest 5947 PASS.
- W3–W6 shared depth systems (b36ac42): mastery ladder, Daily Spotlight,
  Workout V3 signal-ranked ordering with truthful per-game reasons
  (metadata v2), discovery shelves, Home/Progress surfaces; Jest 5972 PASS.
- W7–W9 generator integrity + repeated-use proof + storage visibility
  (f4aa44c): word-scramble distractor integrity, deterministic two-week
  repeated-use simulation over real sqlite (mastery climbing, reroll
  economics, Spotlight rollover, export/import round-trip), storageBytes
  visibility; Jest 5973 PASS, 483 suites.
- Harness resilience hardening during closure (2026-08-26): RedBox dismissal
  for cached-bundle fallback, LogBox dismissal, scrolled-Home detection
  (`looksLikeHomeRoute`), shade collapse on launch, 90s recovery budget +
  extended completion-card scroll (device-verified after Metro death + web
  bundle contention left 8081 briefly orphaned; Metro restarted).

### Validation snapshot at f4aa44c (pre-device-journey closure)

- Repo gates: repo-state PASS, registry --check PASS, provenance PASS,
  ownership PASS (014's OpenSpec package is PROPOSED per 015 audit),
  offline CLEAN (919 files)
- tsc CLEAN · eslint 0/0 · doctor 21/21 (last at 013 closure; no dep changes)
- Jest: 483 suites / 5973 tests PASS
- Web export: PASS (20 static routes, last at 013 closure)
- Android: canaries **8/8 PASS** (20260826-114825-autobot-canaries, dedicated
  `braintraining-qa36` / emulator-5554, forced-win + persistence invariants
  + back/next navigation; representative of 014-changed games card-sort +
  transform-match); Workout V3 journeys **in progress after harness
  hardening** — daily warm-home blocked by notification shade (now collapsed
  on launch), focus 4/4 legs PASS then completion-card evidence probe failed
  (now retried with swipe-to-top). Perf: opt-in timing probes NOT VALIDATED
  (honest, statement-count guards green).
- npm audit: 16 build-toolchain-only (unchanged)

### Working state 2026-08-27 (unpushed, emulator blocked)

- App fix (not yet device-proven this session): `advance.ts` + `db/workout.ts` — template-instance first-advance race (`completedAt > updatedAt` blocked fresh-start focus workouts, cascading to 0/N "In progress" forever). Fixed with 10s slack (still rejects historical result views). Daily instance (old `updatedAt`) always passed, so daily-workout E2E was green.
- Harness fix: `scripts/qa/autobot.mjs` — scrolled-Home via any `home-*`, RedBox/LogBox dismissal before dump-error filter, shade collapse, 90s recovery, completion-card swipe-to-top, live-panel no-toggle guard + 62s re-select poll for `home-workout-selected-done`; self-test 49/49 PASS.
- Repo gates (working tree): `validate-repo-state` PASS, `tsc --noEmit` PASS, harness self-test 49/49 PASS. Full Jest / registry / provenance / offline not re-run (targeted advance guard only; statement-count guards green).
- Android: **NOT VALIDATED this session** — `braintraining-qa36` failed to boot after 5 headless attempts (cold + wipe-data, 12 GB free, "did not register with adb within 60s" → segfault, 37.1.x WHPX). Prior dedicated-AVD evidence (canaries 8/8, daily-workout 4/4 + relaunch) remains the last green device evidence. Metro `braintraining-qa36` + `braintraining35` both affected; foreign `Nitro_API_36` not adopted per policy. Honest perf: opt-in probes NOT VALIDATED.

## Authoritative active change

`.agent/CURRENT_CAMPAIGN.md` (campaign 014) + `.agent/KNOWN_ISSUES.md` + `.agent/CAMPAIGN015_AUDIT.md` (015 is PROPOSED planning material).

## Important invariants

- GitHub `main` is canonical; coherent green waves pushed.
- Android-first autonomous QA; one AVD; one Metro; ONE driver per device
  (autobot now enforces this via lockfile).
- No autonomous force-push to `main`.
- Generated files updated only through generators.
- Missing validation is never PASS (`NOT VALIDATED` recorded honestly).
- Deferred product decisions untouched (branding, accounts, cloud sync,
  pricing, ads, AI, social, notifications, store listing).

## Next required action

Close Campaign 014 honestly: dedicated `braintraining-qa36` Workout V3
E2E (daily + focus) + canaries PASS, honest perf/game-feel evidence
record, docs-final reconciliation (README/BACKLOG Workout V3 wording —
done; MASTER_PLAN/PARITY_MATRIX through 014), terminal checkpoint
(`.agent/checkpoints/014-*.md`), COMPLETED status. After 014 is
COMPLETED, atomically activate 015 per `openspec/changes/015-*/EXECUTION.md`.
Remaining debt: pause/resume a11y race (Medium, honest-retry), SAF sheets
(manual), iOS build (NOT VALIDATED on Windows), 16 build-toolchain-only
npm advisories (accepted), opt-in perf probes (NOT VALIDATED until
re-run after 015's targeted changes).

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/CURRENT_CAMPAIGN.md`
5. `.agent/checkpoints/012-broad-convergence-COMPLETED.md`
6. `.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`
