# Design — Campaign 050

Run authoritative repository checks from the current checkout and keep their
outputs classified as PASS, NOT VALIDATED, or BLOCKED. Build debug and release
sequentially so Gradle outputs are not shared concurrently. Install the
release APK on `emulator-5554`, stop Metro, and use release launch, route,
hierarchy, screenshot, and app-PID log evidence for the final Android check.

Reuse the already audited 42-game catalog, persistence database, four-game
workout, and Campaign 049 matrix when the relevant product source is unchanged;
record the exact source SHA and evidence lineage rather than calling inherited
evidence a new runtime execution. Re-run cheap high-risk canaries and any
affected checks after the Campaign 049 tab-chrome repair.

The final verdict must separate executable Android/repository certification
from human TalkBack/usability, physical-device/OEM, iOS/VoiceOver, store
signing, Android system-provider usability, and account/policy-blocked CI.
