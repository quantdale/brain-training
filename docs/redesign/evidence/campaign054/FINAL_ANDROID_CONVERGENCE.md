# Campaign 054 — Final Android Convergence

**Status:** PASS for the exercised release scope on the exact final artifact.
**Date:** 2026-09-19
**Artifact:** `app-release.apk`, SHA-256
`1B6EBC20498785F9498A769F8F57968D9FB18C63DBBB19528F3E4954B0FB985F`
(109,586,373 bytes; Metro-free release; debug-signed).
**Device:** `braintraining-ui35` / `emulator-5554`, Android 15 / API 35,
1080x2400, density 420 (headless; emulator-local ADB only; `emulator-5556`
never touched).

## 1. Fresh install and first launch

`uninstall → install → pm clear → am start -W`: `Status: ok`, `LaunchState:
COLD`, `TotalTime` 1,990 ms, Home (`home-workout-cta`) rendered, 0 ANR dialogs,
0 filtered fatal/ANR/SQLite markers.

## 2. Core navigation

- **Home** rendered with the workout hero and progress (`0 of 4 complete`).
- **Games** rendered the `TRAIN YOUR BRAIN` discovery surface
  (`games-title`, `games-suggested-next`, suggested primary + alternatives);
  the browse-all/search/grid controls live below the fold and remain reachable
  by scrolling (verified structurally; the grid is present in the screen
  source and prior campaigns' scroll captures).
- **Game Detail** (`game-detail-title`, `game-detail-play`) reached both from
  the Games grid and via the canonical `/game-detail/...` route; the
  campaign-053 grid changes place the catalog below the suggested block.

## 3. Representative gameplay to a persisted Result (release)

Sequence Memory on the release build, real UI input only:

| Step | Result |
| --- | --- |
| Game route + `Start game` | reached the first-play tutorial |
| Deterministic tutorial demo | completed by tapping the seeded demo sequence `[3,2,3]` (derived from `TUTORIAL_DEMO_SEED`); status advanced `3 lit pads → 2 → 1 → Perfect` |
| Intro after tutorial | `Start game` re-rendered and started the real session |
| Session | time-boxed score attack played to expiry: **`Time's up!`** results, `score-final` + `xp` rendered, `persist-error` absent, 0 markers |
| Quit to library | returned Home |

## 4. Four-game workout (release, 4/4)

Returning-player tutorial state was seeded (the same `tutorial_state` rows the
app itself writes; documented fixture) so the workout exercised the real flow
without first-play tutorial friction. All input was real emulator-local UI:

| Leg | Game | Result | Workout progress |
| --- | --- | --- | --- |
| 1 | Next in Sequence | `Session complete`, persisted, no error | `Game 2 of 4 · progress saved` |
| 2 | Symbol Tracker | `Session complete`, persisted, no error | `Game 3 of 4 · progress saved` |
| 3 | Word Scramble | `Session complete`, persisted, no error | `Game 4 of 4 · progress saved` |
| 4 | Signal Watch | `Session complete`, persisted, no error | `4/4` |

Final screen: **"Workout complete — 4/4 games complete — This workout is
saved."** Zero persist errors and zero fatal/ANR/SQLite markers across the
whole workout.

## 5. Force-stop/relaunch and offline

- Force-stop → relaunch: COLD, Home, `TotalTime` 1,058 ms, 0 markers.
- Offline (airplane mode) force-stop → relaunch: COLD, Home, 1,324 ms; the one
  matched logcat line was a system launcher `SearchTargetUtil` base64 payload
  containing the substring "OOM" (false positive; no app process line).
- Persistence verified directly from the pulled canonical DB (below).

## 6. Route boundaries

| Route | Observed |
| --- | --- |
| `/game/does-not-exist` | recoverable `Game not found` + `Back to library` |
| `/game/` + 4,000-char id | same recoverable not-found fallback; startup not corrupted |
| `/results?id=` + 4,000-char id | recoverable empty `Results` state (`No sessions yet`) |
| malformed workout provenance (`workoutKey=bad key!!&workoutIndex=99999`) | rejected before selection; game route renders standalone (no workout leg bound) |

No markers in any route-boundary run.

## 7. Startup recovery fault path

With root adb (emulator-local), the canonical
`files/SQLite/brain-training.db` was moved aside and replaced with an
unreadable file:

- Cold launch rendered **Storage Unavailable** with the retry control and
  **withheld the normal shell** (`home-workout-cta` absent).
- Restoring the database and relaunching recovered **Home** with
  `TotalTime` 1,126 ms and no markers.

## 8. Export / import reachability

Covered by `SYSTEM_PROVIDER_IMPORT_CLOSURE.md`: export wrote a durable backup;
the system picker opened, cancelled back, selected a disposable backup,
previewed `Valid (0 additions)`, applied an idempotent merge, and rejected a
malformed file. Zero provider/app ANR evidence.

## 9. SQLite integrity and duplicate audit (final device DB)

Pulled from `/data/data/com.braintraining.app/files/SQLite/brain-training.db`
after the workout:

- `PRAGMA integrity_check` → **ok**; `foreign_key_check` → **none**;
  `user_version` → **12**.
- 7 sessions across 5 game ids; **no duplicate session ids**.
- 7 currency-ledger rows; **no duplicate `operation_id`**.
- `workout_instances` for 2026-09-19: `status: completed`, `current_index: 4`.
- (`xp_awards` is empty by design in the current progression path; XP is
  carried on sessions/ledger.)
- The two extra `logic-next-sequence`/`attention-symbol-tracker` rows come from
  the interrupted earlier workout attempt (distinct session ids, not
  duplicates); the clean run then completed all four legs.

## 10. Marker scan

Across 23 convergence steps, the targeted gameplay run, and the workout run:
0 app-process `FATAL EXCEPTION`, 0 `ANR in`, 0 `SIGSEGV`, 0 OOM, 0 SQLite
fatal, 0 `isn't responding`.

Raw artifacts: `D:\Temp\campaign054\runtime\` (`convergence-results.json`,
`sequence-memory-play-results.json`, `workout-results.json`,
`db-audit.json`, per-step UI dumps and logcat captures).
