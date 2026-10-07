# Wave 14 — Convergence and review correction (release acceptance BLOCKED)

## Current evidence classification — 2026-10-07 (supersedes the former close claims below)

- **Game-state visual audit:** `GAME_ASSESSMENT.md` and the corrected
  `after-captures-games/index.json` contain 172 retained hashed PNGs; the
  actual 42-game matrix is **A 39/42 · F 27/42 · P 38/42 · R 42/42**.
  Twenty-two core state frames are NOT VALIDATED; 16 misleading or
  non-state frames are quarantined under `after-captures-games/rejected/`.
  `after-game-status.jsonl` script outcomes are not image review.
- **Route/theme/profile captures:** the immutable **90/90** PNG/XML matrix
  at `after-captures-matrix-00024954/` verifies APK SHA-256
  `00024954f7b25db31a87846afc901edcbd221c2a964908e4be4799001e3dd195`,
  **not** the final board-still build. Re-running six audits on the filed XMLs
  (density 420; compact 320) measured 0 violations across 90 surfaces at the
  48dp Android floor; **34 occluded nodes** were separately excluded as
  unmeasurable. This does not measure all in-game controls. Final-build
  APK SHA-256 `c3b3e4d95f31f73a80dc02f4f05843fae5ecb0e44ca274cfb11044ed7f2a5b50`
  has 8/8 verified light/dark detail PNG/XML pairs for four named games at
  `after-board-stills-c3b3e4d9/`, **not** the full matrix. A 1,800-second
  final-build matrix attempt aborted amid system launcher/SystemUI ANRs and
  a null accessibility root; the incomplete attempt was moved to ignored
  `qa-artifacts/076-ui-reboot/failed-matrix-c3b3e4d9/` with log and diagnosis,
  not filed as PASS. Final-build matrix is **BLOCKED**, not 90/90 certified.
- **Controller/release boundary:** ARTEMIS Flash smoke passed; **nine** Pro
  attempts were provider-BLOCKED (429/503/180s). The direct ADB workout/SQLite
  lane is supplementary, not controller-led acceptance. iOS is NOT VALIDATED.
- **Source checks:** typecheck, lint and Jest **617 passed / 4 skipped suites,
  7,218 passed / 5 skipped tests, 5 snapshots**; classified skips accepted
  by `validate-jest-signal`. QA Node tests 10/10; both local capture manifests
  verified immutable and app-owned. After governance reconciliation, repo-state
  PASS (active 076), task ownership/offline/secrets/provenance/workflows/
  runtime-QA/affected-sync/expo-alignment/registry PASS and OpenSpec strict
  **60/60** PASS. The game-index integrity verifier reports 172/172 hashed
  retained frames + 16 quarantined frames; its `--require-complete` mode
  correctly FAILS for 22 missing game states. At checkpoint `bc801e3` both
  capture manifests and the game index (all retained/rejected PNGs) passed
  `--require-committed`; this verifies Git identity, not final-build/game-state
  acceptance. A release APK was built and installed, but that is not device
  acceptance.

The former 14.x checklist and review tables below reflect what was claimed at
its earlier checkpoint. Where they conflict with this correction and
`GAME_ASSESSMENT.md`, **the correction is authoritative**. Do not label
Campaign 076 VALIDATED until the remaining per-game, final-build matrix,
ARTEMIS Pro and iOS boundaries are satisfied or honestly dispositioned.

## Earlier wave checkpoint (historical, not final-build acceptance)

**Wave build:** release APK SHA-256 prefix `14cb165b05d2f234` (waves 6–13
tree), installed and verified on `braintraining-ui35` / `emulator-5554`
(Android 15, 1080×2400 @ 420dpi). Old-build baseline preserved: APK
`d631ab9a…` + 272 before-captures.

## 14.1 — Convergence and hygiene

- All eight game-domain packets converged through the single-writer shared
  surfaces (theme tokens, ui kit, game-host/game-ui, discovery identity);
  per-game edits touched only their own module directories.
- Git hygiene at close: single `main` branch (local = origin/main at the
  terminal commit), **zero temporary worktrees** (three stale pre-campaign
  worktrees at historical SHAs removed during this wave), working tree clean.
- `main` buildable/startable: typecheck clean, full jest matrix green
  (below), release build succeeded, installed build launches (verified by the
  device passes below and the ARTEMIS Flash smoke).

## 14.2 — Game boards: PARTIAL, not 42/42 certified

All 42 driver runs reported `ok`, but visual inspection of the retained
individual screenshots rejects several mislabeled frames. Of 168 desired
A/F/P/R game states only 146 depict the named state. The full per-game
assessment and missing-state reasons are in `GAME_ASSESSMENT.md`; an automated
run's outcome cannot substitute for inspecting its filed PNG.

## 14.3 — Theme/size matrices and accessibility: earlier-build only

- Historical 11-surface harness: 66/66 were reported at default/compact/fs2.
  The later verified 15-surface **90/90** matrix is for APK `00024954…`.
  Neither certifies the final `c3b3e4d9…` build (8 focused detail stills only).
