# Task 2.4 — Prototype scorecard, on-device inspection, and selection

**Date:** 2026-10-05 · **Device:** `braintraining-ui35` / `emulator-5554` (1080×2400 @ 420dpi)
**Method:** three genuinely different dev-only prototypes (`src/prototypes/*`, route
`app/prototype.tsx`, dev-gated), driven on device through the same seeded journey
(home → games → detail/instruction → memory board → equation board → result →
progress) with real interaction (watch-then-tap recall; token assembly + check;
deliberate wrong answers for the incorrect states). 66 captures: 7 stages ×
light/dark × 3 systems + correct/incorrect feedback overlays per board per system
+ 2× font-scale spot checks (home/memory/equation × 3 systems). Curated copies in
`proto-captures/` (hashed in `proto-captures/index.json`).

## Weighted scorecard (design.md: 30% playability, 25% accessibility, 20% first-viewport action clarity, 15% distinctiveness, 10% feasibility)

| Criterion (weight) | A — Pocket Console | B — Training Studio | C — Puzzle Index |
| --- | --- | --- | --- |
| Playability (30%) — boards read as playable, feedback unmistakable, mechanics louder than chrome | 8 — chunky ink-bordered tiles read well; yellow lit-tiles clear; stamp chips add energy but risk crowding dense boards; equation tokens clear | 9 — charcoal stage isolates the board; lit white tile vs dim grid reads instantly; feedback bands text+icon (✓/✕) with no red-fill ambiguity; tokens clear | 7 — hairline squares are elegant but quiet; the lit fill (ink) reads; wrong/right overlays are typographic and slower to parse mid-play; ghost affordances slow repeated play |
| Accessibility (25%) — contrast beyond color, reachability, semantics | 8 — ink-on-paper and ink-on-yellow ≥4.5:1; violet CTA/white ≈5:1; success/error always text+fill; at 2× the home CTA falls below the fold (harness chrome aside) | 8.5 — white on #1F2124 ≈15:1; red CTA/white ≈5:1; error uses icon+text on soft ground (never red-fill text); compact hierarchy holds the CTA higher at 2× | 7.5 — maximal ink/white contrast; muted labels ≈5.3:1; but quiet underline actions and thin 1.5dp borders are small targets/low affordance; 2× behaviour untested for wrap breaks |
| First-viewport action clarity (20%) | 9 — "Play today's set" fully visible in the default viewport; the console band is decorative but compact | 8.5 — "Start session" visible; kicker/title compact; the stage card slightly delays the CTA vs A | 6.5 — "Begin →" visible but the huge editorial headline + art square push it to ~60% height; quiet affordances rely on reading |
| Distinctiveness (15%) | 9 — playful collectible console identity; nothing generic about it | 8 — disciplined studio/instrument identity, clearly not a dashboard | 10 — stark editorial index; maximal differentiation |
| Feasibility (10%) — pure RN styles, no new deps, maps onto product seams | 9 | 9 | 8.5 |
| **Weighted total** | **8.45** | **8.63** | **7.63** |

No candidate triggered a blocking disqualification (no accessibility-blocking
defect and no loss-of-progress defect was observed during real play; formal
contrast/a11y audits run in wave 3 against the implemented system).

## On-device inspection findings (what the captures actually show)

- **A** home/games/result read as a desirable "console"; the 2× home capture
  shows the primary action pushed low once the console band + stamp chips scale.
  The memory board needed a real layout repair during review (aspectRatio cells
  collapsed inside wrap containers; grids are now row-based) — itself evidence
  that board-first QA catches what static screens hide.
- **B** the charcoal stage keeps the puzzle dominant; correct/incorrect states
  are unmistakable (icon + text on soft ground); the red CTA never carries
  error text, so red≠error confusion did not materialize; 2× hierarchy holds.
- **C** beautiful index; the two design-flagged risks are CONFIRMED by the
  captures: quiet typographic actions are low-affordance under time pressure
  ("Skip to result (demo)" reads as body copy), and the near-empty board still
  is too quiet to sell a game at browse speed.

## Decision

**Selected foundation: B — Training Studio**, with exactly two permitted
borrowed details (see `REFERENCE_LOCK.md`):

1. **From A:** the flat, genuine board-still treatment for library/detail game
   identity tiles (authentic cropped board art, never stock/decorative).
2. **From C:** numbered route/round markers + hairline fact-row tables for
   Progress/Results secondary information (quiet reports), never for primary
   actions.

**Rejected traits (recorded, not blended):** A's yellow brand fields (collide
with warning semantics; crowd puzzle frames at 2×) and offset-shadow key
chrome; C's monochrome-only state feedback (insufficient for fast
correct/incorrect parsing), ghost typographic actions, and square hairline
board language (too quiet for timed play).

The prototypes remain in-tree behind the dev gate (`app/prototype.tsx` refuses
non-dev builds), satisfying task 2.5's "remove or dev-gate" requirement; they
stay available for wave-3 comparisons and are excluded from production bundles
by the gate. The unused-candidate cleanup option was chosen as dev-gating, to
be revisited at the 14.x convergence if the lock makes them redundant.
