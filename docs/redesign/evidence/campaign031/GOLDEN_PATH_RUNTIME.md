# Campaign 031 dynamic golden-path runtime

Date: 2026-09-17
Target: disposable `braintraining-c030b`, `emulator-5562`, Android 35 Google
APIs x86_64, Pixel 7, 1080×2400, density 420, 1536 MB, Emulator 37.1.11.

## Driver classification

The preferred ARTEMIS MCP route was unavailable: two target-bound MCP calls
returned `Transport closed`; the direct external ARTEMIS CLI route stopped
before UI interaction with `MissingSessionID` on both the initial and explicit
session retry. `uv run artemis doctor --json` independently reported the
external setup ready. No provider credential, trace, or ARTEMIS checkout was
copied into this repository.

Campaign 030B §6.2 authorizes the bounded fallback when the provider route is
unavailable. This run therefore used only explicit `adb -s emulator-5562`
commands, UIAutomator hierarchy/resource IDs, emulator-local screenshots, and
the app’s existing development-only deterministic QA controls. It did not move
the host cursor, inject host keyboard input, steal focus, or touch the
protected `emulator-5554`.

Force-win is called out because it proves navigation/persistence determinism,
not natural human performance. It is behind the existing development-only QA
boundary and did not change the game mechanics or write path.

## Clean dark run — authoritative idempotency run

The clean dark run started from a cleared package and ended with the following
observable sequence. Screenshots are under `D:\Temp\campaign031-runtime\dark`;
hierarchy evidence is under `D:\Temp\campaign031-runtime\hierarchy`.

| Step | Observed state | Semantic/pixel evidence |
| --- | --- | --- |
| Home | Today’s Workout, `4 games · about 8 minutes`, `0/4`, `Next: Cue Keeper`, one `Start workout` CTA, and secondary context/configuration | `dark/home-fresh-stable.png`, `dark-home-fresh-stable.xml` |
| Start / handoff | Home CTA entered the persisted first leg, Cue Keeper, with Game 1 context | `dark/intro.png`, `dark-intro.xml` |
| Intro / tutorial | Concise mechanic, `TODAY’S WORKOUT`, `Game 1 · your next game`, `Start game`, `How to play`, and `See an example`; tutorial demo and answer were observed | `dark/tutorial-example.png`, `dark-tutorial-example.xml` |
| Gameplay | Cue Keeper rendered the board with `Round 1/5`, score, round progress, and one Pause control | `dark/gameplay-active.png`, `dark-gameplay-active.xml` |
| Pause / resume | `memory-prospective-cue.pause-overlay`, `Paused`, `Resume`, and `Quit` were present; Resume returned to the same session with the timer lifecycle intact | `dark/pause.png`, `dark-pause.xml`, `dark/gameplay-resumed.png` |
| Relaunch before completion | Force-stop/relaunch returned to Home at `0/4`; re-entering Cue Keeper returned to the intro without replaying the first-use tutorial | `dark/pause-relaunch.png`, `dark-pause-relaunch.xml`, `dark/intro-after-relaunch-final.png`, `dark-intro-after-relaunch-final.xml` |
| Result 1 | Force-win produced a populated Session Result and `UP NEXT Context Fit`, Game 2 of 4, progress saved, and one primary `Next game` | `dark/result-1.png`, `dark-result-1.xml` |
| Result 2 / Next | Context Fit completed, then `Next game` opened Transform Match with the same workout position/provenance | `dark/result-2.png`, `dark/intro-3.png`, `dark-result-2.xml`, `dark-intro-3.xml` |
| Result 3 / Next | Transform Match completed, then `Next game` opened Fold Match | `dark/result-3.png`, `dark/intro-4.png`, `dark-result-3.xml`, `dark-intro-4.xml` |
| Final result | Fold Match completed; the result showed `Workout complete`, `4/4 games complete`, saved-copy, bounded reward, and one `Finish workout` action | `dark/result-4.png`, `dark-result-4.xml` |
| Completion Home | Finish returned directly to Today; Home showed `Workout complete`, `4/4 games saved`, all four legs Done, and a progress-review CTA | `dark/home-completed-stable.png`, `dark-home-completed.xml` |
| Relaunch after completion | Force-stop/relaunch preserved completed Home and did not add any database rows | `dark/home-relaunch-completed.png`, `dark-home-relaunch-completed.xml`, DB replay below |

The first light run covered the same sequence and produced the equivalent
light artifacts under `D:\Temp\campaign031-runtime\light`. It also caught a
real navigation edge case: the first final Finish action used the pushed game
stack and landed on the prior result. The in-scope fix changed final Finish to
the existing root replacement; the final light retry and clean dark run both
returned to Home correctly. The light exploratory database includes one
intentional diagnostic retry and is not used for clean count claims.

## Persistence and exactly-once replay

Read-only SQLite snapshots were pulled from the same disposable app:

- `db-dark-complete.sqlite`: immediately after the clean 4/4 completion.
- `db-dark-relaunch.sqlite`: after force-stop/relaunch on completed Home.
- Both files are byte-identical, SHA-256
  `12C763AC74D1363BE006D7E1A909B969E2B804C4C320BD7F8B7B26F40DE11DB9`.

Observed counts after relaunch:

| Table/invariant | Result |
| --- | ---: |
| `game_sessions` | 4 |
| `currency_ledger` | 4 |
| `rating_history` | 7 |
| `workout_instances` | 1 |
| Completed workout | 1, date 2026-09-17, index 4, status `completed` |
| Duplicate `(session_id, domain)` rating keys | 0 |
| Duplicate non-null currency `operation_id` keys | 0 |
| Sessions missing game/generator/scoring version | 0 |

Each session is a different planned game ID and each currency row has a
unique `gameplay:<session-id>` operation ID. The workout metadata includes
selection version 3, the exact four game IDs, deterministic seed inputs, and
per-leg rationale. This verifies the presentation transition did not create a
second workout instance or duplicate session/reward/XP/rating/completion write.

## Representative shared-shell families

The changed shared shell was checked by focused canaries for 8 families:

| Family | Representative module | Result |
| --- | --- | --- |
| visual search / odd-one-out | `attention-visual-search` | PASS |
| memory / recall | `memory-prospective-cue` | PASS |
| reaction timing | `speed-reaction-time` | PASS |
| math/input construction | `math-equation-builder` | PASS |
| language/content match | `language-context-fit` | PASS |
| logic/deduction | `logic-deduction-table` | PASS |
| rule switching/flexibility | `flexibility-task-switch` | PASS |
| spatial transformation | `spatial-transform-match` | PASS |

The canary command ran 8 suites / 82 tests and did not alter the production
game modules.

## Offline and failure classification

The repository offline validator is CLEAN and SQLite remained canonical during
the entire run. A separate runtime network-toggle journey was not claimed
because the safe runtime harness did not expose a network fixture. This is a
non-blocking validation limitation, not evidence of a regression.

The ARTEMIS failure is a harness/provider classification, not a product
failure: direct ADB observed the required rendered native path and persistence
contracts, while no ARTEMIS model trace was available to claim.
