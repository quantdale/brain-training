# Campaign 015 — causal workout attribution continuation checkpoint

**Checkpoint status:** session checkpoint; Campaign 015 remains ACTIVE.
**Start SHA:** `299a8313cd403f0255caae7af27f850f2fac7e16`
**End implementation SHA:** `60fdadcbfa5cd4a0ca239fcf2e7de0e61e59a9a5`
**Canonical branch:** `main` (pushed; clean at checkpoint creation)
**Commit:** `60fdadc` — `015: enforce causal workout completion attribution`

## Completed in this continuation

- Reconciled the pulled `origin/main` tree and active Campaign 015 records.
- Replaced timestamp/recency workout ownership with exact
  `(instanceKey, legIndex, gameId)` provenance from route through the shared
  game host into persisted session raw-result JSON.
- Added exact-session lookup and a conditional transactional one-shot advance;
  legacy and standalone sessions remain readable but cannot claim a workout.
- Added route, host, persistence, duplicate/relaunch, two-instance, stale-leg,
  and data-portability coverage.
- Updated `validate-affected` for the shared game-host surface and reconciled
  campaign/state/known-issue/validation/OpenSpec evidence.

## Validation evidence

- Focused attribution seam: **22 suites / 255 tests PASS**.
- Typecheck: **PASS**. Lint: **PASS** (0 errors / 0 warnings).
- Repository state, task ownership, strict affected-area plan, registry,
  provenance, offline boundary, and QA self-test: **PASS**; QA self-test
  **49/49**.
- Pinned OpenSpec `@fission-ai/openspec@1.6.0`: **3/3 PASS**.
- Web export: **PASS** (20 routes / 47 bundles). Expo Doctor: **21/21 PASS**.
- Full local Jest: **487 passed suites, 1 timed-out suite, 4 skipped suites;
  6,040 passed tests, 1 failed test, 5 skipped tests**. The one timeout is
  `language-word-scramble` under the full two-worker load; three isolated
  repetitions passed, so no timeout-hiding code change was made.
- Exact pushed-SHA CI: App CI `33121115984` **PASS**; Repository Integrity
  `33121116078` **PASS**. Both target `60fdadcbfa5cd4a0ca239fcf2e7de0e61e59a9a5`.
- Android: designated `braintraining-qa36` boot attempts did not register
  with ADB within 60 seconds; current-head gameplay/workout journeys are
  **NOT VALIDATED**. No foreign emulator was used. iOS and manual system-sheet
  validation remain **NOT VALIDATED** under host/policy limits.

## Remaining work / next action

Keep Campaign 015 ACTIVE. The next continuation should address or make an
explicit evidence decision about the local full-suite timeout and retry the
dedicated AVD when emulator stability permits; only then evaluate the 015
completion gate. Proposed Campaign 016 remains unopened, and no game #43 or
hardening campaign is authorized.
