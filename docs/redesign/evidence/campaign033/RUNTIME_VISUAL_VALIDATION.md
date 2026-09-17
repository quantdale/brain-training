# Campaign 033 native/runtime validation

## Target and capture method

- Android target: dedicated `braintraining-ui35`, serial `emulator-5554`, Android 15/API 35, package `com.braintraining.app`.
- Capture tool: repository `scripts/qa/ui-capture.mjs`, using ADB deep links, screenshots, and UIAutomator XML dumps; no host mouse/keyboard injection.
- Captures: default profile, Progress overview plus Progress Detail and Progress Activity, light and dark themes; separate sparse and populated overview captures.

## Populated journey

ARTEMIS Flash task `4da312ad-74fd-4976-ada2-df23f943f9d5` used only visible app controls to open Games, play Odd One Out, complete a six-round standalone session, and return through Game Detail to Progress. Its final result reported one saved session, score 625, accuracy 83%, five of six rounds passed, `+30 XP`, and `+6 coins`. The resulting Progress capture independently showed one trained day, one session, and one session per active day, with the insufficient-movement copy visible.

No fake source fixture, direct database injection, purchase, or production-data alteration was used for the populated state. The emulator's actual SQLite file was observed at `files/SQLite/brain-training.db` and contained the persisted app database after the legitimate run.

## Rendered evidence

- Before populated index: `D:/Temp/campaign033-runtime-before-live/manifest.json`.
- After populated index: `D:/Temp/campaign033-runtime-after-populated/manifest.json`.
- Before sparse index: `D:/Temp/campaign033-runtime-before-sparse/manifest.json`.
- After sparse index: `D:/Temp/campaign033-runtime-after-sparse2/manifest.json`.

All after entries were nonblank and route-verified. Both after Progress themes were inspected as actual pixels; the dark capture retained readable contrast and the same answer order.

## Runtime health

After a fresh force-stop/relaunch, the current logcat sample contained successful `bootstrap-db-init`, `bootstrap-progression`, and `progress-snapshot-load` markers with one repository row and no fatal exception, SQLite exception, database-lock, ANR, or ReactNativeJS error signature in that fresh sample. A prior pre-clear emulator log contained a historical focus ANR and Metro WebSocket retry warnings; those were not reproduced in the fresh sample and are not represented as a global clean-log claim.

