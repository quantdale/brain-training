# Reproduced runtime defects — 076-f

**Change:** `076-f-final-product-certification`
**Task:** 4.1 — repair only reproduced defects, with before-evidence, minimal
fix, regression guard, focused validation, rebuild and re-verification, and
updated provenance. **Record no production edit if none is reproduced.**

## Standing result: no production edit made

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
