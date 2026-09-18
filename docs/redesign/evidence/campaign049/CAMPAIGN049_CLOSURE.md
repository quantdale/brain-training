# Campaign 049 Closure

**Terminal label:** `CAMPAIGN_049_COMPLETE` for the bounded Android/repository
scope  
**Start SHA:** `978adc5`  
**Closing product change:** native tab label sizing plus a focused regression
test  
**Runtime:** `braintraining-ui35` / `emulator-5554`, Android 15/API 35,
1080×2400, density 420 after profile restoration

Campaign 049 extended the existing release matrix into compact and large-font
profiles in both themes. The first large-font capture reproduced a fixed
native-tab chrome collision. The smallest scoped repair caps only the painted
four-item native tab labels at 9sp when the system font scale is at least 1.5;
normal text remains on the 12sp caption token, and the full trigger labels and
accessibility names remain unchanged.

## Results

- **Responsive capture:** PASS — post-fix compact 12/12 and font-scale-2
  12/12 surfaces were route-verified, nonblank, and captured with hierarchy
  dumps. The six surfaces were Home, Games, Game Detail, Progress, Profile,
  and Data Management in light and dark themes.
- **Accessibility audit:** PASS — post-fix compact and font-scale-2 audits
  both reported 0 measured undersized or unlabelled interactive violations.
  Viewport/tab-bar clipped rows remain visible in the per-surface reports and
  are not target-size violations under the audit contract.
- **Large-text fixed chrome:** PASS — post-fix screenshots show distinct,
  readable Home/Games/Progress/Profile labels at system font scale 2; tab
  trigger names remain semantic and selectable.
- **Focused regression:** PASS — the new `nativeTabLabelFontSize` test passed
  2/2; typecheck and lint passed.
- **Release build:** PASS — `assembleRelease` first hit a transient
  `:app:packageRelease` incremental splitter failure, then the identical
  package task passed without source changes. The installed APK SHA-256 was
  `8F111FB590B7957AC710A05A53A422AACC1A95DE8C609F7B01152C40141B1864`.
- **Release launch:** PASS — the installed artifact cold-launched with
  Activity `TotalTime: 6426 ms`, `MainActivity` displayed, and no filtered
  app fatal/ANR/React error/SQLite-lock/OOM marker was found.
- **Device restoration:** PASS — final display was 1080×2400 at density 420,
  `font_scale=1.0`, light system theme, and automatic rotation enabled.

## Boundaries

Campaign 049 does not claim human-quality TalkBack, physical-device Android,
iOS/VoiceOver, store-signing, or human system-share/document-provider
usability. Reachability and return evidence for Android Share and DocumentsUI
is inherited from Campaign 043; reduced-motion and sensory persistence evidence
is inherited from Campaign 038 because those product surfaces were unchanged.

New evidence and raw artifacts are documented in this directory and remain
outside Git under `D:\Temp\campaign049-matrix` and
`D:\Temp\campaign049-matrix-fixed`.
