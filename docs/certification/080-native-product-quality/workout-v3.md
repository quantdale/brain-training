# Workout V3 native lifecycle report — Campaign 080 (FINAL ENGINEERING)

Date: 2026-10-23
Status: **VERIFIED NATIVELY — full lifecycle, reward attribution and idempotency**
Driver: `scripts/qa/workout-journey.mjs` (rebuilt this session)
Evidence: `qa-artifacts/080/workout-v3-journey.json` + run-stamped
`qa-artifacts/080/workout-v3/<stamp>/` (per-step screenshots, WAL-consistent DB
snapshots `pre`/`post`/`persisted`, reward reconciliation block)

## Build identity

| Field | Value |
|---|---|
| Installed APK sha256 | `15fe8db35441678a…` (full value in the journey JSON) |
| versionName / versionCode | `0.1.0` / `1000` |
| Tested application source | `ba15ae58` (application source unchanged since) |
| Device | emulator-5554 (dedicated AVD `braintraining-qa36`) |
| Test profile | local QA profile, baseline 45 sessions / 150 coins / Level 4 |

## Journey — every required step executed

| # | Step | Result |
|---|---|---|
| 1 | Cold start → Home | OK |
| 2 | Generated plan verified (UI window == durable plan head, in order) | OK — `2026-10-22`, legs: memory-prospective-cue, math-number-line-estimation, speed-quick-compare, attention-odd-one-out |
| 3 | Workout started via `home-workout-continue` | OK (game surface with workout context) |
| 4 | Leg 1 played to results (real taps: 21) | OK |
| 5 | Transition to next leg observed (results `workout-progress`, `next-context`/`next-title`) | OK |
| 6 | Leg 2 played to results (11 taps) | OK |
| 7 | Controlled interrupt after leg 2 → terminate → relaunch | OK |
| 8 | Resume surface verified (`2/4`, "Continue today's workout with Quick Compare", legs "Done") | OK |
| 9 | Legs 3–4 played to results (11 / 7 taps) | OK |
| 10 | Workout-complete state ("Workout complete", "4 of 4 games played") | OK |
| 11 | Result records + reward reconciliation (DB) | OK — see below |
| 12 | No duplicate rewards | OK — zero duplicate operation-ids / session credits |
| 13 | Persistence across another restart | OK — rows byte-stable |
| 14 | Abandoned/quit workout scenario | OK — see below |

All four legs ended in **results through real input**. Sessions record their
true (low) scores — the automation plays but does not solve these games;
`normalizedResult` values in the ledger are the honest outcome of real play and
nothing in this report claims skilled performance.

## Reward attribution — reconciled from the authoritative database

- 4 `game_sessions` rows, each carrying exact workout provenance in
  `raw_result_json.workoutProvenance`:
  `(instanceKey=2026-10-22, legIndex=0..3, gameId=<planned game>)`.
- Session XP: **+40** (4 × 10; `xp_awards` correctly empty — quest/achievement
  rewards only).
- Coins: **+8** in 4 `currency_ledger` rows, `reason=gameplay`, one per session,
  each with an idempotent `operation_id = gameplay:<sessionId>`.
- **Ledger balance consistent**: ledger delta (+8) == `currency_balance` delta
  (+8); UI agrees exactly (775→815 XP, 150→158 coins).
- **No duplicate rewards**: zero duplicate `operation_id`s (schema-enforced
  unique index + observed), zero duplicate (session, reason) credits; the
  interrupt/relaunch/resume boundary produced no re-attribution.
- Quests: quest-progress rows advanced (row-level deltas in the evidence).
  Achievements: unchanged — thresholds genuinely not reached (not claimed).
- Workout instance `2026-10-22` → `completed`, `current_index=4`.

## Abandoned/quit workout scenario

A focus-template workout was started through the product UI (its leg-1 intro
rendered with workout context), then abandoned **at zero play** via the
product's quit ladder. Verified: `noPhantomRewards=true` (0 sessions, 0 ledger
rows, 0 xp awards landed), the instance stayed durable (`active`, resumable),
and the daily skip control's boundary was recorded honestly — `home-workout-skip`
reports "Skip unavailable" once today's daily is complete (skip is daily-only by
source contract: `use-workout.ts#skipCurrentLeg` reads `getByDate(date)`).

## Prior blocker — resolved

The 2026-10-21 run could not finish a leg ("driver's generic taps reach the
board but do not solve answer-driven legs"). Root causes found and fixed this
session in the SHARED action policy (`scripts/qa/gameplay-actions.mjs`, now used
by sweep + workout drivers, 11 unit tests):

1. Round-ENTRY affordances (`briefing-start`, `start`, `go`, `begin-round`)
   were not in any action family — games idled on briefings/intros (pinned
   regression: `memory-prospective-cue` ran 80 passive iterations without one
   tap; it completes in 21 taps with the entry family).
2. Informational `briefing-chip.N` decorations matched the answer-selector
   regex and were tapped as fake answers while `briefing-start` waited.
3. The workout driver itself had an infinite regex-parsing loop and no
   round-tracking reset (both fixed with tests).

## Not claimed

- Skilled play, high scores, or answer-derived gameplay (scores are real but low).
- Physical-device results (external).
- A QA force-win path (the installed release build hides dev-only panels; all
  completion is genuine play/failure — as required).
