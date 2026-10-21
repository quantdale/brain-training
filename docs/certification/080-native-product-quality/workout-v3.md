# Workout V3 native lifecycle report — Campaign 080 continuation

Date: 2026-10-21
Status: **DRIVER READY, JOURNEY NOT YET EXECUTED — device time consumed by the
42-game revalidation sweep; recorded honestly (NOT VALIDATED).**

Delivered this continuation: `scripts/qa/workout-journey.mjs` — a deterministic
emulator-local driver for the full required sequence (home → plan verification
→ start → legs played by real inputs → automatic advancement → interrupt →
terminate/relaunch → resume → completion → reward/no-duplicate-attribution
evidence), step-bound to before/after hierarchy observations with screenshots,
same evidence discipline as the corrected sweep. Workout surfaces verified to
exist and be instrumented: `home-workout-cta/continue/plan/list/selected/
progress/complete(+panel)`, game-host `workout-context`, results
`next-game` / `finish-workout` / `workout-complete` / `workout-progress` /
`workout-advance-*`.

Constraint recorded: QA force-win hooks are disabled in the installed release
build, so legs must be played by real inputs (or reach legitimate failure) —
the driver uses the proven family-tap strategy.

Exact next action: run
`node scripts/qa/workout-journey.mjs --max-legs 5` on the dedicated AVD, then
verify reward rows via the data-management counts surface; expected runtime
~15 min. No product defect is claimed or implied by this status.
