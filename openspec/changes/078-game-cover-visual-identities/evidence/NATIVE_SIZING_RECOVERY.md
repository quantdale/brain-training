# Actual native sizing failure and repair

First built APK `9a1cb21afc0e4fa982cf6286f637cffb2fde88d9d349a59d600955e731256a3a`,52,733,644B, is NOT accepted. Source map matched989own sources; all 42packaged cover pixels matched originals; certificate matched existing app. Normal update succeeded with allSQLitefiles byte-identical.

Root personally inspected the actual offline Games screenshot `native-a-sizing-failure.png`: Card Sort's104dp companion was blank, while image geometry on recommendation cards was greatly enlarged/clipped. NativeSVG labels occupied the intended frame. Asset existence/dimension/source tests could not detect this native Image behavior.

Cause: React Native Image supplies intrinsic source width/height; absolute top/right/bottom/left alone do not override intrinsic dimensions on Android. A512×320image rendered at intrinsic layout dimensions inside its smaller art slot. The root added explicit100percent width/height on the Image, matching its fixedaspect parent and SVG overlay. Regression assertion now requires those dimensions for all four size presets.

Focused Games/library/detail/cover checks17tests PASS after repair; typecheck/lint and rebuilt native proof are recorded separately. Original failedAPK/screenshot remain retained; no metadata-only relabeling or asset regeneration is claimed as the fix. Gameplay/persistence implementation did not change.
