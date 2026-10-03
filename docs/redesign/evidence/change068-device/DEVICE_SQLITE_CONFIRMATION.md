# Change 068 — Device-lane confirmation (task §7.5 / §8.4)

**Date:** 2026-10-03 · **Tree:** `096aefc` (clean, `main`) · **Change:** `068-storage-adapter-runtime-parity`
**Scope closed:** Change 068 task §7.5 and §8.4 — the on-device half of the
storage-adapter parity contract, previously recorded as **NOT VALIDATED —
device lane not available**.

## Verdict

**PASS for the scoped device-half contract**, with explicit boundaries below.
Every measured claim in this document comes from the dedicated AVD
(`braintraining-ui35`, Android 15 / API 35, `emulator-5554`) against a debug
APK built from `096aefc`, and the raw artifacts are enumerated at the end.
Nothing here is inferred from the Node test backend.

## Environment

| Item | Value |
| --- | --- |
| AVD / serial | `braintraining-ui35` / `emulator-5554` (dedicated; headless, `-gpu host`) |
| Install under test | `app-debug.apk` built from `096aefc` (`gradlew assembleDebug`, BUILD SUCCESSFUL, 13m27s) |
| Upgrade path | `adb install -r` over an **existing install from 2026-09-21** (pre-Change-068), so the on-device fixture is a genuine pre-WAL database, not a fabricated one |
| JS delivery | Metro dev lane (`expo start`, `adb reverse tcp:8081`); the first launch without Metro correctly showed `Unable to load script` and is excluded from all findings |
| App engine | SQLite **3.50.3** (measured from `libexpo-sqlite.so` inside the installed APK) |
| Device `sqlite3` (external observer) | 3.44.3 (`/system/bin/sqlite3`, used read-only against the live file) |
| Host audit tool | `better-sqlite3` 3.53.4 (host-side inspection of pulled copies only; not the app engine) |

## 1. Existing install → WAL transition, without data loss (§7.5)

Pre-upgrade fixture (pulled copy, `pre-upgrade/brain-training.db`):

- DB header: `writeVer=1 readVer=1` → **rollback journal (legacy)**
- `PRAGMA user_version` = **12**, `integrity_check` = ok, 0 FK violations
- No `-wal` / `-shm` sidecars; single 163,840-byte `brain-training.db`
- Retained data: `game_sessions` 1, `currency_ledger` 1, `rating_history` 2,
  `domain_ratings` 2, `workout_instances` 1 (`2026-09-21`, active),
  `achievement_unlocks` 1 (**unclaimed**), `profile` 1, `quests` 16

After `adb install -r` of the `096aefc` debug APK and the first app open:

- On-device live-file read (external `sqlite3`, read-only): `PRAGMA journal_mode` = **wal**
  (before the upgrade this same probe answered `delete`)
- Sidecars present while the app runs: `brain-training.db-wal` (57,712 → 177,192 B),
  `brain-training.db-shm` (32,768 B)
- Pulled-copy header: `writeVer=2 readVer=2` → **WAL**, and it stays `wal`
  after force-stop
- `PRAGMA user_version` = **13** — the v12→v13 migration ran on the same open
  and completed; `integrity_check` = ok, 0 FK violations
- **No data loss:** all pre-upgrade rows retained (session 1, ledger 1,
  rating_history 2, ratings 2, unclaimed achievement 1, profile 1). The only
  deltas are by design: a new `2026-10-03` workout row was created for the new
  day, and daily `quest_progress` advanced 9→15.

## 2. Connection-invariant snapshot on the real device connection (§7.5)

`initializeConnection` applies **and reads back** each invariant, throwing one
error naming every unsatisfied invariant. The device evidence for the four
values is therefore the successful boot of the real expo-sqlite connection,
which cannot print success while any probe disagrees:

| Invariant | Required value (`src/db/schema.ts`) | Device result |
| --- | --- | --- |
| `foreign_keys` | `1` (ON) | probe satisfied — `bootstrap-db-init` **outcome success** |
| `busy_timeout` | `5000` ms | probe satisfied — same gate |
| `journal_mode` | `wal` | probe satisfied **and** independently measured on the file (above) |
| `synchronous` | `NORMAL` (1) | probe satisfied — same gate |
| `sqlite_version()` | (recorded, not asserted) | engine **3.50.3** (`libexpo-sqlite.so`) |

Boot-proof logcat lines (device clock):

```text
10:32:40.824  [perf] {"name":"bootstrap-db-init","durationMs":272.9,"detail":{"outcome":"success"}}
10:32:41.153  [perf] {"name":"bootstrap-progression","durationMs":323.3,"detail":{"outcome":"success"}}
10:49:04.908  [perf] {"name":"bootstrap-db-init","durationMs":239.8,"detail":{"outcome":"success"}}   ← after force-stop + WAL recovery
```

**Boundary:** the four per-connection values are device-verified by the
read-back gate on the real connection; they are not externally readable from
another process (SQLite has no cross-connection view of them), and the app
deliberately exposes no dev surface that prints them. That is the strongest
available device evidence and it is the exact mechanism §7.5 asked to confirm.

## 3. The three transactional journeys (§7.5)

All three ran against the live app on the dedicated AVD. Durable state was
verified on pulled `db+wal+shm` copies with `better-sqlite3` after each step
(`integrity ok`, `foreign_key_check` 0 in every audit).