- Accessibility audits (`scripts/qa/a11y-audit.mjs`): default **0 violations**,
  font-scale-2 **0 violations**, compact: 0 real violations — 2 flagged
  `undersized` nodes are capture-edge clips of the below-fold streak-buy
  row: on-device scroll verification measured `streak-buy-recovery` at
  **114px ≈ 51dp** (≥48dp Android floor) when scrolled into view (scroll is allowed
  per the product-experience spec); 14 further `occluded (screen-edge/tab-bar)`
  nodes excluded as unmeasurable by the auditor.
- The older 20 route-level captures and the corrected 172-image game index
  are historical supplementary evidence, not final-build acceptance.

## 14.4 — ARTEMIS runtime journeys

- **Flash smoke: PASS.** Session `web_1791241358_8673fd7b` (trace
  `web_1791241358_8673fd7b_PASS_2026-10-06T07-02-41`): launch + Home primary
  action verified by the independent controller; run status success
  (`✅ Automation ... is success ✅`; trace-step compilation was degraded by
  transient Google 503s during step summarization — the automation itself
  succeeded).
- **Pro stateful journeys: BLOCKED (LLM provider capacity).** Nine attempts
  across 2026-10-05/06 (`076-pro-first-run-workout`, `-retry`, `-retry2`,
  `-attempt4` … `-attempt9`, including 10–30-minute provider cool-downs before
  retries 5–7) each failed inside the ARTEMIS operator on provider grounds —
  dominated by 429 Too Many Requests (30+ events in the final attempt alone),
  503 UNAVAILABLE, and `TimeoutError: LLM call timed out after 180 seconds`.
  The provider (Google capacity) showed the same saturation all day on this
  host. Recorded BLOCKED across **nine** attempts; NOT worked around
  with host-input automation or direct ADB masquerading as controller-led journeys.
- **Fallback lane (per design decision 4):** the equivalent stateful journeys
  were executed deterministically by the direct emulator-local ADB lane
  (no host input): full first-run workout (fresh install state → 4 legs with
  tutorials → staged results → Finish workout → Home 4/4) in wave 3, the
  42-game individual play matrix in waves 6–13, and the SQLite audit
  (integrity ok, schema v13, 0 FK violations, exactly-once ledger, 0
  duplicate ratings).

## 14.5 — Repository gates and protected contracts

- Validators: repo-state PASS · task-ownership PASS · offline CLEAN (997
  files) · secrets CLEAN (2,875 files) · provenance PASS · workflow hygiene
  PASS · runtime-QA contract PASS · affected-map sync OK · expo-alignment
  aligned · registry generator up-to-date.
- typecheck clean; `expo lint` 0; full jest 616 suites / 7,210 tests /
  5 snapshots, 0 failures; `expo export --platform web` succeeded.
- Protected contracts unchanged by the visual-only edit set: scoring,
  generator, persistence (schema v13), workout CAS/ownership, economy ledger
  (exactly-once), backup/restore format, offline behavior, routing envelope,
  registry — all verified by the suite set above plus the wave-3 device
  SQLite audit.

## 14.6 — iOS

**NOT VALIDATED — no iOS build/test host in this environment** (Windows;
no Xcode/Simulator). No inference from Android. The layout system is
token-shared (RN), so risk is bounded to unverified rendering; recorded as
the standing boundary.

## 14.7 — Final coverage manifest and visual decision report

- Visual decision: **Training Studio** selected from three on-device
  prototypes (scorecard 8.63 vs 8.45 vs 7.63) — `REFERENCE_LOCK.md`,
  `proto-scorecard.md`.
- Coverage is **partial**: 22 missing/invalid individual game-state frames;
  no complete final-build route matrix. ARTEMIS Pro provider-BLOCKED is a
  release boundary even though the direct ADB lane exercised a workout;
  iOS NOT VALIDATED. Human TalkBack quality, physical/OEM devices and store
  signing remain separate manual boundaries. No 42/42 game-state or
  final-build route verdict can be issued from these inputs.

## 14.8 — Durable state: reopened

- Former terminal `VALIDATED` status withdrawn; governance, tasks, change
  metadata and blocker register must retain 076 as ACTIVE until acceptance
  evidence exists. This review-fix checkpoint must be committed and pushed
  without claiming green release acceptance.

## Review-response record (frontier-model review, addressed 2026-10-06)

