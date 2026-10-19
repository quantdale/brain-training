# UI scale and responsive introduction correction

Bounded owner-requested repair from clean `origin/main` at
`2c0a990e3671192153f81bf1e971edef4a6db0a6`. Campaign 078 remains closed.

## Diagnosis

The oversized appearance primarily came from a deliberately compact accessibility
profile being used for the previous handoff. Its local `FINAL_DELIVERY.json`
records 840×1400 pixels, 420 dpi and font scale 2.0. Its handoff verifier explicitly
required those settings rather than the AVD's ordinary display profile. That
verifier's SHA-256 is
`2f365b91f89bb508515fc0769157cfa1a769520cfc3196d042a026ced6949032`.

At this session's arrival, ADB still reported the 840×1400 override; font scale
was already 1.0. The AVD configuration and `wm size` physical dimensions both
establish the original 1080×2400 display at 420 dpi. Only the size override was
reset. Density was already correct and was left alone. The same installed APK
then rendered balanced normal-size Home, Games, detail, introduction, active
gameplay, saved Results, Progress and Profile screens.

| Measurement | Ordinary profile | Compact accessibility profile |
|---|---|---|
| Framebuffer | 1080×2400 px | 840×1400 px |
| Density | 420 dpi / 2.625 px per dp | Same |
| Viewport | 411.43×914.29 dp | 320×533.33 dp |
| Android font setting | 1.0 | 2.0 |
| Start pressable height | 147 px = 56 dp | Prior native matrix: same 147 px = 56 dp |

The compact profile has only 45.4% of the ordinary framebuffer area, while
reading text is enlarged through Android's native accessibility scaling.
Android 14+ uses nonlinear text scaling; a literal doubling of every glyph is
not assumed. `ThemedText` passes nominal tokens to native text once. Its
`fontScale` branch changes heading line metrics to prevent clipped descenders;
it does not multiply font sizes. The previous tutorial repair changed neither
type tokens nor button dimensions.

Measured source values: body 16sp/24sp line height; reading copy 16sp/26sp;
game title 21sp/28sp; screen title 28sp/36sp; Android button minima 48dp,
large Start 56dp, filled lip 4dp; page gutter 16dp; stage padding 16dp/gap 8dp;
tutorial padding 24dp/gap 16dp. Existing role-specific scaling caps remain
unchanged. No new scaling restriction, font-size reduction or touch-target
reduction was introduced.

Two genuine layout defects were also reproduced:

1. **Introduction metadata consumed the identity's width.** At 320dp/font2,
   Order Path's `Place` kicker was absent from the native hierarchy. The
   unconstrained category occupied `[197,613][798,761]`; the title began at
   y893 after a tall mostly blank header. The shared row combined a fixed mark,
   a `flex:1` kicker with zero basis, and a trailing long category without wrap.
2. **A page retained bottom-sheet alignment.** At default/font1, the short
   tutorial began at y1573px (599dp), leaving most of the upper page blank.
   The previous repair correctly made the tutorial replace the introduction,
   but retained `flexGrow:1` and `justifyContent:'flex-end'` on its container.

## Small shared corrections

`GameStage` keeps the mark and kicker in an intrinsic group, bounds metadata to
the available width, and allows the two groups to wrap. Ordinary left/right
alignment remains when they fit. `GameHost` starts the tutorial at the top of
the existing route scroll flow by removing its obsolete growth/bottom alignment.

The visual target is the existing Campaign 077
[Play Lab reference lock](../../../openspec/changes/077-frontier-product-experience-rebuild/evidence/ART_DIRECTION.md).
Its Manrope hierarchy, cool canvas, restrained blue actions, local cover art,
16dp gutters and 8dp rhythm are retained. The two layout decisions implement
that lock's compact readable system and reachable introduction/tutorial pattern.
There is no new visual direction, asset, dependency, persistent format or game rule.

