# Android Limited-Beta Readiness — owner-authorized 14.3 debt exception (2026-10-13)

> **Owner authorization (2026-10-13):** parent task **14.3**'s documented
> visual-comparison evidence debt (no matched before/after image set with observed
> theme witnesses — see `../076-product-wide-ui-ux-reboot/evidence/VISUAL_DECISION.md`)
> is **accepted for a limited, private Android beta evaluation**, subject to the
> repository's release policy. This is a **beta-specific exception, not proof the
> missing evidence exists**:
> - parent task **14.3 remains OPEN** with unchanged criteria;
> - the formal release verdict remains **`CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED`**;
> - the missing evidence is **not** fabricated, inferred, or relabelled.
>
> **Out of scope by owner instruction:** no historical APK rebuild, no repeated
> 42-game ARTEMIS sweep, no re-run of the nine controller journeys.
>
> **Distribution gate (owner):** the beta may **not** be distributed until the
> **physical-device** smoke test passes and this exception is documented.

## Release candidate

| Property | Value |
| --- | --- |
| Artifact | `apps/mobile/android/app/build/outputs/apk/release/app-release.apk` |
| Size | 48,888,528 B |
| SHA-256 | `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6` |
| Source | application source `d5787ec` (D3 repair); provenance unchanged since (validator PASS) |
| Rebuilt this session | **No** — the existing artifact was used; disk hash and device hash both match exactly |

## Signing and versioning assessment

| Item | Measured | Beta suitability |
| --- | --- | --- |
| Package / applicationId | `com.braintraining.app` | OK |
| versionName / versionCode | `0.1.0` / `1000` (`with-deterministic-version` plugin) | OK for sideloaded beta; Play Store needs a monotonically increasing upload version |
| Release signing | `signingConfigs.debug` — the committed Expo `debug.keystore` (alias `androiddebugkey`) | **Acceptable for a limited private/sideloaded beta only.** A production upload keystore + Play App Signing is a prerequisite for any store release; a debug-signed release APK must never be published as a store artifact |
| Permissions | deny-by-default gate: 8/8 expected set (CI Android Build Smoke PASS) | OK |
| min/target SDK | 24 / 36 | OK |

## Evidence boundary

All runtime evidence below was produced on the **dedicated emulator AVD
`braintraining-ui35` / `emulator-5570`** (Android 15, API 35, 1080×2400@420). It is
**emulator evidence, not physical-device proof**. The owner's distribution gate
requires the same smoke on a **physical Android device**, which was **not attached**
to this host at verification time (see Blockers).

## Smoke results (emulator, release APK `c8c3d46c…`)

| Check | Result | Evidence |
| --- | --- | --- |
| Artifact identity | **PASS** — disk SHA-256 and installed `base.apk` SHA-256 both equal `c8c3d46c…` | `adb shell sha256sum` of installed APK |
| Fresh install | **PASS** — uninstall → install `Success`; package present | install logs |
| Update/reinstall | **PASS** — `adb install -r` `Success` over an existing same-versionCode install | install log |
| Install durability | **PASS** — app install and data survived an emulator cold restart; hash still `c8c3d46c…` | post-restart `pm path` + `sha256sum` |
| Cold startup | **PASS** — 5 cold launches, TotalTime 2735/2721/2037/1141/1425 ms; app window focused | launch timings |
| Startup stability | **PASS** — 4,396 logcat lines across the launches: **0** FATAL/ANR/exception/RedBox/SQLite markers; 5× `ReactNativeJS: Running "main"` | logcat scan |
| Home/Games content | **PASS** — 42/42 games listed, category chips, offline promise copy | hierarchy + screenshot |
| Gameplay (Memory) | **PASS** — Start game → Round 1/5 → sequence prompt → tap evaluated ("Round failed — expected 7·1·3·2") → Next round → Round 2/5 → Pause overlay ("timers are frozen", Resume/Quit) → Quit returns safely to Games | screenshots 02–08 |
| Gameplay offline (Target Count) | **PASS** — network fully disabled ("Active default network: none"), cold launch + Start game → Round 1/8 board with live prompt | screenshots 13–15 |
| Workout persistence | **PASS** — started today's workout (4 games, leg 1 Card Sort), force-stopped mid-workout, relaunched: Home still shows 0/4 "Next: Card Sort · Start workout"; Data Management shows "1 workout instances · 0 tutorial states" | screenshots 09–12, 18 |
| Recovery | **PASS** — `braintraining://game/not-a-real-game` → "Game not found — This game is not in the library…" → "Back to library" → Games | screenshots 16–17 |
| Honest empty state | **PASS** — Progress renders "No sessions yet" after no completed session (no fabricated history) | screenshot 19 |

Raw artifacts: `qa-artifacts/beta-smoke/` (screenshots 01–19 + hierarchies).

## Blockers (separate from the accepted 14.3 evidence debt)

1. **Physical-device smoke — BLOCKED (owner action required).** No physical Android
   device is attached to this host (`adb devices` lists only the emulator; Windows
   PnP shows no Android USB device). The owner's distribution gate requires the
   install/update, offline, gameplay, workout-persistence, startup-stability and
   recovery smoke above to pass on a **physical** device before any beta
   distribution. Steps: enable USB debugging on the test device, connect it, verify
   `adb devices` lists it, then re-run this smoke against it.
2. **Store signing — BLOCKED for store release (not for a sideloaded private beta).**
   The release build is debug-signed; any Play release requires an upload keystore
   and Play App Signing.
3. **iOS runtime — NOT VALIDATED (external).** No macOS/Xcode host; unchanged by
   this evaluation and not implied by any Android result.

## Verdict

**Android limited-beta readiness: PASS on the emulator lane, one owner-gated
blocker open (physical device).** The 14.3 visual-comparison evidence debt is
accepted for the limited private beta by owner authorization and remains OPEN for
formal release certification. No production code, APK, ARTEMIS sweep, journey
re-run, or campaign was created by this evaluation.
