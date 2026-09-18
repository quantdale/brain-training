# Campaign 042 — Human and Platform Boundary

This packet certifies a technically observable Android scope. It does not
pretend that emulator automation is equivalent to independent human or
cross-platform certification.

`[NOT VALIDATED]` items:

- independent human visual/usability review;
- manual TalkBack and VoiceOver traversal;
- iOS build/runtime and physical-device behavior;
- production signing, store installation, and release distribution;
- OS document picker/share sheet behavior;
- battery, thermal, interruption, rotation, and accessibility-service behavior
  on physical hardware.

`[VERIFIED]` items in this campaign are limited to Android API 35 on the
dedicated `braintraining-ui35` emulator using release APK pixels, UIAutomator
hierarchy, ADB-local input, filtered logcat, direct SQLite inspection, and the
ARTEMIS readiness probe. The distinction is intentional and is part of the
technical verdict.
