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

Android rebuild, final profile matrix, preservation comparison and owner handoff
are in progress; no native-after or ending-CI success is inferred here yet.
