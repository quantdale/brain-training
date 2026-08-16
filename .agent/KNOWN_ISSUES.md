# Known Issues / Blockers

## Current blockers

None. Campaign 001 is complete.

## Resolved during Campaign 001

- **GAME-ROUTE-TRAPPED-IN-NATIVETABS (High, fixed `d380699`)**: `/game/[id]`
  was unreachable from taps and deep links because the route lived inside the
  NativeTabs navigator, which only handles declared triggers. Fixed by moving
  tab screens into `app/(tabs)/` and making the root layout a Stack. Verified
  on-device; add a shell test covering route reachability when the router
  testing library supports it.
- `@types/jest` gap: wave-0 typecheck failure fixed in wave-1 convergence.
- Registry generator dropped the game `id` (fixed wave 2).
- Root README had a UTF-16 tail (fixed wave 0); remote history also fixed it.
- `.gitignore` vs committed `expo-env.d.ts` conflict (ADR 0004): resolved.

## Environment risks (host-dependent, not product defects)

- **Emulator instability (emulator 37.1.11 + WHPX on this host)**: the guest
  wedges (adb offline) under host memory pressure — observed twice during
  campaign-001 QA. Mitigations: stop gradle daemons after builds
  (`./gradlew --stop`), cold-boot with `-memory 3072`, use `avd.sh boot
  --retry 3`. Watch item for future campaigns.
- **Screencap black frames**: under `-no-window -gpu swiftshader_indirect`,
  `screencap`/`screenrecord` return black/empty for GPU-composited app
  content on the ATD image. uiautomator hierarchy dumps work and are the
  visual evidence. Try `-gpu host` if pixel screenshots become a hard QA
  requirement.
- **google_apis API 35 image** is unstable on this host (segfaults/freezes);
  the dedicated AVD `braintraining35` uses `aosp_atd` (documented in
  `docs/ANDROID_AUTOMATION.md`).

## Durable debt / polish (non-blocking, for later campaigns)

- Pause overlay is fully opaque but does not yet use a real blur backdrop;
  `expo-blur` is not installed. Optional polish when visual work begins.
- `use-theme.ts` has a latent `Colors[null]` edge if `useColorScheme()`
  returns null (harmless in practice).
- Shell test for route reachability (game route outside tabs) could not be
  written with the current router testing library; revisit with RNTL updates.
