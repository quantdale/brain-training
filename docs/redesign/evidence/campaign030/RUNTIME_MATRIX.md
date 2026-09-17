# Campaign 030 Runtime Matrix

Date: 2026-09-17

Effective product baseline: 5c484a08083963439360cb06c229249029f90531

Runtime: dedicated braintraining-c030 AVD, serial emulator-5558, Android API
35 AOSP ATD x86_64, 1080 x 2400, 420 dpi.

Raw evidence root: D:\Temp\campaign030-capture

This matrix records what was actually established. PASS for a semantic route
does not imply a usable visual framebuffer. No blocked check is counted as a
pass.

## Status key

- PASS: the required observation was obtained.
- PARTIAL: only the non-visual or non-dynamic part was obtained.
- BLOCKED: the required evidence could not be obtained because of the graphics
  or authorized-provider limitation.
- NOT VALIDATED: the check was not safely executable in this environment.
- FAIL: the requested condition was observed not to hold.

## Device, package, and launch

| ID | Check | Result | Evidence and notes |
| --- | --- | --- | --- |
| C030-RT-001 | Repository state preflight | PASS | [Verified by command] node scripts/validate-repo-state.mjs passed; branch main was aligned with origin/main before the packet |
| C030-RT-002 | Dedicated AVD boot | PASS | [Observed runtime] braintraining-c030 on emulator-5558 reached ADB state device, sys.boot_completed=1, and package-manager readiness |
| C030-RT-003 | User-device isolation | PASS | [Verified by command] only emulator-5558 was targeted; emulator-5554 and braintraining-ui35 were not stopped, installed to, relaunched, or sent input |
| C030-RT-004 | Current APK provenance | PASS | [Verified by command] APK exists at apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk; SHA-256 5D832CAEEB2A683DEDEF58FBBA059BAD2CE2B3701963F057822DA5F247248CE |
| C030-RT-005 | APK install | PASS | [Observed runtime] adb install -r -d -g returned Success for com.braintraining.app |
| C030-RT-006 | Cold debug launch without Metro | BLOCKED | [Observed runtime] native Activity starts, but the debug client displays the expected unable-to-load-script RedBox when no Metro bundle is available; this is a launch precondition, not a product-flow pass |
| C030-RT-007 | Launch with existing Metro | PASS | [Observed runtime] port 8081 was already served by the existing Expo process; only emulator-5558 received reverse tcp:8081; MainActivity reached foreground with no RedBox in the route sweep |
| C030-RT-008 | App semantic hierarchy | PASS | [Observed runtime] route sweep XMLs contain titles, labels, test IDs, controls, and content on all 22 light/dark captures |
| C030-RT-009 | Native visual framebuffer | FAIL | [Observed runtime] final PNG is valid 1080 x 2400, 10,195 bytes, one unique RGB value, mean luminance 0, SHA-256 9c7383dc015b03c1a5941e6a1d41073a7a09c6502f5d295ea419a11014847f44 |
| C030-RT-010 | Android graphics counters | FAIL | [Observed runtime] dumpsys gfxinfo reports Total frames rendered: 0 and GPU memory: 0 bytes; 51 attached views and 108.31 KB render nodes remain present |

## Graphics mode trials

| ID | Emulator mode | Result | Evidence |
| --- | --- | --- | --- |
| C030-GFX-001 | -gpu swiftshader_indirect | FAIL | [Observed runtime] exact requested spelling was accepted by the launch attempt but did not produce non-uniform app pixels |
| C030-GFX-002 | -gpu software | FAIL | [Observed runtime] current supported software mode booted the dedicated AVD but did not produce non-uniform app pixels |
| C030-GFX-003 | -gpu swiftshader | FAIL | [Observed runtime] current supported SwiftShader mode booted the dedicated AVD but did not produce non-uniform app pixels |
| C030-GFX-004 | HWUI/compositor diagnosis | BLOCKED | [Observed runtime] debug.hwui.drawing_enabled=0; MainActivity surface is visible and HAS_DRAWN, but no app frame is published to the framebuffer |

The emulator help output lists auto, host, software, lavapipe, swiftshader, and
swangle. The exact legacy requested spelling is not listed by this installed
37.1.11.0 emulator. The investigation stopped after the three bounded
dedicated-AVD trials.

## Static surface route matrix

The ui-capture route sweep used profile default and both light and dark themes.
Every row below has a light XML and PNG under
D:\Temp\campaign030-capture\default\light and a matching dark XML and PNG under
D:\Temp\campaign030-capture\default\dark. Manifest:
D:\Temp\campaign030-capture\manifest.json.

