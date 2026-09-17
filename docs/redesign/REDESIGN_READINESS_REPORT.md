# Campaign 030 / Campaign 030B — Runtime Baseline and Redesign Readiness

## Current Campaign 031 outcome

Date: 2026-09-17

Verdict: **`CAMPAIGN_031_COMPLETE_READY_FOR_032`**

Campaign 031 implemented and validated the authorized golden-path redesign
from Today/Home through workout completion. The final evidence package is
under `evidence/campaign031/`; it records the structural before/after change,
stateful light/dark native pixels on the disposable normal AVD,
pause/resume/relaunch persistence, exact-once database checks, representative
family canaries, accessibility audits, and explicit ARTEMIS/human pending
classifications. Campaign 032 was not started.

The Campaign 030B decision and evidence below remain the immutable before
baseline. Its statement that Campaign 031 was not yet ready is historical and
is superseded by the Campaign 031 closure package.

## Current Campaign 030B decision

Date: 2026-09-17

Verdict: **`READY_FOR_CAMPAIGN_031`**

Campaign 030B replaced the failed ATD graphics path with the disposable normal
phone AVD `braintraining-c030b` (`emulator-5562`). It proved real non-uniform
product pixels, captured a current 22-surface light/dark native matrix with
route-verified XML, completed the deterministic four-game golden path, and
validated interruption/resume/relaunch/persistence. The evidence-only packet
did not implement Campaign 031 or any redesign.

Read the closure packet and its companions:

- [Campaign 030B closure](evidence/campaign030b/CAMPAIGN030B_CLOSURE.md)
- [Runtime environment](evidence/campaign030b/RUNTIME_ENVIRONMENT.md)
- [Visual baseline index](evidence/campaign030b/VISUAL_BASELINE_INDEX.md)
- [Golden-path runtime evidence](evidence/campaign030b/GOLDEN_PATH_RUNTIME.md)
- [Campaign 029 visual cross-check](evidence/campaign030b/CAMPAIGN029_VISUAL_CROSSCHECK.md)
- [CI/SDK disposition](evidence/campaign030b/CI_SDK_DISPOSITION.md)

Known carried-forward limits are explicit: human validation is
`PENDING_PHASE_031`; the authorized ARTEMIS/OpenCode route was unavailable;
Expo patch drift is deferred to separate maintenance; GitHub Actions still
fails before steps as `INDETERMINATE_EXTERNAL_PRE_STEP`; a localized 43dp
Progress Detail row and clipped-under-tab-bar notes remain; and the Data
Management storage-size hero can say `Empty` while persisted table counts are
non-zero. None is silently presented as green or as observed data loss.

## Historical Campaign 030 baseline

The following section preserves why Campaign 030 originally returned
`BLOCKED_NOT_READY`. Its verdict and black-frame evidence are historical for
the prior ATD runtime, not the current Campaign 030B decision.

Campaign 030 established a substantial semantic current-baseline record, but it
did not establish a usable native visual runtime. The dedicated Campaign 030
Android runtime booted and loaded the app's JavaScript UI when the existing
Metro server was reversed to it. Its native accessibility trees were populated
and route-verified across the static surface matrix. Every framebuffer capture,
including the final -gpu swiftshader run, was a valid 1080 x 2400 PNG containing
one black color, and Android reported zero rendered app frames. The dynamic
gameplay/workout/resume checks also remain blocked because the authorized
ARTEMIS provider credential is unavailable. Under the Campaign 030 contract,
Campaign 031 was therefore not ready to start at that historical checkpoint.

## Scope and evidence rules

This packet is a current-baseline evidence and classification campaign. No
redesign was implemented. No product UI/source, dependency, Expo configuration,
CI workflow, persistence/schema, game logic, workout logic, or validation
harness was changed.

The evidence labels required by the campaign are used literally:

- [Observed runtime] means the behavior was observed on the dedicated emulator
  or in its accessibility tree.
- [Verified by command] means a repository or environment command produced the
  stated result.
- [Verified in source] means the repository source or configuration was
  inspected.
- [Historical] means inherited from Campaign 029 or an earlier campaign and
  not re-observed here.
- [Inferred] means a conclusion drawn from multiple observations.
- [Blocked] means the check could not produce the required evidence.
- [External/manual validation pending] means it needs a human, an external
  service, or a device outside this session.

Blank PNGs are retained as a diagnostic result, not presented as visual
screenshots of the product. The raw capture directory is outside Git at
D:\Temp\campaign030-capture. Its manifest and XML trees are indexed in
evidence/campaign030/SCREENSHOT_INDEX.md.

