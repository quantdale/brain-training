# Reproduced runtime defects — 076-f (current-device, 2026-10-10)

**Change:** `076-f-final-product-certification`
**Task:** 4.1 — repair only reproduced defects, with before-evidence, minimal
fix, regression guard, focused validation, rebuild and re-verification, and
updated provenance.

> **2026-10-13 — D3 is REPAIRED.** The single defect below (D3) was filed here as
> "FILED, NOT YET REPAIRED", then repaired on 2026-10-12/13 through the full task
> 4.1 sequence. Its status line and required sequence are superseded by *Status:
> REPAIRED* below. No other runtime defect was reproduced during the certification.

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

### Status: **REPAIRED (2026-10-12/13) — task 4.1 closed**

The required sequence was completed end to end:

1. **Before-evidence kept** — this file's observation above and the token-derived
   ~1.08:1 / ~1.63:1 analysis; the regression guard re-derives the collapse
   analytically.
2. **Minimal fix** — `apps/mobile/src/components/ui/button.tsx`:
   `resolveDisabled(variant, theme)` maps a disabled control to fill
   `theme.backgroundElement` (transparent for `ghost`) and label `textSecondary`,
   keeps `borderColor: theme.border`, drops the filled variant's 4dp lip, and
   separates `inactive = disabled` from `busy = loading` (a busy button keeps its
   enabled fill + spinner). The whole-control `opacity: 0.5` is gone.
3. **Regression guard that fails before the fix** —
   `apps/mobile/src/components/ui/__tests__/button-disabled-state.test.tsx`, 7
   tests. **Fail-before / pass-after verified:** 3 of the 7 fail against the
   pre-fix file at `b293a02`, all 7 pass after the fix (verified by temporarily
   restoring the `b293a02` file and re-running). Contrast is computed with an
   in-test WCAG 2.x implementation and asserted ≥ 4.5:1 in BOTH palettes; the
   enabled primary button is asserted unchanged.
4. **Focused validation** — 7/7 pass (`EXIT=0`); UI-kit focused set 13 suites /
   89 tests.
5. **Rebuild** — new terminal APK
   `c8c3d46c2dbfe51e7a5c32bd0cf13d015c7bc5c6b04836229e7b104243b504f6`
   (48,888,528 B) from source `d5787ec`, installed on `emulator-5570`, pulled
   `base.apk` hashed to the identical value.
6. **Re-verify affected surfaces** — `d3-impact.json` classifies 40 of 42 rows
   **unaffected** (the repair repaints no enabled pixel and changes no behaviour)
   and 2 **affected** (`language-word-scramble`, `logic-code-cracker`), both
   re-observed on the new APK in both themes: light `#ECEAE5 / #4A4B4E = 7.25:1`,
   dark `#17181B / #B9BABC = 9.14:1` — token-exact and above AA. Detail:
   `d3-affected-games-reobserved.json`. The 40 unaffected rows retain their
   `e243341f…` identity per the spec's *"A fix changes the APK"* scenario.
7. **Provenance updated** — `TERMINAL_IDENTITY.json` now records `d5787ec` /
   `c8c3d46c…`; `provenance-table.*` and `assessment.json` regenerated against it.

Task 4.1 is checked with this linked evidence.

### Secondary observation recorded, not a defect

The controller also noted the odd-tile accessibility label becomes "Item N, the
odd one out" **after** a round is revealed. The tile source is explicit that the
odd item is never disclosed while the round is live — the paused live tree shows
plain "Item 1".."Item 9" — so there is no answer leak during play.
