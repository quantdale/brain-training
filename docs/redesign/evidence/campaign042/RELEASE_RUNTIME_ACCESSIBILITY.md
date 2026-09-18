# Campaign 042 — Release Runtime Accessibility

**Status:** `[PASS]` for the Android release technical matrix
**Date:** 2026-09-18

## Artifact and independence

The final release artifact was built with:

```text
versionName  0.1.0
versionCode  1000
debuggable   false
SHA-256      A15820A6B1CCC9AEDA707550B3DB39E50714166790936137CECAD7CA21981927
```

The release was installed and launched without a Metro server. Final cold
launch, offline relaunch, force-stop/relaunch, and font transition checks used
the installed bundle, ADB, and UIAutomator.

## Route/theme matrix

The final manifest at
`D:\Temp\campaign042\release-after-repair\routes-final\manifest.json`
contains 22 surfaces: 11 required routes in light and dark themes. All 22
were nonblank and route-verified. The automated accessibility audit at
`routes-final-a11y.json` reports:

```text
surfaces audited       22
violations              0
```

The surfaces include Home, Games, Game Detail, Progress, Progress Activity,
Progress Detail, Profile, Rewards, Data Management, Results, and Game Intro.

## Targeted runtime checks

- `[PASS]` Results screen was reached from the real result route in release.
- `[PASS]` Back, Play Again, Pause, Resume, favorite, theme, and navigation
  controls were exposed in UIAutomator and operated through emulator-local
  input.
- `[PASS]` Final controlled font transition and two offline relaunch runs had
  no targeted app error markers.
- `[PASS]` Automated audits reported zero violations for the compact and
  font-scale-2 responsive matrices as well as the route/theme matrix.

The route audit records two non-actionable clipped text notes on the Games/Home
Color Stroop/Word Chain cards at viewport edges. They are ordinary card-copy
edge observations, not clipped actionable controls or accessibility failures;
the exact notes are retained in the generated audit JSON.

## Platform boundary

This is technical Android release evidence, not a human TalkBack certification,
iOS/VoiceOver result, physical-device result, store-signing result, or proof
that an operating-system document/share sheet is reachable. Those boundaries
are recorded in `HUMAN_PLATFORM_BOUNDARY.md`.