### 3.1 Reroll a workout — PASS

- Home CTA `home-workout-reroll` ("Reroll workout (free)" — first reroll costs
  0 by design), driven by emulator-local taps
- `workout_instances[2026-10-03]`: `reroll_attempt` 0→1, `game_ids_json`
  replaced with a fresh deterministic plan, `updated_at` advanced
- `currency_ledger` unchanged at 1 row — correct: the first reroll is free

### 3.2 Claim a reward — PASS

- Rewards → `reward-claim-achievement-ach-first` ("Claim First Steps reward")
- `achievement_unlocks.claimed_at` null → `1791023832138`
- `currency_ledger` +1: `{amount: 25, reason: "achievement", operation_id: "achievement:ach-first"}`
  — exactly-once, keyed by the idempotent operation id
- The claim control disappeared from the hierarchy after the tap

### 3.3 Complete a game (in-workout leg 1) — PASS

Driven by a reviewer-readable emulator-local script
(`qa-artifacts/change068-device/drive-stroop.py`; hierarchy labels only — the
stimulus exposes `Word: X, ink color: Y`, answers expose `Answer <color>`,
rule-flip aware). The session reached the real results surface:

- `game_sessions` +1: `flexibility-color-stroop-mus9p047-1-mf1awp`, with
  versioned metadata `game 1001000 / generator 1001000 / scoring 1003000`,
  seed `2489872371`, and normalized result
- **Workout position write**: `workout_instances[2026-10-03].current_index`
  0→1 with `updated_at` advanced — the Change 073 position-writer path on the
  real connection
- `rating_history` 2→5; `domain_ratings` gained Flexibility (`986`, sessions 1)
  and recomputed Speed/Attention (sessions 2)
- `xp_awards` 0→1; `currency_ledger` 2→3 (gameplay credit)
- Result surface: `result-headline` "Keep training", score 0 — the honest
  weak-result path, expected because trial windows expire during the ~2 s
  hierarchy-dump cycle; timeouts are the game's own rule and do not skip trials

## 4. Reads-participate semantics on device (§8.4)

§8.4 asked for the on-device confirmation that reads during a transaction
behave as specified (participate instead of rejecting).

- All three journeys above are real transactional paths that read inside their
  transactions (claim path, session completion, reroll compare-and-set), and
  each committed with the expected durable effect.
- Whole-run logcat scan: **0** `SQLiteReentrantTransactionError`, **0**
  invariant failures, **0** `FATAL EXCEPTION` lines (779 KB capture).
- **Boundary:** the exact reject/participate matrix (which statements reject
  before enqueueing vs participate) is proven by the two repository suites
  against the real adapter objects (`transaction-reentrancy.test.ts`,
  `adapters/__tests__/expo.test.ts` with its hang backstop); the device run
  confirms no spurious rejection in the actual journeys rather than re-deriving
  the matrix on hardware.

## 5. Retention, recovery, and stability

- Force-stop leaves the WAL uncheckpointed (measured: `-wal` 177 KB remains) —
  expected for a process kill; the design intent is recovery on next open,
  which is exactly what happened.
- Cold relaunch after force-stop: WAL recovery on open, `bootstrap-db-init`
  success, `game_sessions` = 2 and workout `current_index` = 1 retained,
  `journal_mode` still `wal`.

## 6. ARTEMIS lane — BLOCKED (recorded, not worked around silently)

- `uv run artemis doctor --json` → **verdict ready** (python, config, host, ADB
  target all pass).
- The authorized route was verified in both external overrides before any task:
  all 20/22 role entries pin `openai_responses` / `muse-spark-1.3-contributor`
  with `fallback: null`. The doctor's `gemini_api_key` line is a legacy
  key-presence probe, not the selected route.
- `uv run artemis run …` failed at the transport boundary with
  `LLMPermanentError: 400 MissingSessionID — Request is missing
  x-opencode-session`, the same client-side OpenCode Go routing failure recorded
  in Campaign 031's regression matrix. No task vehicle ran; no alternate
  provider or model was substituted.
- Per the Campaign 030B/031 precedent in this repository, the journey was then
  executed by the direct emulator-local ADB lane above. The ARTEMIS trace
  remains **BLOCKED / NOT VALIDATED** and is not claimed as evidence.

## Classifications

| Item | Classification |
| --- | --- |
| §7.5 WAL transition without data loss, sidecars, pragma snapshot, three journeys | **PASS** (device, this document) |
| §8.4 reads-participate in real device journeys | **PASS** with the stated matrix boundary |
| Repo-suite half of the parity contract | unchanged (Change 068 closure) |
| ARTEMIS Flash trace for the game journey | **BLOCKED** (`MissingSessionID`) |
| App-engine `sqlite_version()` read from the live connection | **NOT VALIDATED** (no dev surface; version taken from the bundled library) |
| Human/manual platform lanes | out of scope, unchanged |

## Raw artifacts (outside Git, per `docs/QA_ARTIFACTS.md`)

`qa-artifacts/change068-device/`: `pre-upgrade/`, `post-upgrade/`,
`after-reroll/`, `after-claim/`, `after-game/` (each `db`+`wal`+`shm` where
present), `hier-*.xml`, `screen-stroop-results.png`, `logcat-full.log`,
`metro.log`, `drive-stroop.py` + `drive-stroop.log`, `artemis-doctor.json`,
`artemis-flash.log`, `audit-db.js`.
