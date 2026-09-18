# Native Runtime and Pixel Matrix

## Runtime under test

`[OBSERVED_RUNTIME]` Android emulator `emulator-5554`, AVD `braintraining-ui35`, API 35, 1080×2400, density 420, package `com.braintraining.app`. Automation stayed emulator-local through ADB, UI hierarchy, ARTEMIS, and repository QA scripts. No user-owned device or host cursor was used.

## Debug current-build surface matrix

`[OBSERVED_RUNTIME]` `scripts/qa/ui-capture.mjs` captured 22 current debug route/theme surfaces, all nonblank and route-verified: 11 light and 11 dark. These are not 22 distinct product states; the same route set is captured under two themes. The state-level requirements below are therefore reported separately rather than inferred from the route count.

| Surface | Light | Dark | Notes |
|---|---|---|---|
| Home | PASS | PASS | Fresh/active Home pixels inspected; a transient light LogBox overlay was caught in one run. |
| Games | PASS | PASS | Catalog surface rendered. |
| Game Detail | PASS | PASS | Populated detail route rendered. |
| Progress | PASS | PASS | Empty/populated route captured. |
| Progress Activity | PASS | PASS | Activity drill-down rendered. |
| Progress Detail | PASS | PASS | Per-game/domain detail rendered. |
| Profile | PASS | PASS | Profile state rendered. |
| Rewards | PASS | PASS | Rewards state rendered. |
| Data Management | PASS | PASS | Backup/data controls rendered. |
| Results | PASS | PASS | Result route rendered. |
| Game Intro | PASS | PASS | Intro/tutorial route rendered. |

The debug matrix was rerun after reset into `qa-artifacts/campaign041-native-repro`; the final replay had no workout error and no LogBox overlay. PNGs were real rendered native pixels, not snapshots substituted for runtime.

## Required state coverage reconciliation

| Required current state | Campaign 041 evidence | Classification |
|---|---|---|
| Home fresh / active / completed | Fresh and active Home captures; completed Home and relaunch were observed during the workout path | `[OBSERVED_RUNTIME]` completed through separate flow, not represented in the 22-route manifest |
| Games default / search / category filter / Favorites / no results | Games default route and source/tests; search/catalog behavior was exercised in earlier current runtime work but no Campaign 041 themed PNG for every branch was retained | `[PARTIALLY_VERIFIED]` current behavior lead, not a complete pixel matrix |
| Game Detail populated | Light/dark route captures and 42 detail routes | `[OBSERVED_RUNTIME]` |
| Intro/tutorial / active gameplay / pause | Intro capture, eight real active-family interactions, and pause/resume observation | `[PARTIALLY_VERIFIED]` representative runtime evidence, not one retained PNG per state |
| Per-game result / workout final result | Result route capture; real per-game/final workout screens inspected | `[OBSERVED_RUNTIME]` separate flow evidence |
| Progress empty / populated / domain/game drill-down | Progress, Activity, and Detail route captures; fresh-state empty DB and populated DB were inspected | `[PARTIALLY_VERIFIED]` route/state evidence, not every combination in the manifest |
| Profile / Rewards empty and populated / Data Management / settings | Profile, Rewards, Data Management route captures; settings persistence tests and native data-management flow | `[PARTIALLY_VERIFIED]` settings and both rewards branches are not a complete retained pixel set |
| Invalid route recovery | Source/tests and prior current runtime lead | `[NOT VALIDATED]` no dedicated Campaign 041 PNG/manifest row |
| Loading and error boundaries | Loading roots are part of expected test IDs; one real workout-load error was observed and later recovered | `[PARTIALLY_VERIFIED]` no clean retained pixel for every loading/error branch |
| Large text / compact viewport | 12 responsive captures and zero analyzer violations; visible Home row clipping risks | `[OBSERVED_RUNTIME]` |

This reconciliation is deliberate: the current evidence supports strong representative Android rendering and navigation, but not a claim that every required state was freshly captured in the 22 themed screenshots.

## Responsive matrix

`[OBSERVED_RUNTIME]` A light-theme matrix covered six surfaces under each profile: Home, Games, Game Detail, Progress, Profile, Results.

| Profile | Captures | Nonblank/route-verified | A11y audit | Observation |
|---|---:|---:|---:|---|
| Compact 720×1600 / density 320 | 6 | 6/6 | 0 violations | Home Color Stroop row appeared clipped to approximately 27dp visible height. |
| Font scale 2 | 6 | 6/6 | 0 violations | Home Order Path row appeared clipped to approximately 19dp visible height. |

The clipping observations are current visual risks, not hidden behind an all-green a11y count. They remain open for a product-layout decision; no source change was made during this audit.

## Release-boundary matrix

`[VERIFIED_BUILD]` A release APK was built, installed after Metro was stopped, and launched. The direct cold test reached Home after approximately 35 seconds of native splash/startup; this delay was measured rather than silently treated as instant. Release captures covered Home, Games, Game Detail, and Game Intro in light and dark: 8/8 nonblank and route-verified. The release Home screenshot showed the daily four-game plan and no development QA panel. ARTEMIS hierarchy inspection on release also saw semantic intro labels including Memory, description, difficulty, Start game, How to play, and Watch demo.

The release UI-capture script emitted “app did not warm within 90s” warnings for its first light/dark default resets, but still produced 8/8 valid captures. This is a startup/tooling performance concern, not evidence that the release route is absent.

`[BLOCKED]` Release XML/a11y extraction was unavailable because the existing ARTEMIS helper/UIAutomation service was already registered (`UiAutomationService ... already registered!`). `adb run-as` was also unavailable for the release package because the variant is non-debuggable, so release SQLite was not pulled through `run-as`. Debug persistence was inspected directly and release pixels/hierarchy were cross-checked separately.

An additional final clean-launch attempt after the release matrix produced a uniform dark app surface while `MainActivity` was resumed; a subsequent `screencap` returned a zero-byte file although ADB still reported the device connected. Logcat contained no app fatal signal. Given the documented dedicated-AVD surface wedge and the concurrent UiAutomation contention, this is classified as `[BLOCKED]` emulator/rendering evidence, not as a release PASS or a newly repaired product defect. The earlier 8/8 release captures remain the usable release pixel evidence, and this later failure keeps release-startup confidence conditional.

## Real interaction family evidence

Fresh transient captures in `D:\Temp\campaign041-families` show real production controls, not QA force completion: attention target count, Color Stroop wrong answer, Word Chain answer, Order Path choice, Equation Builder keypad input, Grid Recall cell selection, Fold Match response, and Color Match wrong response. The eight-family details are in the catalog and accessibility documents.