Tutorials still replace Start while open. Intrinsic content has no percentage
height cap. Completion reveals ordinary Start. Grid Navigator and Transform
Match retain their bounded nested ScrollViews. No absolute overlay, fixed-height
clipping or sticky control is added.

## Verification record

All three new metadata guards fail on the original source. The new short-tutorial
alignment guard separately fails on the legacy `flex-end` ancestor. Initial
focused after: 72 tests pass. Full final-source Jest: **710 suites / 8,002 tests /
five unchanged snapshots pass**, five classified existing opt-in skips,
294.919 seconds. No failed assertion or snapshot update.

TypeScript, full lint, strict OpenSpec 63/63, repository state, registry,
real-base provenance, task ownership, offline boundary, runtime-QA contract,
secret boundary, four-workflow hygiene, affected-area map, Expo alignment,
certifier self-test, dependency audit and web export (22 routes) pass.
The audit retains ten reviewed advisories. The self-test is not an independent
fresh-checkout certification. Independent source review found no concrete issue
in either correction.

Native baseline navigation: Flash `2933e2d7-46ab-46d3-851b-6cb06bae0fd6`.
Some early transition frames still show loading; separate settled PNG/XML
captures qualify Home, Progress and Profile. Pro
`6bf5e8f9-e0c0-4b4e-9faa-f6f4dd84b024` starts the real Order Path round, quits
the unsaved attempt normally and opens existing Transform Match Results.
The active board original is personally inspected. No new saved session is
required for this visual audit. External ARTEMIS traces remain outside Git.

One static capture's blocking UIAutomator wait lost its transport connection;
that failed capture is not accepted evidence. A fresh direct hierarchy/PNG
capture after the route settled supplies the Games witness. Existing build,
Expo/CSS/Node warnings remain visible in the raw logs.

## Accepted Android build

Release build: 576 tasks (24 executed), 6m8s, x86_64/debug signing. APK
52,734,320 bytes; SHA-256
`10e7a10ea80c3a985d3bc67981b6f7df559ce3c00400caa255c20b182bab9dde`.
All 1,162 production build inputs match; all 942 mapped application code sources
match, including both changed files. The packaged bundle is byte-identical to
the generated bundle, and all eight permissions match the repository allowlist.
The device transfer was independently hashed before `pm install -r` succeeded.
SQLite db/wal/shm remain byte-identical and all 13 table row digests match across
installation; all 18 saved sessions are retained. [Build proof](ANDROID_BUILD.json).

## Native findings after repair

Compact/font2 light and dark: the `Place` kicker is visible, with category reflow
below it. The title moves from y893 to y766 pixels. Start remains 147px/56dp high;
all five difficulty choices and How to play are reachable above the gesture bar.
Actual tutorial `[105,1064][427,1201]` Got it is fully visible; native XML proves
the underlying Start is absent. Normal completion returns an enabled Start.
Accepted Order Path traces: `55c30a9c-da67-4cd5-9dda-ab85e27f03ad`,
`2afb536a-cc64-4745-b3ee-c751303cee17`,
`82ebbbab-8e47-4e90-9e71-427cd8e3eb54`.

Grid Navigator's actual Demo at compact/font2/dark exposes all four commands
and all three answer boards through nested scrolling. The first candidate
capture clipped the third board's bottom; it is not full-board proof. A separate
follow-up reaches the full third board and bottom border. Normal selection of
the visible final cell reaches You've got it, Got it, then enabled Start.
Accepted traces: `e06455ee-c13e-41d9-8941-9b2c9e114ae3`,
`cc48dcc0-67ec-4134-b153-3fdfa0a03085`,
`e4b1e2d8-8b4c-4979-ab90-33c964aee45d`,
`d6c813fc-4c0a-4617-895d-031c3cc893d8`.
The last run used nine inner swipes; no gesture-efficiency claim is made.

