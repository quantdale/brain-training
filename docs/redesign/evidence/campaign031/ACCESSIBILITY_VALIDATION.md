# Campaign 031 accessibility validation

Date: 2026-09-17
Runtime: `emulator-5562`, 1080×2400, density 420, light and dark themes.

## Automated results

Dynamic state-tree audit:

```text
node scripts/qa/a11y-audit.mjs --dir D:\Temp\campaign031-runtime --density 420 --out D:\Temp\campaign031-runtime\a11y.json
[PASS] 0 violation(s) across 70 surface(s)
```

The final APK static capture audit also passed:

```text
node scripts/qa/a11y-audit.mjs --dir D:\Temp\campaign031-static-capture --density 420 --out D:\Temp\campaign031-static-capture\a11y.json
[PASS] 0 violation(s) across 6 surface(s)
```

The 70 dynamic surfaces include the changed Home, workout intro/tutorial,
active GameHost, pause, Results, Next, and completion trees in both themes.
All interactive nodes in the audited changed states were labelled, measured
at or above the 44dp minimum, and not clipped. The final static manifest also
reports all interactive nodes labelled with zero undersized/clipped nodes.

## Semantic contract observed

Stable IDs and meaningful labels included:

- Home: `home-workout-continue`, `home-workout-progress`,
  `home-workout-plan`, `home-workout-progress-bar`, `home-context`, and
  `home-workout-options`.
- Intro/tutorial: `<game>.workout-context`, `<game>.start`,
  `<game>.tutorial`, `tutorial-next`, `tutorial-skip`, and the concise
  mechanic/title/category content.
- Gameplay: `<game>.screen`, `<game>.pause`, `session-progress`, round/score
  markers, and the development-only QA marker/panel.
- Pause: `<game>.pause-overlay`, `<game>.pause-title`, `<game>.resume`, and
  `<game>.quit`.
- Results: `<game>.result-headline`, `<game>.result-facts`, `<game>.reward`,
  `<game>.next-context`, `<game>.next-game`, `<game>.workout-complete`,
  `<game>.workout-progress`, and `<game>.finish-workout`.

Representative semantic labels observed in the native tree were `Start today's
workout, 4 games`, `Today's workout, game 1, ready to start`, `Resume`, `Quit`,
`Next game. Context Fit · Game 2 of 4`, and `Finish workout. Back to Today`.
The visual/action order follows the semantic order: outcome before reward,
reward before continuation, and completion before finish.

## Theme and manual boundaries

Light and dark frames were visually inspected and are nonblank, high-contrast
product surfaces. The design uses text plus labels, not color alone, for
completion and progress. Reduced-motion preferences remain on the existing
shared motion hook; the CTA is not gated on animation.

The Android setup self-test passed 5 checks, failed 0, and recorded 2 warning
skips because the launcher hierarchy was empty before the app was foreground.
This is separate from the 70-surface dynamic audit and is not hidden.

Campaign 030B’s two localized 43dp Progress Detail rows and existing clipped
under-tab-bar notes were not touched by Campaign 031 and remain explicit
carried-forward findings. Font-scale 2.0, landscape, TalkBack/manual screen
reader, physical-device, iOS, and system-sheet behavior were not independently
performed in this environment; they are pending/deferred, not PASS claims.

Automated tree auditing is evidence of the checked surfaces, not a WCAG
certification.
