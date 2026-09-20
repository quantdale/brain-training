# Campaign 055 — Final Native Validation

## Device and artifacts

- Device (all captures and checks): `braintraining-ui35` / `emulator-5554`,
  Android 15 / API 35, 1080×2400 @ 420 dpi.
- Runtime evidence artifact: Campaign 055 release APK SHA-256
  `9E6B94FCED9A70DDBE828C99734D846DF7A1DB4ED5F42B3FFDC6691A236A367A`
  (109,593,933 bytes, debug-signed local artifact), installed and exercised.
- Frozen-tree rebuild: `E1E9C4BD74442C47D26CD22FF00E467D5D2896AE91B30472FD2F3E2AF172D414`
  (109,593,889 bytes). The delta to the runtime artifact is two non-visual
  convergence edits (an unused module constant removed after it began failing
  lint, and one dependency-array entry on an existing effect). Nothing visual,
  behavioural or contractual differs; the re-baselined snapshot suite and the
  frozen-tree build both pass.

## Executed on the runtime artifact

| Check | Result | Evidence |
| --- | --- | --- |
| Home ready/active | PASS | `screens/after/home-active.jpg` (fresh 0/4 plan, `Start workout`, `Today's plan`) |
| Home completed | PASS | `screens/after/home.jpg` (completed band, `See today's progress`) |
| Games default | PASS | `screens/after/games.jpg` (featured stage + poster grid) |
| Games scrolled / browse-all | PASS | `screens/after/games-scrolled.jpg` |
| Search/filter state | PASS (default + scrolled states; the search field and filter rail render and the count is truthful in the captured state) | `screens/after/games-scrolled.jpg`; `games-library` suite green |
| Multiple visually distinct games | PASS | poster tiles for Language/Flexibility/Attention/Spatial games with distinct world art in `games(-scrolled).jpg` |
| Game Detail | PASS | `screens/after/game-detail.jpg` |
| Tutorial (first play) | PASS | `screens/after/tutorial.jpg` (tutorial reset on device, then captured) |
| Gameplay | PASS | `screens/after/gameplay.jpg` |
| Result (in-session, weak performance) | PASS | `screens/after/ingame-result.jpg` (honest weak-result treatment) |
| Result (route) | PASS | `screens/after/result.jpg` |
| Progress | PASS | `screens/after/progress.jpg` |
| Profile | PASS | `screens/after/profile.jpg` |
| Rewards + collection grid | PASS | `screens/after/rewards.jpg`, `screens/after/rewards-grid.jpg` |
| Dark mode (Home, Games, Detail, Intro, Progress, Profile, Rewards, Result) | PASS | `screens/after/dark-games.jpg`, `screens/after/dark-result.jpg`, plus the same-named dark captures outside Git |
| Compact/light matrix | CAPTURED WITH FINDINGS | 11/11 surfaces + XML in `qa-artifacts/campaign055-after/compact/light`; 27 measured `target<44dp` observations analysed in `ACCESSIBILITY_RESPONSIVE_QA.md` (0 unlabelled, 0 decorative leaks) |
| SQLite integrity / duplicate-effect audit | PASS (pre-crash pull) | schema v12, integrity `ok`, no duplicate session/ledger/rating operations at the time of the pre-crash pull; the post-fix re-audit is NOT VALIDATED (blocker below) |

## NOT VALIDATED (environment blocker)

The host emulator failed during the profile switch after the compact/light
matrix (11 surfaces captured) and could not be brought back:

- `emulator.exe` version 37.1.11 exits with `0xC0000005` (access violation)
  immediately after "Windows Hypervisor Platform accelerator is operational"
  across repeated launches (`-gpu swiftshader_indirect`, `-gpu off`,
  `-accel off`, `-no-snapshot`, `-wipe-data`).
- A stale wedged instance holding port 5555 was killed and the adb server
  restarted; the emulator then exited with the multi-instance FATAL, and after
  clearing that, subsequent boots either segfaulted or registered with adb but
  never completed guest boot (`sys.boot_completed` never answered, shell and
  logcat timing out for 10+ minutes).