ARTEMIS Flash and Pro initially inherited the same exhausted daily-500-call
model. Those cancelled runs do not qualify native behavior. The existing
same-provider `gemini-3.1-flash-lite` fallback was live-verified, temporarily
selected in external configuration, and restored byte-for-byte after native QA.
No credential was changed. One shell quoting attempt failed before any write.
A combined nested-canary run stayed on Order Path and is rejected; a later
checkpointed Pro run was stopped during planning. The accepted Grid route was
opened and verified directly before the short, single-route tasks above.
Some optional finalizer calls hit provider deadlines after actual UI completion;
only inspected native originals and actions qualify behavior, not status alone.

Transform Match at compact/font2/dark also reaches its source pattern through
inner scrolling, makes a normal correct selection, shows the completion Got it,
and returns to enabled Start. Trace `f1a55825-38f2-4056-8b95-8e7cf25a65e0`.
The options frame contains partial candidates, so it does not certify all full
candidate boards simultaneously; normal nested scrolling and completion are
qualified by the inspected sequence.

The rebuilt APK's default/font1 tutorial now starts at **y199px**, compared with
y1573px before. Got it is `[105,701][420,827]`, and Start is absent while the
tutorial is open. Trace `a1705367-10b5-4128-be82-749ca3fd941f`. Trace
`fc12f828-9e9b-4c14-93ad-735376077b86` then taps Got it and Start and reaches
the actual Round 1/5 board with clues and five item controls. Trace
`f2b4e4a1-c64e-42cf-a763-2c27ee897465` normally pauses/quits the unsaved attempt.
Pause on the expired-round feedback did not respond; Next round then Pause/Quit
worked. No saved session was created. This existing feedback-state behavior is
outside the introduction sizing correction and is not claimed repaired.

Seven representative native profiles pass visual/hierarchy review:

| Display | Font | Theme | Start height | Result |
|---|---|---|---|---|
| 1080×2400 / 420dpi | 1.0 | Light | 56dp | Balanced introduction; every difficulty and both actions fit |
| 1080×2400 / 420dpi | 1.0 | Dark | 56dp | Same composition |
| 1080×2400 / 420dpi | 1.5 | Light | 56dp | Readable larger text; intrinsic choices reflow |
| 1080×2400 / 420dpi | 2.0 | Light | 56dp | Metadata and choices wrap; scrolling retains actions |
| 840×1400 / 420dpi | 1.0 | Light | 56dp | Scroll reaches complete choices, Start and help |
| 840×1400 / 420dpi | 2.0 | Light | 56dp | Full Start/help and tutorial completion reachable |
| 840×1400 / 420dpi | 2.0 | Dark | 56dp | Same accessible reflow |

The native difficulty pressables measure 126–143px (48–54.48dp), including
their differing face/lip geometry, across the inspected font1/1.5/2 frames.
They grow modestly with native text metrics and wrap into more rows; they are
not giant fixed-height controls. [Control measurements](CONTROL_METRICS.json),
[profile matrix and frame hashes](NATIVE_MATRIX.json), and
[direct native hierarchies](hierarchies/) retain the measured evidence.
XML line endings are normalized for Git; all native node attributes are retained.
An independent reviewer inspected the seven profile pairs, plus Grid/Transform
images, and found no additional concrete sizing defect. Static images qualify
composition only; the named ARTEMIS sequences qualify interaction.

Two overlapping profile-capture attempts were rejected and recaptured
sequentially. A later dark-profile second hierarchy capture lost its UIAutomator
transport; a fresh settled hierarchy/PNG supplies its accepted Start frame.
No failed or mislabeled frame is counted as passing.
Trace `f8c9f609-1211-47cc-b656-9de5d9ade179` separately scrolls the full-display
200% introduction to show the entire Start and How to play above the gesture
bar. The accepted 200% Start frame is this final position, not its earlier
partially cropped help-button frame.

## Before/after and review screenshots

These are original device captures. The default and accessibility examples are
explicitly separated so enlarged text is not presented as the ordinary UI.

