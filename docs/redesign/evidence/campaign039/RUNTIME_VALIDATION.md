# Campaign 039 runtime validation

## Native matrix

After the Expo patch refresh and both native rebuilds, the release APK
(`7CACB25F2C4CCCC298BE2CB1360396BA1F5148121274926B44F8C028E144CB78`) was
installed over the existing app on `emulator-5554`. The capture command was:

```text
node scripts/qa/ui-capture.mjs --device emulator-5554 --out D:\Temp\campaign039-runtime-after-patch --surfaces home,games,game-detail,progress,progress-activity,progress-detail,profile,rewards,data-management,results,game-intro --theme light,dark
```

Result: **22/22 route-verified and nonblank**. The automated accessibility
audit over the same directory reported **0 violations across 22 surfaces**.
The only clipped visible-edge entries were the same ordinary scrollable
`Symbol Tracker` and `Buy Shield` entries observed in Campaign 038; the
campaign did not treat these as a regression or silently change layout.

The release Game Intro XML was 9,159 bytes and its PNG was a real rendered
GameHost frame. In contrast, the dev Metro route probe could remain on the
explicit `Loading… / Starting the game… / Cancel` fallback while a lazy game
module compiled. Release evidence separated this development warm-up from
supported bundled behavior.

## Before/after pixels

The pre-refresh release matrix is at `D:\Temp\campaign039-runtime-release`;
the post-refresh matrix is at `D:\Temp\campaign039-runtime-after-patch`.
Both sets were inspected as real PNG pixels. Stable, non-stateful surfaces
showed low single-digit changed-pixel percentages; the raw values varied with
status-bar time and capture timing. Profile and Rewards were not treated as a
controlled visual pair: the before Rewards frame visibly contained a real
load-error card, while the after frame showed the initialized local collection,
and the Profile viewport/system capture context differed. That large raw diff
therefore records state/capture variance, not a dependency-caused visual
regression claim.

## Functional paths exercised

- cold launch and repeated force-stop/relaunch;
- release Home, Games, Progress, Game Detail, Game Intro, Profile, Rewards,
  Data Management, Results, and Progress drill-down surfaces through deep-link
  capture;
- Games scrolling, search-field discovery, and a real `memory` search;
- release route arrival and three-cycle memory plateau probe;
- app-filtered logcat after repeated launches;
- package replacement with `adb install -r -d`, preserving the existing local
  app-data boundary.

No destructive data-management action was invoked. Manual backup/restore,
system document-picker sheets, iOS, physical devices, and human TalkBack/
VoiceOver validation remain outside this runtime pass.
