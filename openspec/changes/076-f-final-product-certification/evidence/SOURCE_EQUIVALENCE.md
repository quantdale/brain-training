# Source-equivalence record — 076-f terminal certification

**Change:** `076-f-final-product-certification`
**Task:** 1.3 — record the source-equivalence diff from `4a6fc53` to the current
application source, classify unchanged game frames, and list only the frames
that require recapture.
**Reconciled 2026-10-09** against a false "zero files" claim. This file now
records the measured diff. It is **not** acceptance.

## The measurement

```
git diff --name-only 4a6fc5349c334b4324e4ea02421ebd06d87c5f64..HEAD -- apps/
```

Non-test production files changed: **exactly four**.

| File | Change | Kind |
| --- | --- | --- |
| `apps/mobile/src/app/(tabs)/index.tsx` | Home workout-progress numeral gets `themeColor="stageInk"` | route screen (presentation) |
| `apps/mobile/src/app/progress-detail.tsx` | `cardHeader` gains `flexWrap: 'wrap'` and a `testID` | route screen (presentation) |
| `apps/mobile/src/components/game-ui/session-header.tsx` | the instrument strip is split into a wrapping INFO zone plus a pinned trailing zone so the pause control cannot change edge | **shared gameplay presentation — RENDERED** |
| `apps/mobile/src/components/ui/button.tsx` | `Button` gains `hitSlop={EDGE_HIT_SLOP}` (4 dp) | **shared gameplay presentation — INPUT ONLY** |

Everything else in that range is test-only:
`home-workout-start.test.tsx`, `progress-detail.test.tsx`,
`flexibility-task-switch/__tests__/screen.test.tsx` (a stale HUD expectation
corrected from fractional `Score 148.8` to rounded `Score 149` — **display
assertion only, scoring unchanged**), `session-header.layout.test.tsx`,
`button-edge-tap.test.tsx`, `game-host.test.tsx`, and one visual-baselines
snapshot.

> **The previous version of this file said the closure had zero files.** That
> was wrong: it predated the 076-f defect repairs and it omitted
> `apps/mobile/src/components/ui` from the surface entirely, so it could not
> have seen `button.tsx` even after it changed. The generator's surface now
> includes that directory, and the script's own exit code at the pre-fix tree was
> already `1`.

## Rendering-dependency closure: **CHANGED**

The spec names the dependency closure that invalidates a frame: *board, game
host, shared gameplay presentation, theme tokens, game rendering, game
navigation, native configuration, common runtime behaviour*. Measured directly:

```
git diff --name-only 4a6fc53..HEAD -- \
  apps/mobile/src/games \
  apps/mobile/src/components/game-host \
  apps/mobile/src/components/game-ui \
  apps/mobile/src/components/ui \
  apps/mobile/src/theme \
  apps/mobile/src/sdk \
  apps/mobile/src/routing \
  apps/mobile/src/registry \
  apps/mobile/src/content \
  apps/mobile/src/hooks \
  apps/mobile/src/constants \
  apps/mobile/android \
  apps/mobile/ios
```

Result: **two files**, both shared gameplay presentation, with the measured
effect of each recorded by `build-provenance.mjs`:

| File | Effect | Consequence for a frame that renders it |
| --- | --- | --- |
| `session-header.tsx` | **render** | the still no longer depicts the surface: `SOURCE_NOT_EQUIVALENT`, `recaptureRequired: true` |
| `button.tsx` | **input** | the still still depicts the surface, but every interaction claim drawn from it (tap registration, target size, control reachability) is invalidated |

The generator reports this on every run
(`dependency-surface changes since 4a6fc53: 2`) and **exits non-zero**. It cannot
report equivalence while the surface is dirty, and an unmeasured change fails
closed over *every* historical row rather than assuming pixel-neutrality.

`apps/mobile/src/app/_layout.tsx` and the tab layout are also unchanged — game
navigation did not move.

## Classification of the game frames

**No retained game frame is source-equivalent any more.** The session-header
repair changed the rendered output of every game session screen, and game
screens are exactly what those frames depict. All 194 retained game frames are
therefore classified **`SOURCE_NOT_EQUIVALENT`**:

- they are **not** captures from the terminal APK `e243341f…`;
- their rendering dependency **did** change since capture, so they are not valid
  source-equivalent comparison evidence either;
- they must be recaptured on the terminal APK before any of them is used again,
  or the corresponding row stays `NOT VALIDATED`.

The 22 closure frames additionally keep their real per-file binding to
`b2913bca…` (source `4a6fc53…`). The other 172 keep their honest label of
mixed-build capture with no per-file APK binding.

## Classification of the route frames

The 90 route pairs and 2 Results-scroll pairs remain
**`SOURCE_EQUIVALENT_HISTORICAL`**, and that is a measured result, not an
omission:

- `SessionHeader` renders only through `GameHost`
  (`grep -rn SessionHeader apps/mobile/src` → only
  `components/game-host/game-host.tsx` renders it). **No route surface renders
  it.**
- The only shared-primitive change that reaches route screens is
  `button.tsx`'s hit-slop, which does not alter rendered output.
- The two route screens that were themselves edited (`index.tsx`,
  `progress-detail.tsx`) were edited **before** the route matrix was captured at
  `c324960`, so the matrix already depicts them.

What *does* change is their **artifact binding**: they are bound to
`de6c5fcd…`, which is **not** the terminal APK `e243341f…`. Every route row
therefore records `currentApplicability: false` — a faithful picture of a
surface that is not a terminal-APK capture.

## Frames that require recapture

| Surface | Frames superseded | Why | Status |
| --- | --- | --- | --- |
| every game session screen (194 retained frames) | the whole historical game set | `session-header.tsx` layout changed | **recapture required** — the current-device rows are that recapture |
| `/` (Home) | any frame captured before `eff5de0` | stage-card numeral ink | already recaptured on `de6c5fcd…` |
| `/progress-detail` | any frame captured before `c324960` | badge row wraps at 2× text | already recaptured on `de6c5fcd…` |
| route frames other than those two | none | no rendered route dependency changed | preserved (task 5.1) |

Older route families — `after-captures-matrix-00024954/` (APK `00024954…`) and
`after-board-stills-c3b3e4d9/` (APK `c3b3e4d9…`) — were already labelled
historical and are not final-build acceptance.

## Route impact note required by task 5.1

The 4 dp hit slop on `Button` does **not** invalidate pixel stills or
already-measured 48 dp bounds: it widens the touch target, it does not move or
repaint anything. The session-header layout change does not reach any route
surface. No preserved route surface renders `SessionHeader`, so **no route
combination requires recapture** and the reviewed 90/90 matrix and two
Results-scroll pairs stand for the artifact that produced them.

The route rows' `interactionClosureChanged: true` records the other half of that
truth: tap-registration and target-size claims taken from `de6c5fcd…` route
frames were not re-measured on `e243341f…`, and section 5 of the prompt measures
them there.

## The boundary of this claim

This record supports source equivalence **only until the next production
edit**. Any permitted defect fix under section 4 of the change restarts the
comparison for the dependency closure that fix touches, and the affected
surfaces must be recertified. It is a hypothesis that is measured and filed —
not an assumption, and not release acceptance by itself.

An equally important non-claim: source equivalence is *why* repeating the
reviewed 90-route matrix would be redundant work. It is **not** a reason to
treat old frames as terminal-APK captures. Those are two different statements
and the previous campaign lost the thread exactly there.
