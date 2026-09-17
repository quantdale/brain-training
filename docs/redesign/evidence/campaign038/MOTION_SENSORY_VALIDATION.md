# Campaign 038 motion and sensory validation

## Motion

The AVD was restored to its normal display settings after each capture. Final
device state was verified as:

- `font_scale=1.0`
- `window_animation_scale=0`
- `transition_animation_scale=0`
- `animator_duration_scale=0`
- physical display 1080×2400, density 420

React Native’s Android `AccessibilityInfo` implementation treats transition
animation scale `0` as reduced motion. The repository’s shared
`usePrefersReducedMotion` hook was inspected and the normal/large/compact
surfaces were exercised with this device condition. No functional gameplay
timer was changed or routed through the decorative-motion helpers.

## Sensory settings

The pre-fix interaction produced the real app disclosure
`[startup] failed to persist sensory settings … database is locked` after
rapid SFX/haptics changes. The focused regression test reproduced the same
race deterministically and was red before `a7f1531`.

After the queue repair, two immediate emulator-local taps produced:

- `D:\Temp\campaign038-fixed-off.xml`: SFX `checked="false"`; Haptics
  `checked="false"`.
- `D:\Temp\campaign038-fixed-off.log`: no SQLite-lock, ReactNativeJS failure,
  ANR, RedBox, or app fatal signature.
- `D:\Temp\campaign038-fixed-relaunch-settings2.xml`: both switches remained
  false after a cold relaunch.

Both switches were then restored with two immediate taps:

- `D:\Temp\campaign038-fixed-restored.xml`: both switches
  `checked="true"`.
- `D:\Temp\campaign038-fixed-restored.log`: no targeted app failure.
- A read-only `run-as` query after the restored cold relaunch returned profile
  settings containing `"sfx":true,"haptics":true` and
  `"progressionSeedVersion"`, confirming the profile row remained intact.

The transient `UiAutomationService already registered` fatal came from
overlapping hierarchy clients during the initial investigation. A single
capture run with the external helper temporarily isolated completed 22/22 and
the helper’s exact prior settings were restored. It is recorded as tooling
contention, not an app crash.