| Review | Before | After |
|---|---|---|
| Normal tutorial placement | [Bottom-aligned](screenshots/before-normal-tutorial.png) | [Top of scroll flow](screenshots/default-font1-light-tutorial.png) |
| Compact 200% identity | [Missing kicker](screenshots/before-compact-font2-header.png) | [Wrapped metadata](screenshots/compact-font2-light-header.png) |
| Ordinary introduction | [Baseline Start](screenshots/before-normal-start.png) | [Normal light](screenshots/default-font1-light-start.png) / [dark](screenshots/default-font1-dark-start.png) |

More originals: [150% introduction](screenshots/default-font15-light-start.png),
[200% introduction](screenshots/default-font2-light-start.png),
[compact 200% Start](screenshots/compact-font2-light-start.png),
[compact 200% tutorial](screenshots/compact-font2-light-tutorial.png),
[Grid full choices](screenshots/grid-full-choices.png),
[Transform completion](screenshots/transform-completion.jpg),
[actual gameplay](screenshots/default-font1-light-board.jpg).

The current rebuilt APK's settled normal-scale leaves are also inspected:
[Home](screenshots/default-font1-light-home.png),
[Games](screenshots/default-font1-light-games.png),
[detail](screenshots/default-font1-light-detail.png),
[Progress](screenshots/default-font1-light-progress.png),
[Profile](screenshots/default-font1-light-profile.png) and
[existing Results](screenshots/default-font1-light-results.png).
[Normal-screen hashes and hierarchy links](NORMAL_SCREENS.json).
The capture connection sometimes closes during route transitions. Those
transport failures do not qualify UI behavior; fresh settled sessions supply
the accepted XML/PNG. No production source change was made for tooling errors.

## Preservation and ordinary handoff

Post-runtime SQLite integrity is `ok`. All **18 saved sessions** and all twelve
non-tutorial table row digests are unchanged from arrival: profile, XP, currency,
ratings/history, quests, achievements, favorites and workouts. Only ordinary
tutorial completion/replay metadata changed. No fixtures, reset, migration or
database restoration was used. [Data preservation](DATA_PRESERVATION.json).

The dedicated emulator is left visible and unminimized with Brain Training in
the foreground on Order Path's normal introduction. Start is enabled/clickable
at `[87,1502][993,1649]`, fully on screen. Final display: **1080×2400 pixels,
420dpi, no size/density override, font1.0**. System day appearance and all three
animation scales1 are restored; the app's System theme preference is unchanged.
Only this emulator's test display/font/night settings were touched. No unrelated
device, host focus/input, app data or network setting was altered.
[Handoff settings and visible-window proof](HANDOFF.json),
[owner review screenshot](screenshots/owner-handoff-final.png).
Original external ARTEMIS configuration SHA-256 after restoration:
`1cc591b47c4d242b0832a157ae16c55ae9175c7397c981f15f5cd9e73472e30a`.

Source checkpoint `d11964ed6948b50e396278c69d252387f3c686fe` has all four
workflows successful: Repository Integrity39202701386, App CI39202701228,
Android Build Smoke39202701192 and iOS Build Smoke39202701273. Ending evidence
commit CI is separately checked at its actual SHA before delivery.

This is a bounded Android emulator recertification of the impacted shared
surfaces, not 42 complete gameplay journeys. Physical Android/ARM64/iOS runtime,
comprehensive screen-reader coverage and every viewport/font/theme combination
remain unvalidated. Existing Campaign 077 performance findings and dependency
advisories are unchanged.

The final evidence commit records preservation and the ordinary owner handoff.
Its four exact-SHA workflows and fresh post-CI handoff are checked after push;
the final response supplies the ending SHA and observed CI results. The local
`apps/mobile/qa-artifacts/ui-scaling/FINAL_DELIVERY.json` retains those live
observations without a self-referential commit hash.