## Baseline provenance

| Item | Value |
| --- | --- |
| Session-start SHA | [Verified by command] 82593a738fcc573aaf4fca9852c28f03c1902fb5 |
| Documentation HEAD before this packet | [Verified by command] 88d13938b3e32e95018e79135aabd97f55fb37de |
| Campaign 029 product baseline | [Verified in source] 5c484a08083963439360cb06c229249029f90531 |
| Effective product baseline for this report | [Inferred] 5c484a08083963439360cb06c229249029f90531 |
| Current debug APK | [Verified by command] apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk |
| APK SHA-256 | [Verified by command] 5D832CAEEB2A683DEDEF58FBBA059BAD2CE2B3701963F057822DA5F247248CE |
| APK package/version | [Verified by command] com.braintraining.app, version 0.1.0, versionCode 1000 |
| Runtime target | [Observed runtime] dedicated braintraining-c030, serial emulator-5558 |

The only changes after the Campaign 029 product baseline and before this
packet are test-only or campaign/infrastructure documentation changes. The
runtime source, app configuration, and native product behavior are therefore
treated as the Campaign 029 baseline. The final Git SHA is supplied with the
campaign handoff; this report intentionally does not call that documentation
commit a new product baseline.

## Executive findings

| Finding | Classification |
| --- | --- |
| Dedicated runtime can boot | [Observed runtime] PASS: sys.boot_completed=1, ADB state device, package manager ready |
| Current debug APK can install | [Observed runtime] PASS: ADB install returned Success |
| JavaScript app can load | [Observed runtime] PASS when the already-running Metro server was reversed to emulator-5558; no RedBox in the route sweep |
| Native hierarchy is populated | [Observed runtime] PASS across 22 light/dark route captures; route test IDs and content were present |
| Native framebuffer contains product pixels | [Blocked] FAIL: all captures were uniform black; Total frames rendered: 0 |
| Accessibility structural audit | [Verified by command] PASS: 22 surfaces, 0 violations; two known clipped Games nodes |
| Dynamic canary/gameplay/workout/resume evidence | [Blocked] ARTEMIS authorized OpenCode Go route lacks its credential; Gemini fallback is not authorized |
| Static repository gates | [Verified by command] PASS, except Expo Doctor patch drift and the external GitHub zero-step failure |
| Campaign 029 visual conclusions | [Inferred] only the structural portions are confirmed; visual conclusions remain unverified |
| Campaign 031 readiness | BLOCKED_NOT_READY |

## Graphics recovery result

The only disposable runtime used was braintraining-c030 on
emulator-5558. No emulator-5554, braintraining-ui35, or other user-owned
device was stopped, relaunched, installed to, or sent input. The dedicated AVD
was stopped and relaunched only after exact process/AVD checks.

The installed AOSP ATD API 35 x86_64 AVD is configured at 1080 x 2400 with
1536 MB RAM and hw.gpu.enabled = no. Android Emulator 37.1.11.0 reports
-gpu auto, software, lavapipe, swiftshader, and swangle as current GPU modes;
the requested legacy spelling swiftshader_indirect is not listed by this
emulator. The following bounded trials were made on the dedicated AVD:

1. -gpu swiftshader_indirect: [Observed runtime] booted, but app captures
   remained uniform black.
2. -gpu software: [Observed runtime] booted, but app captures remained uniform
   black.
3. -gpu swiftshader: [Observed runtime] booted, but app captures remained
   uniform black.

The final -gpu swiftshader launch reached MainActivity with the reversed Metro
server. The final screenshot was 10,195 bytes, a valid 1080 x 2400 PNG,
SHA-256
9c7383dc015b03c1a5941e6a1d41073a7a09c6502f5d295ea419a11014847f44, with one
unique RGB value and mean luminance 0. Android reported:

- debug.hwui.drawing_enabled=0
- Total frames rendered: 0
- GPU memory usage: 0 bytes
- 51 attached views and 108.31 KB of render nodes
- MainActivity surface present, shown, and HAS_DRAWN, but no published app
  buffer with pixel content

[Inferred] This is an AOSP ATD/headless HWUI/compositor limitation on the
dedicated AVD, not evidence that the JavaScript route failed to load. The
graphics investigation is intentionally bounded. No product workaround,
dependency change, Expo change, or AVD replacement was made.

## Current-baseline surface coverage

