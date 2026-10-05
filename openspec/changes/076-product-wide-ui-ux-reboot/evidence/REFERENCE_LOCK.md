# Change 076 — Reference Lock (task 2.5)

**Selected foundation:** **Training Studio** — Peloton-informed immersive
discipline, adapted (not cloned): charcoal stage, white reading type, ONE red
primary action, instrument-like metrics, mechanic-first play stages.
**Scorecard:** `proto-scorecard.md` (B 8.63 > A 8.45 > C 7.63; no blocking
defects). **Permitted borrowings:** (1) A's genuine board-still game-identity
tiles; (2) C's numbered markers + hairline fact rows for secondary reports.
This lock is the binding visual contract for waves 3–5; deviations require an
orchestrator decision recorded in the change evidence.

## 1. Product-owned color (semantic roles, exact values)

Light scheme:

| Role | Value | Notes |
| --- | --- | --- |
| `canvas` | `#F7F6F3` | studio paper; page background |
| `stage` | `#1F2124` | immersive play/result stage panel |
| `stageInk` | `#FFFFFF` | type on stage |
| `ink` | `#17181A` | primary reading text on canvas |
| `soft` | `#ECEAE5` | metric tiles, quiet fills |
| `line` | `#D8D5CE` | hairline borders on canvas |
| `action` (CTA red) | `#D6293A` | THE single primary action fill; white ink |
| `actionInk` | `#FFFFFF` | |
| `success` | `#157A46` | text/icon on `successSoft #DFF2E7` |
| `error` | `#A32014` | text/icon on `errorSoft #F9E2DE` |
| `muted` | `#6E6E68` | secondary labels (≥4.5:1 on canvas) |

Dark scheme:

| Role | Value |
| --- | --- |
| `canvas` | `#101114` |
| `stage` | `#1B1D21` |
| `stageInk` | `#FFFFFF` |
| `ink` | `#F2F2F0` |
| `soft` | `#26282C` |
| `line` | `#34363B` |
| `action` | `#FF4A57` (ink `#2B0508`) |
| `success` | `#4CC98A` (soft `#12301F`) |
| `error` | `#FF7B67` (soft `#3A1410`) |
| `muted` | `#9A9A94` |

Role discipline (non-negotiable):

- **Red is the primary action ONLY.** Error states use `error` text/icon on
  `errorSoft` — never a red fill carrying text. Engagement tones (XP, coins,
  streak) keep distinct product-owned hues from the existing semantic families
  and never reuse `action`.
- Success/error are ALWAYS carried by text + icon/shape in addition to color.
- The existing domain identity colors (constitution §8 browse categories)
  remain for domain tags; they never become action fills.

## 2. Typography

- Single family (the product's current sans). Weights: 800 for headers/CTA,
  600–700 for emphasis, 400 for body.
- Scale (dp, light/dark identical): display numeral 54–62 (result/score);
  h1 28–30; stage title 22–24; body 14.5/21; kicker 11.5 uppercase +1.8
  tracking; metric label 10.5 uppercase +1 tracking; metric value 18.
- Uppercase + tracking is reserved for kickers/metric labels/CTA — never for
  long body copy.

## 3. Spacing, shape, elevation

- Page padding 18dp; section gap 14dp; card padding 14–18dp; intra-card gap
  8–10dp.
- Radius: 12dp standard (stage cards 16dp); NO pill radii outside chips;
  no shadows except one soft elevation on the stage card (dark scheme: border
  `line` instead of shadow).
- Boards sit INSIDE the stage panel with ≥14dp inset; chrome never overlays
  the board's interactive area.

## 4. Board media (borrowed detail #1)

- Game identity tiles (Home/Games/Detail/collection) carry a **genuine board
  still**: a flat, code-native crop of the actual game's board language
  (deterministic per game), 12dp radius, ink-on-stage or ink-on-soft — never
  stock photography, never decorative abstractions, never emoji.
- Result screens reuse the played game's still inside the stage panel above
  the score numeral (continuity of artifact).

## 5. Action hierarchy

1. ONE red filled action per viewport ("Start session" / "Check" / "Next
   board" / "Finish workout"), 48dp+ tall, full-width or ≥60% width.
2. Secondary: bordered neutral action (`line` border, canvas fill, ink text).
3. Tertiary/quiet: text link, underlined, `muted`→`ink` on press; never used
   for a primary next step (borrowed-detail discipline: C's quiet actions are
   rejected for primary flows).
- Destructive actions keep the existing two-step typed-confirmation pattern.

## 6. Motion & feedback

- React Native `Animated` via the shared `usePressFeedback` hook (existing
  convention): press scale 0.97–0.98, 120ms; stage card entrance ≤250ms fade+
  8dp rise; NO continuous/ambient animation on play stages.
- Feedback states: success = `successSoft` band, ✓ icon + text; error =
  `errorSoft` band, ✕ icon + text + explicit retry action. Both announce via
  the existing live-region seam. Reduced-motion suppresses entrances (existing
  `use-reduced-motion`).
- Timers render as instrument text (tabular figures) in the stage header.

## 7. Light/dark rules

- Dark is designed, not inverted: `stage` stays one step above `canvas`;
  borders replace shadows; the CTA red brightens (`#FF4A57`) with dark ink;
  board tiles on stage use `rgba(255,255,255,0.08)` idle fills with white lit
  state (verified in captures).
- Both schemes keep ≥4.5:1 body contrast and ≥3:1 large-text contrast
  (verified by the wave-3 contrast audit against these exact values).

## 8. Secondary reports (borrowed detail #2)

- Progress/Results secondary information uses numbered markers (`01`, `02`…)
  and hairline fact rows (label uppercase tracked / value medium) — quiet,
  credible, never competing with the focal metric.

## 9. Prototype disposal (task 2.5)

- Candidates live in `src/prototypes/*` behind `app/prototype.tsx`, which
  renders a dev-only notice unless `isDevBuild()` — they cannot appear in
  release. Disposal decision: **dev-gate (retained)** for wave-3 comparisons;
  removal re-evaluated at the 14.x convergence.
- The wave-2 captures (66 images) are the visual provenance of this lock:
  `proto-captures/` (hashed).
