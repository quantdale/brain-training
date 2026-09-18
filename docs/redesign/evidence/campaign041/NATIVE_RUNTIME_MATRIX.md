# Native Runtime and Pixel Matrix

## Runtime under test

`[OBSERVED_RUNTIME]` Android emulator `emulator-5554`, AVD `braintraining-ui35`, API 35, 1080×2400, density 420, package `com.braintraining.app`. Automation stayed emulator-local through ADB, UI hierarchy, ARTEMIS, and repository QA scripts. No user-owned device or host cursor was used.

## Debug current-build surface matrix

`[OBSERVED_RUNTIME]` `scripts/qa/ui-capture.mjs` captured 22 current debug surfaces, all nonblank and route-verified: 11 light and 11 dark.

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

## Real interaction family evidence

Fresh transient captures in `D:\Temp\campaign041-families` show real production controls, not QA force completion: attention target count, Color Stroop wrong answer, Word Chain answer, Order Path choice, Equation Builder keypad input, Grid Recall cell selection, Fold Match response, and Color Match wrong response. The eight-family details are in the catalog and accessibility documents.

