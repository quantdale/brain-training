# Reproduced runtime defects — 076-f

**Change:** `076-f-final-product-certification`
**Task:** 4.1 — repair only reproduced defects, with before-evidence, minimal
fix, regression guard, focused validation, rebuild and re-verification, and
updated provenance. **Record no production edit if none is reproduced.**

## Production edits made — two reproduced defects (2026-10-09)

The owner authorized repairing the two defects the controller reproduced on
device. Both are in **shared chrome**, not in a single game.

| # | Defect | Root cause | Fix | Guard |
| --- | --- | --- | --- | --- |
| 1 | Pause control drifts between top-left and top-right across trials of the same game | `SessionHeader` was one `flexWrap: 'wrap'` row with the pause control as its last child, so HUD overflow wrapped the control to the **start** of the next instrument line. The wrap is load-bearing (Campaign 055P: without it the control is clipped off-screen at 2x text), so it could not simply be removed. | Split into a wrapping **info** zone (round/progress/score) and a **pinned trailing** zone (`flexShrink: 0`, `flexGrow: 0`). Overflow still wraps away; the control cannot change edge. | `session-header.layout.test.tsx` asserts **both** halves — info zone wraps AND pause is outside every wrapping zone |
| 2 | Taps on a button's outer bound edge do not register | `hitSlopToTouchTarget()` returns `null` once a control meets the 48dp floor, so `Tappable` applied **no** expansion; and RN's hit test is boundary-exclusive, leaving the outermost pixel row/column dead | `Button` applies `EDGE_HIT_SLOP = 4`dp. The value is not arbitrary: kit siblings sit `Spacing.two` (8dp) apart, so 4dp/side makes neighbours' hit areas **meet** at the gap midpoint and never overlap | `button-edge-tap.test.tsx` asserts a non-empty allowance **and** that it is <=4dp/side so it cannot steal a neighbour tap |

### Guards verified to fail before and pass after

The source was stashed and the guards re-run: **4 of 5 tests went red** without
the fixes, and all 5 pass with them. A guard that cannot fail is not a guard.

One pre-existing test changed contract deliberately:
`game-host.test.tsx` asserted the pause control *was* inside a wrapping
container — which is precisely the bug. It now asserts the pause control is
**outside** every wrapping zone while the anti-clipping wrap survives on the
info zone.

### Validation

- Full Jest: **622 suites / 7,241 tests / 5 snapshots** — green.
  The baseline moved from 621 / 7,237 because these guards are **additive**
  (+1 suite, +4 tests). Nothing was removed, skipped, retried or disabled.
- `tsc --noEmit` exit 0. `expo lint` clean.
- 3 visual-baseline snapshots updated; the diff is **exactly** four added
  `hitSlop={4}` lines and nothing else, so the update is explained rather than
  blind.

## Artifact identity after the fix

A production edit changes the APK, so per the change spec the affected runtime
surfaces require recertification and the artifact identity is recorded here:

| Role | Commit | APK SHA-256 | Size |
| --- | --- | --- | --- |
| Prior evidence (routes + 6 accepted game rows) | `c324960…` | `de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d` | 48,888,204 |
| **Current candidate (after the two fixes)** | `b293a02…` | **`e243341fd4f9641810038a2695540fdd0b9b29634ebb91b48afbbde591b7635f`** | 48,888,452 |

Built with the canonical x86_64 release command, installed on `emulator-5554`,
and independently device-hashed (pulled `base.apk` → `e243341f…`, exact match).
Delta is +248 bytes.

**Consequence for evidence:** the six accepted game rows were captured on
`de6c5fcd…`. The fix touches the shared pause control and every `Button`, so
game screens are **affected surfaces** and those rows require re-verification on
`e243341f…`. Unaffected evidence (the route matrix, whose surfaces were captured
on `de6c5fcd…` and whose rendering dependency is unchanged by a chrome hit-target
and layout fix) retains its original artifact identity per the spec's
"unaffected evidence retains its original artifact identity" rule.

## Standing result before 2026-10-09: no production edit made

As of this record, **no runtime defect has been reproduced** by the current-device
acceptance checks, so **no production code has been edited** by this change.

This is the branch the change spec describes:

> **Scenario: No defect is reproduced** — WHEN a reviewer wants a different
> visual treatment but no runtime defect is reproduced, THEN production
> presentation, mechanics, and persistence remain unchanged.

Nothing was "improved" because someone preferred a different look. The locked
Training Studio direction, game mechanics, scoring, persistence, economy,
workout ownership, offline behaviour and registry semantics are untouched. No
successor redesign and no Change 077 was started.

## Evidence that the tree really is untouched

The only non-test production files that differ from the game-capture source
`4a6fc53` are the two presentation fixes the *previous* campaign already made
and filed (Home stage numeral ink at `eff5de0`, Progress-detail 2× badge wrap at
`c324960`):

```
git diff --name-only 4a6fc53..HEAD -- apps/ | grep -v __tests__
apps/mobile/src/app/(tabs)/index.tsx
apps/mobile/src/app/progress-detail.tsx
```

Both predate this change and both carry their own regression guards (the guard
for the badge reflow was verified to fail before the fix and pass after). This
change added no third edit.

## What would happen if a defect were reproduced

The procedure is fixed in advance so it cannot be improvised under pressure:

1. Keep the **before** evidence (device frame + hierarchy) in the game's
   `current-device/<game>/` row.
2. Apply the **minimal** correction to that defect only — no opportunistic
   refactors, no visual redesign.
3. Add a **regression guard** that fails before the fix and passes after.
4. Run focused validation (the affected Jest suites, `tsc --noEmit`, lint).
5. **Rebuild** the release APK and **re-verify** the affected states on device,
   because a new APK identity invalidates the affected runtime surfaces.
6. Update [`provenance-table.md`](provenance-table.md) via
   `node scripts/certification/build-provenance.mjs` so the affected frames
   carry their new artifact identity and unaffected evidence keeps its original
   one.

Step 5 is not optional: the spec is explicit that "a frame SHALL NOT be labeled
as a capture from an APK that did not produce it", and a fix that changes the
APK changes which frames are current.

## Rollback policy

A bad fix is rolled back by `git revert` or a corrective commit. `main` is
never force-pushed, and historical evidence is never deleted.

## Historical note — defects found and fixed in the *previous* campaign

For completeness, since they are sometimes mistaken for open work: the earlier
certification pass reproduced and repaired three device-captured defects, all
already fixed and re-verified before this change began — the Task Switch HUD
float-score leak, the number-line feedback collapse, and the Tap Rush hit-test
miss. Those are closed and are not re-opened here.
