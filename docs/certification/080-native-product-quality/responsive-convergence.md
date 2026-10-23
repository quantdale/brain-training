# Responsive convergence — 2026-10-23

Status: **EXECUTED, bounded native evidence; qualification incomplete**.

## Identity and preservation

Dedicated `braintraining-qa36`, emulator-5554, x86_64, Android API 36,
physical 1080×1920/420dpi. Installed APK SHA-256:
`15fe8db35441678a74ea8a9a510058224197b86bde8564ed58bff60882c008cc`
(version 0.1.0/1000; application source predates the switch correction).
Stopped-profile anchor: `qa-artifacts/080/final-convergence/preserved-profile.tgz`,
SHA-256 `55f9a3e6ce86e1062fbaedd0d44693e998202844a41da0aab16c1764995e82df`.
SQLite snapshot integrity `ok`, 49 sessions. No wipe or restoration was performed.

## Executed evidence

`qa-artifacts/080/final-convergence/responsive-qualified-04/manifest.json`:
**42/42 bracketed captures**, no abort, actual resolved light/dark themes.
Three profiles × two themes × seven surfaces:

- Compact 320dp: density-only 540dpi, original framebuffer, font 1.
- Large/max tested font: system font scale 2, original density.
- Reduced motion: transition animation scale 0, original display/font.
- Home, Games, Memory detail, Memory first-play tutorial, latest saved Results,
  Profile, Backups & data.

Theme witness binds the installed APK to the preserved SQLite settings JSON;
missing theme preference resolves to `system` under the existing source contract.
Six contact sheets were visually inspected against these original captures.
Primary visible actions and text remain readable; expanded content below the
viewport is not a clipping defect merely because it requires scrolling.
No claim of full scrolling, keyboard, focus-order, contrast, live gameplay,
workout, destructive-confirmation, or TalkBack acceptance follows from these
static frames. Results is an existing saved result, not a new session witness.
Landscape request in the earlier run retained portrait app orientation: do not
claim landscape support/acceptance from its profile name.

Hierarchy audits used each profile's actual density. Compact and font-2 audits
returned exit 0 for measured visible controls. Reduced-motion audit returned
exit 1: native sensory switch `Sound effects. Gameplay and UI sounds` measured
46×27dp. This is a confirmed actionable target-size issue, not a clean audit.
A source correction gives both sensory Switch controls a 48×48dp minimum frame,
without duplicating accessibility nodes or scaling the drawn switch. Regression
`shell-a11y.test.tsx` fails before / passes after; focused settings tests,
typecheck and scoped lint pass. **Rebuilt APK/native after-proof remains required.**

## Retained failures and environment boundary

Earlier `responsive-01` saved 35/56 captures then the emulator process disappeared.
Its themes remain UNKNOWN and it is not the authoritative matrix. `default-02`
saved 0/14: fresh diagnostic PNG/XML established a System UI ANR dialog covering
Home. Crash buffer was empty; no application-crash attribution is made. Wait was
selected using fresh `android:id/aerr_wait` hierarchy bounds, followed by a
successful cold app launch (981ms, observation only, not a quiet benchmark).
`activity-baseline.txt` used an invalid dumpsys subcommand and is rejected.

After the successful matrix: physical display/density reset, font 1, original
transition scale 0, light system night mode restored. TalkBack is not installed
on this AVD. ARTEMIS doctor is BLOCKED on missing provider credential; no key was
read, printed, changed, or copied. TalkBack/runtime journeys remain NOT VALIDATED.
