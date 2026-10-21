# Platform readiness — Campaign 080

Campaign: `080-native-product-quality`
Principle: Android build, Android emulator runtime, Android ARM64 runtime,
Android physical runtime, iOS compilation, iOS simulator runtime, and iOS
physical runtime are **separate statuses**. No tier is inferred from another
tier's evidence. Source-test success is never recorded as native runtime, and
compilation is never recorded as runtime testing.

---

## Status matrix

| Platform tier | Status | Evidence | Limitation |
|---|---|---|---|
| **Android build** | **PASS** | Android Build Smoke #448 (run 39553587657) green at baseline `f8ae95dd`; clean native `assembleRelease` build (Campaign 079). | — |
| **Android emulator runtime (x86_64)** | **PASS (broad)** | 42-game native sweep + journeys on `braintraining-qa36` (emulator-5554, x86_64). See `native-coverage-matrix.md`, `gameplay-regression.md`. | Software-rendered (SwiftShader); frame numbers not physical-representative. |
| **Android ARM64 runtime** | **NOT VALIDATED** | No ARM64 emulator image validated. x86_64 emulation does not qualify ARM64-native behavior. | Requires an ARM64 system image / physical device. |
| **Android physical runtime** | **NOT VALIDATED** | No physical device connected. Physical performance, touch, thermal, and ARM64 compatibility cannot be inferred from x86_64 emulation. | Requires a real Android device; procedure/checklist prepared (`handoff.md`). |
| **iOS compilation** | **PASS** | iOS Build Smoke #449 (run 39553587616) green at baseline `f8ae95dd` (macOS runner, `expo prebuild` + Xcode compile). | Compilation ≠ runtime. |
| **iOS simulator runtime** | **NOT VALIDATED** | No simulator boot/install/launch smoke lane established in this campaign. | Hosted-CI simulator runtime feasibility assessment below. |
| **iOS physical runtime** | **NOT VALIDATED** | No iOS device. | Requires a real iOS device + owner acceptance. |

---

## G1 — Android

- Comprehensive native validation was performed on the available **x86_64** AVD
  (the 42-game sweep and journeys). This is the deepest Android tier actually
  executed.
- **ARM64:** the current environment exposes x86_64 system images; a practical
  ARM64 emulator image was **not** brought up this campaign, and x86_64 emulation
  does **not** qualify ARM64-native behavior. The ARM64 qualification gap is
  **retained** (not closed).

## G2 — Physical Android

Physical-device performance, touch behavior, memory, thermal conditions, and
ARM64-native compatibility cannot be inferred from x86_64 emulation and are
**not fabricated** here. A reproducible physical-device acceptance procedure and
artifact checklist is prepared in `handoff.md`; execution remains external until a
compatible device is connected.

## G3 — iOS simulator runtime

Existing hosted CI already compiles the iOS app on macOS runners. A minimal
simulator runtime smoke lane (boot → install generated app → launch → basic
navigation → crash/log evidence) is technically feasible with the available
tooling but was **not** implemented this campaign. Rationale: it requires a
macOS-hosted, reliably-bootable simulator lane whose cost/instability risk was not
validated; adding an unreliable lane to claim more coverage is explicitly
discouraged. The exact limitation (no simulator runtime lane established; only
compilation is green) is recorded rather than glossed. Distinguish: this is
**simulator runtime**, itself distinct from physical iOS qualification.

## G4 — Honesty

No generic "mobile validated" claim is made. Android runtime validation is
broad but x86_64-emulated; ARM64 and all physical tiers and iOS runtime are
open. The release matrix (`release-matrix.md`) keeps every tier distinct.

---

## Feasibility notes for the next operator

- **ARM64 emulator:** `sdkmanager --list` on the current SDK can install an
  `arm64-v8a` system image; on an x86_64 host this uses binary translation and is
  slow — a representative single runtime flow is the realistic scope.
- **iOS simulator smoke:** a GitHub Actions macOS job running `xcrun simctl boot`
  + `xcodebuild` install/launch against the prebuilt app is the standard lane; it
  should be added only with a stability budget and crash-log capture.
- **Physical acceptance:** see `handoff.md` for the device checklist.
