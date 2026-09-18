# Campaign 050 Runtime Notes

## ARTEMIS trace

Trace `b1b2be3a-6801-430b-b336-e89fda68f567` ran on only `emulator-5554` with
the installed release APK and Metro stopped. The trace notes contain the
semantic action history and checkpoint plan. The optional scrcpy recorder could
not start because the external host lacked the executable; this did not block
helper-hierarchy actions or app-state evidence.

The first post-install launch showed an Android `Brain Training isn't
responding` dialog. Wait recovered Home, and the required bounded recovery
closed the app once and cold-launched it once; that relaunch was responsive.
All subsequent protected in-app gameplay, persistence, route, and export-share
checks proceeded. A later Android Files provider ANR occurred while exercising
the import picker; the picker was dismissed/recovered without selecting a file.

## Direct health check

After ARTEMIS stopped, one emulator-local invalid-route intent and one direct
cold launch were run. The invalid screen was semantically inspected with the
ARTEMIS helper, then Back returned to Games and the Home tab showed the saved
workout. The final direct launch returned `Status: ok`, `LaunchState: COLD`,
`MainActivity`, and `TotalTime: 10047`; the activity was resumed after eight
seconds and filtered logcat had no targeted app error markers.

## Device restoration

The final device state was restored to physical 1080×2400, density 420,
`font_scale=1.0`, automatic rotation enabled, user rotation 0, and light
system theme. Only `emulator-5554` was queried or acted on in this campaign.
