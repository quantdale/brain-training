# Explore-stage device baseline (partial; not a certification)

Source `d3d0b9926a44c039d7fd0d29e1376586afaa897b`, installed release APK SHA-256 `d631ab9a410f9950f3c5cd989fe23b26d00178ecf98bafc439e86e85f20950a9`, dedicated Android emulator `braintraining-ui35` (`emulator-5554`, 1080×2400 px), app `com.braintraining.app`. `before/index.json` hashes all 20 preserved screenshots. Original per-screen accessibility XML and the most recent capture manifest remain locally in ignored `qa-artifacts/ui-reboot/before-d3d0b99/`; the capture script overwrote the root manifest during the font-scale-2 pass, so default-theme route-verification metadata is **not** preserved here. Do not treat default-theme route verification as an automated PASS.

| Profile | Light | Dark | What was captured |
| --- | --- | --- | --- |
| Default | 8 screenshots | 8 screenshots | Home, Games, game detail, Memory intro, Progress, Rewards, Profile, data management |
| 2× font scale | 4 screenshots | 0 | Home, Memory intro, Progress, Profile |

Visual observations after opening the PNGs: Home's decorative hero/workout block dominates the first viewport; Games' recommended-game hero pushes library discovery downward; game intro pairs an oversized art stage with an instructional sheet, making Start hard to see in the first viewport. At 2× text, Home's first-run primary action falls below the initial viewport, and the intro remains tall; scrolling is available but discoverability requires redesign. Dark mode is largely a palette inversion of the same composition. These are observations of **these** screens, not a review of gameplay or of every route.

**Missing before evidence:** every active board, answer feedback, pause/resume, timeouts, game result, standalone Results, workout completion, search/empty states, storage error/restore and remaining route states; seven other domains; compact/tablet sizes, dark 2× text, iOS. Capture these against the still-available pre-change APK and SHA before modifying each affected presentation. If a required state proves unreachable, report NOT VALIDATED with a cause; never synthesize a before screenshot from new code. ARTEMIS runtime journeys were not run at this Explore stage. Historical redesign certificates are not visual acceptance for this change.
