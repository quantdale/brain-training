# Reproduced runtime defects — 076-f (current-device, 2026-10-10)

**Change:** `076-f-final-product-certification`
**Task:** 4.1 — repair only reproduced defects, with before-evidence, minimal
fix, regression guard, focused validation, rebuild and re-verification, and
updated provenance.

## D3 — GO response-button label is invisible in the disabled (post-trial) state

**Reproduced on:** `attention-sustained-vigilance` (Signal Watch), current-device
row 2, on terminal APK `e243341f…`.
**Reported by:** the ARTEMIS controller's section 6, then traced to source.

### Observation (device, quoted)

> Low contrast: the "GO" response-button label renders as dark-maroon text on
> red; in the post-trial reveal state (dark-red button) the label nearly
> disappears — hardest to read exactly when the next response is required. On the
> live board (bright red button) it is legible but still weak.

### Root cause (measured from the tokens, not inferred)

`GameButton` renders the UI kit's `Button`. The GO control passes no `variant`,
so it takes the default `primary`, which resolves to the `accent` family:

| Slot | Dark-theme value |
| --- | --- |
| `accent.base` (fill) | `#FF4A57` |
| `accent.on` (label) | `#2B0508` |

Enabled contrast is **5.77:1** — passes AA. The defect is the **disabled** path.
`apps/mobile/src/components/ui/button.tsx` line 251 applies

```js
inactive: {
  opacity: 0.5,
},
```

to the **whole control** whenever `disabled || loading`. `stimulus-stage.tsx`
disables GO as soon as a trial resolves (`disabled={disabled || outcome !== null}`),
so during every post-trial reveal the entire button — fill *and* label — is
composited at 50% over the dark stage. Both ends of the pair move toward the
middle:

| | Effective colour | Relative luminance |
| --- | --- | --- |
| Fill at 50% over stage | ≈ `#85404D` | 0.0919 |
| Label at 50% over stage | ≈ `#952830` | 0.0811 |

**Contrast ratio ≈ 1.08:1.** The label is not merely weak; it is gone. This is
what the controller described as "dark-maroon text on red".

### Blast radius

This is **shared chrome**, not a Signal Watch bug. `Button` is the kit primitive
behind `GameButton`, so every game whose primary control is ever disabled —
which is every game that disables its answer control between rounds — inherits
the same collapse. Per the change spec this makes **every game screen an affected
surface**, and a fix changes the APK, so the 42 current-device rows would all
require re-verification on the rebuilt artifact.

### Status: **FILED, NOT YET REPAIRED**

Deliberately not patched at this point in the campaign, and this is a scheduling
decision rather than a judgement that the defect is minor:

1. The fix must land in `apps/mobile/src/components/ui/button.tsx`, which is
   shared by all 42 games.
2. A production edit rebuilds the terminal APK and therefore invalidates every
   current-device row captured on `e243341f…`.
3. Only 2 of 42 rows are currently captured on `e243341f…`. Repairing now would
   discard the in-flight sweep for 40 games.

**Required sequence when the repair is made:** keep before-evidence → apply the
minimal fix (reduce or remove the opacity collapse for the label slot, or hold
the label at full opacity while dimming only the fill) → add a regression guard
that fails before the fix → run focused Jest → rebuild the release APK →
re-verify all affected game surfaces → update `TERMINAL_IDENTITY.json` and the
provenance table. Task 4.1 cannot be checked until that sequence is complete.

### Secondary observation recorded, not a defect

The controller also noted the odd-tile accessibility label becomes "Item N, the
odd one out" **after** a round is revealed. The tile source is explicit that the
odd item is never disclosed while the round is live — the paused live tree shows
plain "Item 1".."Item 9" — so there is no answer leak during play.