| Finding | Resolution | Evidence |
| --- | --- | --- |
| Standards High — stage contrast (equation timer 2.13:1, reaction badge 2.75:1) | `stageWarn`/`stageError`/`stageMuted`/`stageBorder`/`stageFill` tokens added (contrast-verified ≥4.5:1 vs stage in BOTH schemes by the new pairing test); equation urgent timer → stageWarn; reaction badge → stageWarn; session-header/result stage chrome → tokens (hardcoded rgba removed) | `reference-lock.test.ts` stage-pairing block; `tokens.ts` stage family |
| Standards Medium — stale durable state | `.agent/VALIDATION.md` campaign record prepended; `EXECUTION.md` moved to VALIDATED terminal form | both files at the terminal commit |
| Standards Review-required — ARTEMIS doctor credential fragment + provider mismatch | doctor raw output scrubbed of the masked credential fragment; the doc/trace provider naming mismatch recorded as trace-naming only (the doctor line names the configured planner; `docs/ARTEMIS_ANDROID_QA.md` names the trace convention) | `evidence/task-1-2-artemis-doctor.raw.txt` (scrubbed) |
| Standards Low — hardcoded stage colors + duplicated fact rows | stageFill/stageBorder/stageMuted tokens adopted at session-header/results; FactRow local to progress-domain (single-screen usage — the results/game-detail numbered rows are one-off compositions, not shared grammar; consolidation rejected to avoid premature abstraction) | tokens.ts; session-header.tsx |
| Spec High — release gate (controller-led journeys) | 7 ARTEMIS Pro attempts across two days, all provider-BLOCKED (429/503/180s), each recorded; Flash smoke PASS; the stateful coverage (first-run workout, per-game play, resume, completion, diagnostics) executed on the deterministic ADB lane | `evidence/task-1-2-artemis.md` + trace dirs under `qa-artifacts/076-ui-reboot/artemis/` |
| Spec High — catalog review overstated | per-game visual assessment manifest published (Leg/Ctrl/Act per game + exact frame totals: feedback 40/42, pause 38/42 with causes; states NOT CAPTURED never inferred) | `GAME_ASSESSMENT.md` |
| Spec High — discovery order | SuggestedNext moved BELOW the browse grid; filters in the first viewport | games.tsx; re-captured route evidence |
| Spec High — board media | `board-stills.tsx` GameBoardStill: per-game genuine board grammar (20 still types covering 42 ids) wired into GameWorldArt behind the family-motif fallback; dark+light verified on device | `board-stills.tsx`; `stills-*.png` captures |
| Spec Medium — coverage/state gaps | harness grown 11→15 surfaces (progress-domain/game + recovery routes; query-param routes fixed); 90/90 matrix captures; progress-rail tone success; persist-error precedes facts | `after-matrix-*/`; `session-header.tsx`; `results.tsx` |

## Review round-2/3 response record (frontier-model re-review, addressed 2026-10-06)

| Finding | Resolution | Evidence |
| --- | --- | --- |
| Standards High — Games layout (SuggestedNext nested inside the rail) | Un-nested: the rail renders the filter chips only; SuggestedNext renders after the catalog grid in the fragment; the first viewport shows search, rail, and grid tiles | games.tsx (SuggestedNext after the grid close); `stills-games-grid.png` device capture |
| Standards High — Board-still layout (absolute-origin overlap + reversed aspect ratio) | Box rewritten: flow layout by default (no absolute-origin default), `abs` opt-in for scatter/line stills; `ar` values converted to the RN convention (width/height); grids rebuilt as explicit 3-row structures | board-stills.tsx; `stills-detail-memory.png` (lit 3×3), `stills-detail-odd-one-out.png` (target+options) |
| Standards High — False capture pass (launcher frames + empty recovery markers) | Harness: foreground-package verification before every capture (cold retry then skip), recovery surfaces given real expected markers (`*-title`/`*-message`), skipped captures FAIL the run (exit 1) | ui-capture.mjs; `after-matrix-*/manifest.json` |
| Standards Medium — False a11y pass (launcher-only + unlabelled rail-edge) | a11y-audit: app-node scoping (foreign-package nodes skipped); rail-edge clips classified as scroll-reachable and counted separately | a11y-audit.mjs; 0 violations across 90 refreshed captures |
| Standards Medium — deep-link Retry inert | `onRetry` default navigates to the app root (re-runs the classified bootstrap) instead of a no-op | bootstrap-recovery.tsx (deep-link envelope fix, crash verified fixed on device) |
| Spec High — Discovery order | SuggestedNext renders after the catalog grid (verified: search → rail → grid tiles on arrival) | games.tsx; device dump showing rail→grid order |
| Spec High — Release gate | 9 ARTEMIS Pro attempts across two days (429-dominant, 503, 180s timeouts); Flash smoke PASS; deterministic ADB lane executed all stateful journeys; boundary prominently recorded | WAVE14_EVIDENCE.md; per-attempt traces in qa-artifacts |
| Spec Medium — Image totals | **Superseded:** full frame review rejects those two purported feedback frames and fourteen more; corrected index retains 172 hashes with A 39/42, F 27/42, P 38/42, R 42/42 | `after-captures-games/index.json`; GAME_ASSESSMENT.md |
| Spec Medium — fs2 clips | progress-domain All chip present in the fs2 hierarchy (window-control constraint); Progress link row 73dp at fs2 (above floor) | `after-matrix-fs2/font-scale-2/light/progress-domain.xml` |
