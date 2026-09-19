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
