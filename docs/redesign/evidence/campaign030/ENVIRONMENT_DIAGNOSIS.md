# Campaign 030 Environment and Graphics Diagnosis

Date: 2026-09-17

## Scope and safety boundary

Only the disposable Campaign 030 runtime was operated:

- AVD: braintraining-c030
- Serial: emulator-5558
- Port: 5558
- Package: com.braintraining.app

No emulator-5554, braintraining-ui35, or other user-owned device was stopped,
restarted, installed to, reversed, or sent input. The only input used was
emulator-local setup/self-test input on the dedicated target. No host mouse,
keyboard, foreground window, or desktop focus was controlled.

The external ARTEMIS helper was inspected on the same dedicated serial. No
provider task was launched because the authorized provider credential was
absent. No credential value is recorded here.

## Host and tool versions

| Item | Observed value |
| --- | --- |
| Host | Windows 10.0.26200 |
| Android SDK | C:\Users\palac\AppData\Local\Android\Sdk |
| ADB | 1.0.41, 37.0.0-14910828 |
| Emulator | 37.1.11.0, build 15917651 |
| Acceleration | [Verified by command] WHPX 10.0.26200 installed and usable |
| AVD image | Android API 35 AOSP ATD x86_64 |
| AVD display | 1080 x 2400, 420 dpi |
| AVD memory | 1536 MB |
| AVD GPU config | hw.gpu.enabled = no, hw.gpu.mode = auto |
| ADB device product | sdk_slim_x86_64, Android_ATD_built_for_x86_64 |

The AVD config was read-only inspected before the graphics trials. It was not
edited.

## Reproducible launch sequence

The final supported-mode launch used the Windows emulator executable with the
following disposable target and flags:

    -avd braintraining-c030
    -port 5558
    -no-window
    -no-snapshot
    -no-audio
    -no-boot-anim
    -no-metrics
    -feature -Wifi
    -gpu swiftshader
    -verbose

The requested legacy mode swiftshader_indirect was tried first. Emulator help
for this installed version lists software, swiftshader, lavapipe, swangle,
host, and auto; swiftshader_indirect is not listed. The current equivalent
software and SwiftShader modes were tried as separate bounded launches.

For the JavaScript debug APK, the already-running local Expo/Metro server on
port 8081 was reused. Only the dedicated target received:

    adb -s emulator-5558 reverse tcp:8081 tcp:8081

The APK was installed with:

    adb -s emulator-5558 install -r -d -g apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk

That command returned Success. The repository launch helper then brought
com.braintraining.app/.MainActivity to the foreground.

## Observations

Boot and app:

- [Observed runtime] ADB state was device and sys.boot_completed was 1.
- [Observed runtime] package-manager readiness was reached.
- [Observed runtime] MainActivity became the current foreground activity.
- [Observed runtime] with Metro reversed, the route sweep had no RedBox and
  produced content-bearing XML trees.
- [Observed runtime] the route sweep started all 22 requested static theme
  captures and verified every route.

Framebuffer:

- [Observed runtime] every route PNG was valid, 1080 x 2400, and 10,195 bytes.
- [Observed runtime] every route PNG was uniform black.
- [Observed runtime] light and dark PNG hashes were identical.
- [Observed runtime] final PNG SHA-256 was
  9c7383dc015b03c1a5941e6a1d41073a7a09c6502f5d295ea419a11014847f44.
- [Observed runtime] debug.hwui.drawing_enabled was 0.
- [Observed runtime] dumpsys gfxinfo reported Total frames rendered: 0,
  GPU memory 0 bytes, 51 attached views, and 108.31 KB of render nodes.
- [Observed runtime] Window Manager showed MainActivity with a visible
  1080 x 2400 surface, HAS_DRAWN, and isOnScreen=true, while the published
  app buffer remained empty of pixels.

The semantic tree and the framebuffer therefore disagree in the useful way:
the JS/native view structure exists, but the compositor never publishes the
drawn content. This makes the failure an environment/runtime graphics issue,
not evidence of a blank product route.

## Bounded trial log

| Trial | Result | Interpretation |
| --- | --- | --- |
| swiftshader_indirect | Booted; uniform-black app frame | Requested legacy spelling did not recover pixels |
| software | Booted; uniform-black app frame | Current software renderer did not recover pixels |
| swiftshader | Booted; uniform-black app frame | Final current equivalent did not recover pixels |
| debug.hwui.drawing_enabled=1 diagnostic toggle | Transport became unresponsive and produced a 0-byte probe | Reverted by stopping/relaunching only the disposable AVD; not treated as product evidence |

The mode trials were stopped after the requested bounded investigation. No
other AVD was used as a substitute because the available google_apis host AVD
was associated with the user-owned/other-session emulator-5554.

## Accessibility evidence

The successful capture sweep is at D:\Temp\campaign030-capture and is indexed
in SCREENSHOT_INDEX.md. The a11y audit reported:

- 22 surfaces audited
- 0 undersized targets
- 0 unlabelled interactive nodes
- 0 total violations
- 2 clipped Games nodes, one in each theme, both the Signal Watch card

Per-surface interactive and labelled counts match. A final point-in-time
hierarchy helper invocation after the last launch retried twice and reported an
empty/failed dump. That does not erase the earlier 22 successful route XML
dumps, but the final helper invocation is not claimed as an additional PASS.

## ARTEMIS environment boundary

ARTEMIS doctor reported the external installation ready and the helper v6
installed and answering on emulator-5558. The doctor’s visible default planner
configuration is Gemini. Campaign 029 authorized the OpenCode Go union-alpha
route, and its credential was not present in the external environment.

Therefore:

- [Verified by command] ARTEMIS setup/helper readiness: PASS.
- [Blocked] Authorized Flash/Pro live task: NOT VALIDATED.
- [Blocked] Dynamic canary, gameplay, workout, interruption, resume, and
  persistence journeys: NOT VALIDATED.
- [Verified in source] No removed custom gameplay driver was reintroduced.
- [Inferred] A doctor-ready helper cannot substitute for the missing authorized
  model route.

## Diagnosis and next safe action

The strongest supported diagnosis is:

    AOSP ATD headless runtime + HWUI disabled + zero published app frames

The diagnosis is not “the app has no UI”: the route-verified XML trees,
attached views, and MainActivity surface disprove that. It is also not proven
that an Expo patch drift caused the graphics behavior. A future campaign needs
a dedicated framebuffer-capable AVD/runtime and must repeat the exact matrix
before using visual evidence for redesign decisions.

No product or emulator configuration workaround was committed.
