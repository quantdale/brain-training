# Android cover qualification

Accepted production source: `359a80be81f6b6730622067294a3f24f607fdbd6`. Installed APK SHA-256: `fc2c99f7f4ffb668ed6ea9d79a5f91714e33178834b7bee6868360db045c605d` (52,733,728 bytes). [APK_PROOF.json](APK_PROOF.json) binds the bundle, source map, 989 matching own sources and decoded pixel matches for every packaged cover. Later delivery commits change evidence/state only.

The first changed APK exposed a real Android intrinsic Image sizing failure. It was rejected, the image bounds were repaired, and a second APK was built and installed before accepting these screenshots. [NATIVE_SIZING_RECOVERY.md](NATIVE_SIZING_RECOVERY.md) retains the failed original and recovery. Jest/snapshot approval was insufficient to discover that failure.

## Actual graphical device inspection

One dedicated visible emulator, `braintraining-ui35 / emulator-5570`, was used. Root personally opened every full-resolution original in the eight overlapping light and eight overlapping dark traversal captures; the original SHA-256 ledger is [NATIVE_IMAGE_REVIEW.json](NATIVE_IMAGE_REVIEW.json). The ledger filenames resolve under local `apps/mobile/qa-artifacts/campaign078/`; the two committed walkthrough montages are derived from those originals in sequence. All 42 covers were present, mapped to their titles and contained correctly. Shared colors did not collapse their subjects. Native numerals/words stayed registered to the image. [Light walkthrough](native-light-walkthrough.jpg) and [dark walkthrough](native-dark-walkthrough.jpg) are montages of actual application screenshots, not contact-sheet substitutes.

| Profile | Device setup | Inspected scope |
|---|---|---|
| Default light | 1080 Ã— 2400 / 420dpi / font1.0 | beginning, middle, end; all 42 covers |
| Default dark | same / night yes | beginning, middle, end; all 42 covers |
| Large text | same / font2.0 / light | full traversal captured; representative beginning/middle/end personally viewed; existing one-column fallback |
| Compact | same pixels / 540dpi â‰ˆ320dp / font1.0 | representative library positions, including middle/end |
| Compact + large text + dark | 540dpi / font2.0 / night yes | representative beginning/middle/end captures; middle/end personally viewed |
| Larger viewport | 1440 Ã— 2560 / 420dpi â‰ˆ548dp / font1.0 | settled beginning, middle, end personally viewed |

The first larger cold capture was unsettled: reserved image slots were briefly blank and system insets had not settled. It is retained locally and excluded from visual acceptance. A later settled capture at the same profile shows the correct images/insets: [larger settled top](after-larger-settled-top.png). Fixed slots prevent artwork-driven card-height shifts; instant rendering of every cold/asynchronous frame is not claimed. Covers retain their 1.6 aspect ratio and established 112dp card slot. No cover affects card touch targets.

Representative originals: [light Attention](after-games-attention.png), [light Spatial](after-games-spatial.png), [end](after-games-end.png), [dark Spatial](after-dark-spatial.png), [2Ã— text](after-font2.png), [compact/dark/2Ã—](after-compact-dark-font2.png), [larger](after-larger.png). Genuine installed-before/after pairs: [Attention](before-after-attention.jpg), [Spatial](before-after-spatial.jpg).

## Scroll, loading, navigation and accessibility

All artwork was inspected with Wi-Fi/mobile data disabled, including cold launch and scrolling. A fresh persisted witness [OFFLINE_PROOF.json](OFFLINE_PROOF.json) records Wi-Fi0/mobile0 and `Active default network: none` at 12:06:35UTC, an actual COLD Games launch (1348ms), personally inspected [cold frame](offline-cold-games.png) and three subsequent traversal frames through the list end while connectivity remains absent. This later witness is separate from the earlier performance sample. Every image is a packaged local require; there is no asset-service runtime dependency. Fixed 16-gesture diagnostics and a separate device-local walkthrough cover slow upward traversal and fast return scrolling. The actual recording is local `apps/mobile/qa-artifacts/campaign078/games-walkthrough.mp4` (4,949,597 bytes). Emulator guest timestamps produce a 62.65-second encoded duration despite a requested 40-second recording; extracted frames were personally inspected. Text/recording distortion remains visible in motion; settled originals are authoritative for composition. This is not a smoothness or input-latency certification.

ARTEMIS Flash task `19a123ac-ec8f-4c8a-b1f4-2d9d69333c16` completed six actual actions in 53.0s, checker off. It opened Memory from Games, entered its introduction, returned to detail and library, cleared search and restored All 42. Root personally inspected the detail/introduction/return originals. [Memory detail](native-memory-detail.jpg) and [Memory introduction](native-memory-introduction.jpg) show the same identity at larger caller sizes. Start game was not pressed; no timed round was started. This qualifies changed-surface navigation, not all 42 gameplay journeys.

Earlier ARTEMIS provider/daemon failures and partial coverage claims are not accepted as passes. Actual screenshots overrule the preliminary task summary that incorrectly claimed full traversal. External ARTEMIS traces stay outside Git; these files contain selected screenshots and task identities only. [ENGINEERING.md](ENGINEERING.md) records the recovery/limitations.

The actual library hierarchy retains each card's name/category/mastery accessible label and full clickable bounds. Decorative artwork words and glyphs do not appear as extra accessible controls. Focused source tests exercise unchanged Games/detail navigation callers and all four art sizes. Comprehensive TalkBack/VoiceOver is not claimed. The scoped current AndroidRuntime/ReactNativeJS error capture is empty; this does not erase historical ANRs or qualify unrelated workflows.

## Owner data and handoff

Both APK updates used install-r with the same signing certificate; all three SQLite files remained byte-identical across installation. After runtime inspection, all14 tables compare exactly with the current pre-change owner baseline, integrity is `ok`, and all15 saved sessions remain. [INSTALL_PROOF.json](INSTALL_PROOF.json) and [DATA_PRESERVATION.json](DATA_PRESERVATION.json) record these independent checks. No app reset, fixture loading, result forcing, replay completion or history deletion occurred.

At 2026-10-18 12:03:34 UTC the accepted APK was in foreground on Games, at Browse all games, showing42/42 and the first two-column covers. Root personally viewed [owner-handoff.png](owner-handoff.png). Original display/density/font/light theme/network settings were restored (1080 Ã— 2400,420dpi,font1.0,Wi-Fi1/mobile1/airplane0). The emulator window is visible and unminimized, process108764/handle919866. [OWNER_HANDOFF.json](OWNER_HANDOFF.json) and [GUI_PROOF.json](GUI_PROOF.json) record that witness. No host cursor, keyboard or foreground manipulation was used; the other emulator was untouched. A fresh post-CI witness is recorded with final delivery metadata.
