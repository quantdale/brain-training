# Wave 14 — Convergence, device certification and release (tasks 14.1–14.8)

**Terminal build:** release APK SHA-256 prefix `14cb165b05d2f234` (waves 6–13
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

## 14.2 — 42/42 active-board device verification

All 42 games were individually played on the converged release build
(`after-game-status.jsonl` + `after-captures-games/` — 173 images): per game
the tutorial/intro, active board on the stage panel, pause overlay, in-round
feedback, and the staged result artifact were captured; 42/42 verdicts
`ok` (four required dedicated completion drivers: memory-pair-recall,
memory-running-order, logic-code-cracker, spatial-transform-match — all
closed `ok`). Boards visibly speak their domain hues (e.g. spatial-transform-
match's green pattern grids, memory's pink reveals) with the CTA red reserved
to single actions.

## 14.3 — Theme/size matrices and accessibility

- Canonical 11-surface harness: **22/22 PASS** at default light/dark, **22/22**
  at compact (720×1600@320), **22/22** at font-scale-2 light/dark
  (`after-matrix-{default,compact,fs2}/manifest.json`).
- Accessibility audits (`scripts/qa/a11y-audit.mjs`): default **0 violations**,
  font-scale-2 **0 violations**, compact: 0 real violations — 2 flagged
  `undersized` nodes are capture-edge clips of the below-fold streak-buy
  row: on-device scroll verification measured `streak-buy-recovery` at
  **114px ≈ 51dp** (≥44dp floor) when scrolled into view (scroll is allowed
  per the product-experience spec); 14 further `occluded (screen-edge/tab-bar)`
  nodes excluded as unmeasurable by the auditor.
- 20 route-level after captures (`after-captures-wave45/`) + 173 game
  captures (`after-captures-games/`).

## 14.4 — ARTEMIS runtime journeys

- **Flash smoke: PASS.** Session `web_1791241358_8673fd7b` (trace
  `web_1791241358_8673fd7b_PASS_2026-10-06T07-02-41`): launch + Home primary
  action verified by the independent controller; run status success
  (`✅ Automation ... is success ✅`; trace-step compilation was degraded by
  transient Google 503s during step summarization — the automation itself
  succeeded).
- **Pro stateful journeys: BLOCKED (LLM provider capacity).** Seven attempts
  across 2026-10-05/06 (`076-pro-first-run-workout`, `-retry`, `-retry2`,
  `-attempt4` … `-attempt7`, including 10–30-minute provider cool-downs before
  retries 5–7) each failed inside the ARTEMIS operator on provider grounds —
  dominated by 429 Too Many Requests (30+ events in the final attempt alone),
  503 UNAVAILABLE, and `TimeoutError: LLM call timed out after 180 seconds`.
  The provider (Google capacity) showed the same saturation all day on this
  host. Recorded BLOCKED across 7 evidence-backed attempts; NOT worked around
  with host-input automation masquerading as controller-led journeys.
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
- Coverage: every player-facing route + all 42 games with matched before
  (`d631ab9a…`) / after (`14cb165b…`) captures; theme/size/recovery matrices;
  per-game manifests. Residual debt (recorded, non-blocking): ARTEMIS Pro
  lane provider-BLOCKED (fallback lane used), iOS NOT VALIDATED, the
  capture-edge measurement artifact documented in 14.3, and the pre-existing
  manual boundaries (human TalkBack quality, physical/OEM devices, store
  signing) carried from prior campaigns.
- No game missing: 42/42 device-verified; no route unreviewed (17/17 routes
  in the inventories + matrices).

## 14.8 — Durable state

- `.agent/CURRENT_CAMPAIGN.md`, `.agent/STATE.md`, `change.json`, this file,
  and the OpenSpec tasks ledger updated at the close; work committed and
  pushed to `origin/main`; no abandoned worktrees or branches.