- The repository's alternate API-35 AVD (`braintraining-c030b`, same
  1080×2400 @ 420 profile) was tried as a documented substitute and showed the
  same wedged-guest behaviour.
- This matches the host-documented instability ("emulator 37.1.x
  intermittently segfaults"); the practical recovery is a Windows reboot,
  which is outside this campaign's authority.

Consequently these required checks are recorded as **NOT VALIDATED** rather
than inferred:

1. compact/dark and font-scale-2 native matrices on the re-composed surfaces;
2. force-stop/relaunch, invalid-route recovery, offline relaunch and logcat
   fatal/ANR/SQLite review on the final artifact;
3. the full four-game workout on the final artifact (the pre-campaign workout
   evidence and the workout/persistence suites remain green, but this
   campaign's visual chrome was not re-exercised through all four legs on
   device);
4. the post-fix SQLite duplicate-effect re-audit on the frozen tree.

Nothing about these gaps is caused by product behaviour; the blocker is
environmental and reproducible. The resumed native pass should start by
rebooting the host, then running `ui-capture` (default + compact + font-scale-2,
light + dark) and `scripts/android` diagnostics against the same artifact
family.

## Boundaries (unchanged, manual/external)

Human TalkBack/VoiceOver quality, physical/OEM Android, iOS runtime, store
signing, human system-provider usability and external CI remain NOT VALIDATED;
no human or platform success is claimed.

---

# Resumption addendum (2026-09-20) — exact-final-artifact native closure

## Device and artifact

- Runtime: AVD **`braintraining-c055r-atd`** (created for this resumption;
  android-35 `aosp_atd` x86_64, 1080×2400 @ 420 dpi, 2048 MB RAM) on serial
  **`emulator-5554`**. `braintraining-ui35` was retried first and still crashed
  with `0xC0000005` on every launch (see
  `RESUMPTION_ENVIRONMENT_RECOVERY.md`). `emulator-5556` and every other
  runtime were never touched.
- **Authoritative final Campaign 055 artifact** (the only one used below):
  - product-source checkpoint
    `ddfe539d1a25b5bf47b2b3975ee37783e0f81f60`
  - APK SHA-256
    **`A83729AEFC9C00D398A215880CFB5B6837A3F08CA248EEC770BAAF2D33C48AA5`**
  - 109,596,169 bytes (104.5 MB), `com.braintraining.app` v0.1.0,
    debug-signed local release build, Metro-independent.
  - The previous `9E6B94FC…` / `E1E9C4BD…` artifacts are historical
    intermediate builds only and were not used for any terminal check.

## Executed on the exact final artifact (hierarchy/log/database evidence)

| Check | Result | Evidence |
| --- | --- | --- |
| Clean uninstall/install + first launch | PASS | install Success; cold `TotalTime: 702 ms`; Home tree present |
| Warm launch (force-stop → launch) | PASS | `TotalTime: 451 ms`; Home present |
| Offline launch → restore online | PASS | Wi-Fi/data disabled; `TotalTime: 485 ms`; Home + `home-local-trust` present; radios restored |
| Invalid game id (`/game-detail/not-a-real-game`) | PASS | recoverable "Unknown game … Browse games" state |
| Oversized game id (400 chars) | PASS | same recoverable state |
| Oversized Results id (400 chars) | PASS | Results empty state ("No sessions yet … Browse games") |
| Malformed workout provenance (`workoutKey=&workoutIndex=abc`) | PASS | game intro renders normally; malformed tuple ignored |
| Recovery back to normal navigation | PASS | Home renders with full plan |
| Home ready state | PASS | 0/4 plan, `Start workout`, `Today's plan` |
| Games default + scrolled | PASS | storefront + `games-grid`; 12 poster cards after scroll |
| Games search/filter | PASS | typed "word" → `games-count` "Showing 7 of 42 games"; filter rail renders |
| 8 games, one per domain, at Game Detail | PASS | attention/flexibility/language/logic/math/memory/spatial/speed all render title + Play |
| Tutorial (real interaction) | PASS | memory demo sequence `[7,5,2]` computed from the deterministic seed and completed by tapping the real tiles; four workout-leg tutorials completed by answering the real demos |
| Active gameplay (real interaction) | PASS | memory session played to results; workout legs played through their real round flows |
| Weak in-session Result | PASS | headline **"Keep training"** (honest band), single `Final score 0`, facts (0%, 0/5 rounds, streak 0), neutral "Reward +10 XP · +2 coins / Progress saved", no PB badge |
| Mid results in the workout | PASS | persisted normalized results 0.455 / 0.274 / 0.156 / 0.0 across the four legs |
| Route Result (dark) | PASS | "Keep training", 0%, Order Sweep, metrics |
| Progress / Profile / Rewards / Data Management | PASS | all four route markers render |
| Dark mode Games + Result | PASS | night mode on → both surfaces render; restored to light |
| Full four-game workout | PASS | Home "Start workout" → Task Switch → Next → Context Fit → Next → Deduction Table → Next → Order Sweep → **Finish workout**; Home then shows "Workout complete / 4/4 games saved" |
| Relaunch retention | PASS | force-stop + cold relaunch → Home still "4/4 games saved" |
| SQLite audit | PASS | see below |
| Log/failure review | PASS | see below |

## SQLite audit (post-workout, canonical database)

Pulled from `/data/data/com.braintraining.app/files/SQLite/brain-training.db`
(no `-wal`/`-shm` left; clean checkpoint):

| Check | Result |
| --- | --- |
| `PRAGMA integrity_check` | **ok** |
| `PRAGMA foreign_key_check` | **0 rows** |
| `PRAGMA user_version` | **12** |
| Duplicate session ids | **0** |
| Duplicate currency-ledger operation ids | **0** (5 ledger rows, `gameplay:<sessionId>` unique) |
| Duplicate rating operations per session+domain | **0** |
| Duplicate tutorial rows per game | **0** |
| Duplicate domain-rating rows | **0** |
| Workout instance terminal state | **1 instance, `status='completed'`, `current_index=4`**; 0 stale in-progress |
| Result persistence | 5 sessions with `normalized_result` 0.0 / 0.455 / 0.2736 / 0.1562 / 0.0; 8 rating-history rows; 6 domain ratings |

Visual/display changes did not alter durable semantics: the session rows, ledger
ids, rating history and workout status are exactly the canonical shapes.

## Log review

52,068 log lines from the full runtime pass: **0** FATAL EXCEPTION, **0** ANR,
**0** SIGSEGV, **0** OOM, **0** SQLite exceptions/corruption, **0** ReactNativeJS
error/fatal lines, **0** RedBox/LogBox contamination. The only app-adjacent
messages are informational (`artd` dexopt I/O notices, MediaSessionService
state changes).

## NOT VALIDATED — pixel matrix (host display/compositing blocker)

The six-way visual matrix (default/compact/font-scale-2 × light/dark) was
attempted on this exact artifact with the canonical `ui-capture` harness. The
host's emulator display/compositing path produces no composited frames
(`UpdateLayeredWindowIndirect failed … A device attached to the system is not
functioning`; `dumpsys gfxinfo` = 0 frames) in every GPU mode tried, so every
PNG is a uniform frame and the harness reports `BLANK`. The captures' XML
hierarchies were still produced and used for the accessibility audit; the
pixel-level visual matrix, before/after pixel comparison on the final artifact,
and on-device frame-timing measurements remain **NOT VALIDATED**. Full attempt
matrix and root cause: `RESUMPTION_ENVIRONMENT_RECOVERY.md`. This is an
environment blocker, not a product defect: the guest runs, renders its view
tree, persists, and answers every semantic check.

## Boundaries (unchanged, manual/external)

Human TalkBack/VoiceOver quality, physical/OEM Android, iOS runtime, store
signing, human system-provider usability and external CI remain NOT VALIDATED;
no human or platform success is claimed.
