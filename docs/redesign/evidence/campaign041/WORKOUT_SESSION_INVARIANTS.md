# Workout and Session Invariants

## Daily plan and complete path

`[OBSERVED_RUNTIME]` On a clean dedicated emulator state, the current Home workout selected four games in this order:

1. `flexibility-cue-shift`
2. `language-word-chain`
3. `logic-order-path`
4. `flexibility-color-stroop`

The workout was entered through the real Home CTA, not a direct game route. A development-only skip-tutorial/force-win control was used only to make the exhaustive four-game run deterministic and bounded; it did not bypass workout persistence, result transitions, or SQLite writes.

| Game | Result evidence | Transition |
|---|---|---|
| Cue Shift | `[OBSERVED_RUNTIME]` score 1500, 10/10, 100%, XP 50, +10 coins | Next Game reached Word Chain |
| Word Chain | `[OBSERVED_RUNTIME]` score 330, 6/6, XP 50 | Next Game reached Order Path |
| Order Path | `[OBSERVED_RUNTIME]` score 750, 5/5, XP 50 | Next Game reached Color Stroop |
| Color Stroop | `[OBSERVED_RUNTIME]` score 2175, 15/15, XP 50 | Final UI showed `4/4 games complete`, `Workout complete`, Finish workout |

After Finish workout, Home showed `Workout complete`, `4/4 games saved`, and `See today’s progress`. Force-stop/relaunch returned to that completed Home state without a duplicate session, rating, currency operation, or workout completion.

## Persisted write accounting

`[VERIFIED_PERSISTED_STATE]` Direct SQLite inspection after the full run found:

- one completed workout instance for the current day with 4 selected/completed games;
- four game-session rows, each with XP 50, total 200;
- four currency ledger rows, each +10, with unique gameplay operation IDs;
- eight rating-history rows with no duplicate rating keys;
- no duplicate session identity;
- no duplicate workout completion;
- zero `xp_awards` rows because the current authoritative session path records XP in `game_sessions.xp`;
- schema/integrity checks still valid after relaunch.

`[VERIFIED_TEST]` The authoritative reward/economy/rating/session tests cover operation-ID dedupe, append-only triggers, double claim, interleaving claim, rollback/crash windows, duplicate rating prevention, and session identity. The native flow confirms those contracts are reached by the real UI.

## Interruption and resume

`[OBSERVED_RUNTIME]` A second clean state started the daily workout, entered a game, paused, resumed, and was force-stopped before completion. On relaunch, Home still showed `0-of-4` and the current game could resume; no error was present and SQLite had zero gameplay sessions, as expected.

The game was then completed through the current QA completion path and the app was force-stopped before the next game. After relaunch, Home showed `1-of-4-next-word-chain`. SQLite showed active index 1, one session, one +10 ledger row, and two ratings. This proves continuation identity and persisted progress without requiring a second date or globally mutating the device clock.

## Exactly-once and stress conclusion

`[VERIFIED_TEST]` Focused tests and `[OBSERVED_RUNTIME]` bounded repeated actions found no duplicate irreversible writes. The exact-once conclusion is limited to current local Android/database behavior under the exercised UI paths; it is not a claim about a distributed sync service or an untested physical device.