| ID | Surface and route | Semantic result | Visual result | Deterministic content observed |
| --- | --- | --- | --- | --- |
| C030-SUR-001 | Home / Today, / | PASS | BLOCKED | [Observed runtime] home-title, home-workout-cta, Today, four-game plan, Start workout, Continue, progress, reroll, and game-leg nodes |
| C030-SUR-002 | Games, /games | PASS | BLOCKED | [Observed runtime] games-title, 42-game catalog, featured/recommended content, search, favorites, eight domain filters |
| C030-SUR-003 | Game Detail, /game-detail/memory | PASS | BLOCKED | [Observed runtime] Memory title/description, mastery 0, first-play state, Play Memory, favorite, records, no sessions |
| C030-SUR-004 | Progress, /progress | PASS | BLOCKED | [Observed runtime] title, 7d/30d/90d/all selectors, no-session state, Browse games, overall performance and domain count |
| C030-SUR-005 | Activity, /progress-activity | PASS | BLOCKED | [Observed runtime] empty activity calendar, no sessions, Browse games |
| C030-SUR-006 | Progress Detail, /progress-detail | PASS | BLOCKED | [Observed runtime] empty domain history, game records, and recent sessions |
| C030-SUR-007 | Profile, /profile | PASS | BLOCKED | [Observed runtime] identity, level/XP, streak, milestone, and streak-support controls |
| C030-SUR-008 | Rewards, /rewards | PASS | BLOCKED | [Observed runtime] empty claim inbox, 0 balance, collection progress, cosmetics and lock metadata |
| C030-SUR-009 | Data Management, /data-management | PASS | BLOCKED | [Observed runtime] local-only/offline trust copy, local counts, backup name/export, and saved-backup area |
| C030-SUR-010 | Results, /results | PASS | BLOCKED | [Observed runtime] no-session Results state and Browse games |
| C030-SUR-011 | Memory Game Intro, /game/memory | PASS | BLOCKED | [Observed runtime] difficulty choices, Start, QA controls, How to play, Watch a demo, Skip tutorial (QA) |

The light and dark XMLs have matching route verification and semantic
structure. Their PNGs are identical uniform-black frames, so visual theme
equivalence is not validated.

## Accessibility and visual profile coverage

| ID | Check | Result | Evidence |
| --- | --- | --- | --- |
| C030-A11Y-001 | Structural audit | PASS | [Verified by command] scripts/qa/a11y-audit.mjs passed 22 surfaces with 0 violations |
| C030-A11Y-002 | Interactive labels | PASS | [Verified by command] all 59 reported interactive nodes were labelled; no target was under 44 dp |
| C030-A11Y-003 | Clipping | PARTIAL | [Verified by command] two known clipped Games nodes, one per theme: Signal Watch, Attention game, New, height 118 dp |
| C030-A11Y-004 | Compact/expanded/landscape/font scale 2 | NOT VALIDATED | [Blocked] the capture helper's long warm-up remained black; no additional profiles were run after the bounded graphics diagnosis |
| C030-A11Y-005 | Reduced motion | NOT VALIDATED | [External/manual validation pending] no visual/native behavior evidence was available |

The 59-node total is the sum of the per-surface interactive counts in the
audit artifact. Rewards has no interactive nodes in the captured empty state.

## Tutorial, gameplay, workout, and persistence matrix

| ID | Required check | Result | Evidence and honest boundary |
| --- | --- | --- | --- |
| C030-FLOW-001 | Intro route and tutorial affordances | PARTIAL | [Observed runtime] Memory Intro route and tutorial controls are present in XML; [Blocked] clicking through the tutorial was not claimed |
| C030-FLOW-002 | Representative gameplay canaries | BLOCKED | [Blocked] live ARTEMIS Flash/Pro task could not run without the authorized OpenCode Go credential; the removed custom autobot was not replaced |
| C030-FLOW-003 | Pause/interruption | BLOCKED | [Blocked] requires a stateful live game journey |
| C030-FLOW-004 | Per-game Result | BLOCKED | [Blocked] only the empty Results route was observed; no completed result was claimed |
| C030-FLOW-005 | Workout continuation | BLOCKED | [Blocked] no authorized stateful workout task |
| C030-FLOW-006 | Workout completion | BLOCKED | [Blocked] no authorized stateful workout task |
| C030-FLOW-007 | Interruption/resume | BLOCKED | [Blocked] no authorized Pro task and no safe direct gameplay driver |
| C030-FLOW-008 | Relaunch persistence | BLOCKED | [Blocked] native session mutation and relaunch replay were not executed |
| C030-FLOW-009 | Persistence/integrity | PARTIAL | [Verified by command] persistence, schema, backup, and gameplay test suites are covered by the local Jest result; [Blocked] no current native mutation/restore journey was observed |
| C030-FLOW-010 | Empty/error states | PARTIAL | [Observed runtime] Progress, Activity, Progress Detail, Results, Game Detail, and Data Management empty states are present semantically; [Blocked] visual/error presentation is unavailable |

## Repository and external checks

| ID | Check | Result |
| --- | --- | --- |
| C030-QA-001 | Typecheck, lint, registry, offline, secrets, task ownership, affected sync, runtime contract | PASS, [Verified by command] |
| C030-QA-002 | Jest CI signal | PASS, [Verified by command] 553/557 suites passed with 4 allowlisted skips; 6,548/6,553 tests passed with 5 allowlisted skips; 0 failures |
| C030-QA-003 | OpenSpec validation | PASS, [Verified by command] 16/16 |
| C030-QA-004 | Web export | PASS, [Verified by command] 20 routes and 47 bundles |
| C030-QA-005 | Dependency audit | PASS, [Verified by command] repository allowlist accepts 5 advisories |
| C030-QA-006 | Android setup self-test | PASS with skips, [Verified by command] 5 PASS, 0 FAIL, 2 SKIP; valid PNG check is not a pixel-content check |
| C030-QA-007 | ARTEMIS setup/helper | PARTIAL, [Verified by command] doctor ready and helper v6 ready; authorized live provider unavailable |
| C030-QA-008 | Expo Doctor | FAIL classification, [Verified by command] 20/21 checks passed; 14 patch drifts |
| C030-QA-009 | GitHub Actions | BLOCKED classification, [Verified by command] four zero-step failed jobs; exact external cause indeterminate |
| C030-QA-010 | Human validation | NOT VALIDATED, [External/manual validation pending] |
