# Accessibility + responsive profile matrix — Campaign 080 continuation

Date: 2026-10-21
Status: **NOT EXECUTED this continuation — recorded honestly** (device time
consumed by the QA-contract repair + full catalog revalidation). Prior 080/079
semantic-label inspection stands but is NOT reclassified as profile testing.

Prepared: ADB-controlled profile protocol (per `journey-specs` requirements):
font scale via `settings put system font_scale` (compact/large/max), display
size via `wm size`/`wm density`, dark mode via `cmd uimode night` (the app reads
system appearance), reduced-motion via the app's motion settings, TalkBack via
`settings put secure enabled_accessibility_services` with honest note that
screen-reader *acceptance* needs human review — automation can only verify
focus traversal/labels reachability. Per-profile checks: primary-action
reachability, text clipping, scroll reachability, board layout, modal focus,
labels, contrast, feedback visibility, gameplay still possible.

Exact next action: a bounded 4-profile sweep (standard, font-scale 1.3,
max-scale, dark) over 3 representative games + Home/Results using the existing
capture tooling, then a TalkBack traversal attempt with documented service
limits. Semantic labels alone are explicitly not accepted as PASS.