The route sweep captured both light and dark themes for 11 deterministic
surfaces: Home/Today, Games, Activity, Progress Detail, Progress, Profile,
Rewards, Data Management, Results, Game Detail, and Memory Game Intro. All 22
routes started successfully and were route-verified by their XML trees.

Observed semantic examples include:

- Home: Today, a four-game workout, Start workout, Continue, progress, reroll,
  game legs, and navigation to Games, Progress, and Profile.
- Games: featured/recommended content, search, eight domain filters, favorites,
  and a catalog count of 42.
- Game Detail: Memory identity, description, mastery 0, first-play state,
  favorite control, records, and empty recent sessions.
- Game Intro: difficulty choices, Start, QA controls, How to play, Watch a
  demo, and Skip tutorial (QA).
- Progress: time windows, no-session empty state, Browse games, overall
  performance, and domain coverage.
- Profile: identity, level/XP, streak, milestone, and streak-support
  controls.
- Rewards: claim/inbox empty state, balance, collection, cosmetics, and lock
  metadata.
- Data Management: offline/local-only trust copy, local database counts,
  backup/export controls, and saved-backup state.

The static empty/error-like states observed in the same sweep were Progress
with no sessions, Activity with an empty calendar, Progress Detail with no
history/records, Results with no sessions, Game Detail with no records, and
the empty Data Management counts. They are semantic observations only because
the framebuffer is unavailable.

The detailed route, screenshot, and accessibility evidence is in:

- evidence/campaign030/RUNTIME_MATRIX.md
- evidence/campaign030/SCREENSHOT_INDEX.md
- evidence/campaign030/ENVIRONMENT_DIAGNOSIS.md

## QA and repository gates

| Check | Result |
| --- | --- |
| Android setup self-test | [Verified by command] PASS: 5 PASS, 0 FAIL, 2 SKIP. The skips were expected ATD launcher/no clickable-node conditions; valid PNG does not mean valid product pixels. |
| QA harness self-tests | [Verified by command] PASS, including Jest signal validator self-test |
| TypeScript typecheck | [Verified by command] PASS |
| ESLint | [Verified by command] PASS |
| Jest CI signal | [Verified by command] PASS: 553 suites passed, 4 allowlisted suites skipped, 0 failed; 6,548 tests passed, 5 allowlisted tests skipped, 0 failed; 5 snapshots passed |
| Registry/catalog validation | [Verified by command] PASS |
| Offline/source/security checks | [Verified by command] PASS |
| Dependency audit | [Verified by command] PASS under the repository allowlist: 5 accepted advisories |
| Task ownership and affected sync | [Verified by command] PASS |
| Runtime-QA contract | [Verified by command] PASS |
| OpenSpec validation | [Verified by command] PASS: 16/16 |
| Web export | [Verified by command] PASS: 20 routes, 47 bundles |
| ARTEMIS doctor/helper | [Verified by command] doctor reports ready and helper v6 is installed; authorized live provider route remains blocked |
| ARTEMIS live Flash/Pro | [Blocked] NOT VALIDATED: missing authorized OpenCode Go credential; no Gemini substitution |
| Full native canary/gameplay/workout/resume/persistence | [Blocked] NOT VALIDATED for the same provider/runtime evidence gap |
| Expo Doctor | [Verified by command] FAIL classification: 20/21 checks passed, 14 Expo patch-level mismatches |
| GitHub Actions | [Blocked] all four current workflows failed in zero-step jobs; exact GitHub-side cause remains indeterminate |
| Human validation | [External/manual validation pending] no human participant or physical iOS/Android device was available in this session |

The exact SDK and CI classifications are in
evidence/campaign030/CI_AND_SDK_CLASSIFICATION.md. The exact human protocol is
in evidence/campaign030/HUMAN_VALIDATION_HANDOFF.md.

## Campaign 029 assumption cross-check

The following matrix distinguishes structure that the native tree can prove
from visual hierarchy, density, comprehension, and completed-flow claims that
require actual pixels or dynamic sessions.

