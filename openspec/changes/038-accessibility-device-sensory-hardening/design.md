# Design — Campaign 038

## Evidence-led investigation

Start with a normal-font clean state and preserve a matching baseline before
changing source. Re-run the same 22 light/dark surfaces and use UIAutomator
XML, screenshots, and the repository audit as evidence. Then test a bounded
large-font setting, a smaller/expanded phone viewport where the disposable AVD
allows it, reduced-motion animation settings, system/theme transitions, and
the existing SFX/haptics switches.

## Bounded treatment

| Concern | Test or change | Protected behavior |
| --- | --- | --- |
| Tab-bar clipping / scrolling | Follow the clipped Profile and Games nodes to a settled scroll position; add the smallest shared inset/reachability fix only if a control cannot be fully reached. | Native tab routing, content order, action identity |
| Large text | Capture and inspect Home, Games, Profile/Settings, Rewards, Progress, Detail, and a GameHost entry at the tested OS scale. | Readable copy, CTA destinations, game board geometry |
| Motion | Verify existing shared reduced-motion plumbing with emulator settings and static/state transitions where observable. | Functional timers and session progression |
| Sensory | Toggle the existing SFX and haptics controls off and verify persisted/visible state on relaunch. | Settings persistence and gameplay controls |
| Theme/device | Exercise light/dark/system selection and any safe alternate viewport supported by the disposable AVD. | Contrast, safe areas, bottom tabs, scrolling |

Do not broaden the product surface to manufacture an accessibility setting that
the current app does not expose. Record unavailable manual/platform evidence as
NOT VALIDATED.

## Risk controls

- Keep the single `ScreenShell`, native tab, `Button`, `ListRow`, `Tappable`,
  and sensory-provider seams; avoid per-screen duplicate fixes.
- Use only `emulator-5554` / `braintraining-ui35` and restore any temporary ADB
  display/animation/font settings after observation.
- Run focused tests, full tests, typecheck, lint, affected validators, native
  captures, accessibility, and fresh logcat after any source change.
- Compare real pixels before/after; no snapshot-only visual claim.
