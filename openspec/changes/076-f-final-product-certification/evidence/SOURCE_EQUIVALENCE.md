# Source-equivalence record — 076-f terminal certification

**Change:** `076-f-final-product-certification`
**Task:** 1.3 — record the source-equivalence diff from `4a6fc53` to the current
application source, classify unchanged game frames, and list only the frames
that require recapture.

## The measurement

```
git diff --name-only 4a6fc5349c334b4324e4ea02421ebd06d87c5f64..HEAD -- apps/
```

Non-test production files changed: **exactly two**.

| File | Change | Kind |
| --- | --- | --- |
| `apps/mobile/src/app/(tabs)/index.tsx` | Home workout-progress numeral gets `themeColor="stageInk"` (it sat unreadable as near-black paper ink on the charcoal stage card) | presentation |
| `apps/mobile/src/app/progress-detail.tsx` | `cardHeader` gains `flexWrap: 'wrap'` and a `testID` (at 2× text the tracked heading plus count badge overflowed and clipped its label) | presentation |

Everything else in that range is test-only:

| File | Change |
| --- | --- |
| `apps/mobile/src/app/__tests__/home-workout-start.test.tsx` | guard for the numeral ink |
| `apps/mobile/src/app/__tests__/progress-detail.test.tsx` | guard for the badge reflow |
| `apps/mobile/src/games/flexibility-task-switch/__tests__/screen.test.tsx` | stale HUD expectation corrected from fractional `Score 148.8` to rounded `Score 149` — **display assertion only, scoring unchanged** |

No other application source, build input, lockfile, workflow, or script changed
in that range.

## Rendering-dependency closure: unchanged

The spec names the dependency closure that invalidates a frame: *board, game
host, shared gameplay presentation, theme tokens, game rendering, game
navigation, native configuration, common runtime behaviour*. Measured directly:

```
git diff --name-only 4a6fc53..HEAD -- \
  apps/mobile/src/games \
  apps/mobile/src/components/game-host \
  apps/mobile/src/components/game-ui \
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

Result: **zero files** (excluding test-only edits, which do not render).

The same is recomputed on every run of
`scripts/certification/build-provenance.mjs`, which reports
`dependency-surface changes since 4a6fc53: 0` and fails loudly if that ever
stops being true, so this claim cannot rot.

`apps/mobile/src/app/_layout.tsx` and the tab layout are also unchanged — game
navigation did not move.

## Classification of the unchanged game frames

All 194 retained game frames are classified **`SOURCE_EQUIVALENT_HISTORICAL`**.

That means, precisely and no more:

- their rendering-dependency closure is unchanged since capture, so they remain
  valid *comparison* evidence for what those states look like;
- **they are not captures from the terminal APK** `de6c5fcd…`, and no record,
  table, report, or parent checkbox may describe them as such;
- they **do not** replace the required current-device acceptance check. The
  current-device rows under [`current-device/`](current-device/) are that check
  and are recorded separately.

The 22 closure frames additionally keep their real per-file binding to
`b2913bca…` (source `4a6fc53…`). The other 172 keep their honest label of
mixed-build capture with no per-file APK binding.

## Frames that require recapture

Only frames whose *own* rendering dependency changed require recapture. Since
the game dependency closure is unchanged, **no game frame requires recapture**.

The only surfaces that changed are the two route screens that were themselves
edited:

| Surface | Frames superseded | Why | Status |
| --- | --- | --- | --- |
| `/` (Home) | any frame of Home captured before `eff5de0` | stage-card numeral ink changed | **already recaptured** in `final-matrix-de6c5fcd` at `de6c5fcd…` |
| `/progress-detail` | any frame of Progress-detail captured before `c324960` | badge row now wraps at 2× text | **already recaptured** in `final-matrix-de6c5fcd` at `de6c5fcd…` |

Both replacements are `CURRENT_APK` rows in the provenance table. The older
route families that predate the terminal build —
`after-captures-matrix-00024954/` (APK `00024954…`) and
`after-board-stills-c3b3e4d9/` (APK `c3b3e4d9…`) — are already labelled
historical in the parent evidence README and are not final-build acceptance.

So the complete list of frames requiring recapture is: **the Home and
Progress-detail route frames from pre-fix builds — both already recaptured on
the terminal APK. Nothing else.**

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