| Campaign 029 assumption | Campaign 030 classification | Evidence |
| --- | --- | --- |
| Home presents too many systems at once | PARTIALLY CONFIRMED | [Observed runtime] Home tree contains Today/workout, progress, reroll, game-leg content, and navigation; [Blocked] above-the-fold visual density and competition cannot be judged |
| Today is not visually dominant | PARTIALLY CONFIRMED | [Observed runtime] Today and the workout CTA are early, explicit semantic nodes; [Blocked] visual dominance is unverified |
| Games behaves as a catalog/database rather than discovery | CONFIRMED | [Observed runtime] Games exposes 42 games, search, domain filters, featured/recommended content, and favorites |
| Progress leads with analytics before a concise answer | PARTIALLY CONFIRMED | [Observed runtime] time windows, overall performance, domain count, and empty history structures are present; [Blocked] visual order and data-loaded comprehension are unverified |
| Profile and Rewards expose too many competing systems | PARTIALLY CONFIRMED | [Observed runtime] Profile contains identity/level/XP/streak/milestones and Rewards contains claim/balance/collection/cosmetics; [Blocked] visual competition is unverified |
| The visual language is overly expressive/arcade-like for a serious training tool | STILL UNVERIFIED | [Historical] source/design audit hypothesis only; [Blocked] all visual captures |
| Game identity is weak before play | PARTIALLY CONFIRMED | [Observed runtime] Game Detail and Intro expose title, description, mastery/difficulty, and tutorial affordances; [Blocked] whether the visual identity is strong enough is unverified |
| Results should be stronger and more focused | STILL UNVERIFIED | [Observed runtime] only the no-session Results empty state was reached; no completed result was observed |
| The four-tab shell is a sensible foundation | CONFIRMED | [Observed runtime] Home, Games, Progress, and Profile routes and semantic navigation were populated |
| Onboarding comprehension is unclear or absent | CONFIRMED structurally; first-run comprehension still unverified | [Verified in source] no separate onboarding flow was established; [Observed runtime] route sweep begins at Home while first-game tutorial controls exist; [Blocked] a true first-install journey and comprehension study |
| Gamification competes with training | PARTIALLY CONFIRMED | [Observed runtime] Home/Profile/Rewards expose XP, streaks, coins, claims, milestones, and cosmetics alongside training; [Blocked] visual prominence and user decision impact |
| Light and dark modes should be equivalent | PARTIALLY CONFIRMED | [Observed runtime] light/dark XML structures, route verification, and a11y counts match; [Blocked] visual theme equivalence because both frame sets are black |
| The golden path is technically reliable | PARTIALLY CONFIRMED | [Observed runtime] install, Metro-backed launch, Home, Game Detail, and Intro route loading succeeded; [Blocked] gameplay, pause, result, workout completion, resume, and persistence; [Historical] earlier campaign evidence is not a current native replay |

No Campaign 029 assumption was contradicted by observed structure. Several
visual and completed-session hypotheses remain open rather than being promoted
to facts. No redesign plan correction is authorized by this evidence packet.

## Historical prerequisites before Campaign 031

The following prerequisites were the pre-implementation gate. Campaign 031
resolved the repository-owned runtime prerequisite and recorded the remaining
external/manual limitations in its closure; they are retained here as
historical context.

Before Campaign 031, the strict readiness contract required all of the
following:

1. Provide a dedicated Campaign 030/031 AVD or supported runtime configuration
   that publishes non-uniform native app pixels without touching the
   user-owned emulator. Re-run the full light/dark screenshot matrix and
   visually inspect the golden path.
2. Provide the authorized OpenCode Go credential in the external ARTEMIS
   environment, then run the required Flash and Pro canaries, workout
   continuation/completion, interruption/resume, relaunch, and persistence
   journeys. Do not substitute the doctor's default Gemini configuration.
3. Resolve or explicitly accept the Expo patch drift in a separate maintenance
   decision after runtime readiness. Do not mix dependency/prebuild changes
   into the redesign campaign.
4. Diagnose the GitHub Actions zero-step failures through repository owner or
   GitHub account/service settings. Do not edit workflows merely to make the
   symptom disappear.
5. Complete the human accessibility/manual handoff on a real device or
   approved external validation setup.

At that prior checkpoint, the honest verdict was `BLOCKED_NOT_READY`; it is not
the current Campaign 031 outcome.

## Files delivered

- docs/redesign/REDESIGN_READINESS_REPORT.md
- docs/redesign/evidence/campaign030/RUNTIME_MATRIX.md
- docs/redesign/evidence/campaign030/SCREENSHOT_INDEX.md
- docs/redesign/evidence/campaign030/ENVIRONMENT_DIAGNOSIS.md
- docs/redesign/evidence/campaign030/CI_AND_SDK_CLASSIFICATION.md
- docs/redesign/evidence/campaign030/HUMAN_VALIDATION_HANDOFF.md

[Verified by command] The documentation-only diff contains no product source,
dependency, Expo, CI, schema, game, workout, or validation-harness changes.
