# Campaign 055 — Visual Critique (three mandatory passes)

Basis: fresh release-artifact pixels (`D:\Temp\campaign055\after-light`,
`after-dark`, plus Campaign 052 baseline pixels), the refinement lock, and the
Campaign 052 criticisms. Passes were run in order; every fix they produced is
listed under the pass that found it and is present in the final artifact.

## Pass A — "Would I browse this?"

Surfaces: Home, Games, Game Detail, Profile, Rewards.

| Question | Verdict | Evidence |
| --- | --- | --- |
| Do I want to touch something? | Yes | Home leads with one coral `Start workout` key on a world stage; Games leads with a featured stage whose key is `Open game details`; Game Detail's `Play {name}` is the largest control on the screen. |
| Is game identity visible before metadata? | Yes | Games tiles carry the code-native world art first and only then a one-line kicker + name; the featured stage renders the world before the reason line. |
| Is there one focal point? | Yes, per screen | Home: workout artifact. Games: featured stage (grid is deliberately subordinate). Detail: stage + Play. Profile: player identity panel. Rewards: claim band (else collection header). |
| Is repetition still obvious? | No | The repeated frame is now a *slot* (art + plinth) whose content differs by game; records/settings use hairline Reports instead of a second card grammar. |
| Could this belong to any generic learning/habit app? | Much less | Eight-domain world stages, console keys, domain-coded poster grid make the identity game-first; Progress/Profile no longer mirror fitness-dashboard grammar. |

Fixes produced by pass A:

- The featured reason line still exposed the internal rating
  (`weak Language domain (rating 986)`). Added the shared `playerFacingReason`
  display helper and used it on the Games featured reason (tested in
  `components/shell/__tests__/format.test.ts`).
- The filter chip cloud pushed the grid down. Converted to one horizontal
  scrollable rail (same chips, same testIDs).
- The collection grid stretched the last (4th) accent across the full width.
  Fixed the cell basis to a fixed width so short rows stay cell-sized.

## Pass B — "Does play feel better than admin?"

Surfaces: tutorial, gameplay, Results, Progress.

| Question | Verdict | Evidence |
| --- | --- | --- |
| Is the mechanic visually stronger than the surrounding dashboard? | Yes | The game board owns the session viewport; the header is a compact instrument strip (round rail + score + pause); no bottom navigation. |
| Does Results feel like an event? | Yes | One artifact (world + band headline + ring), then evidence, then reward, then one primary action. Weak outcomes read honestly: `Keep training` on a 9% session, neutral reward row, no confetti. |
| Does Progress remain credible without feeling bureaucratic? | Yes | Consistency rail and the overall-rating ring lead; the definition sentence was shortened; the window-average line now says "Matching your lifetime average". Every number is unchanged. |
| Is the next action emotionally obvious? | Yes | `Play again` is the only filled key in standalone Results; workout Results keep exactly one primary (`Next game` or `Finish workout`) with `Play again`/`Done` quiet. |

Fixes produced by pass B:

- A first-ever session showed "New personal best" plus success feedback on a
  9% result. Gated the badge/celebration/feedback to a mid-band-or-better
  personal best.
- The canary game's results repeated the score ("Final score 320" and
  "Score 320"). Removed the redundant row on the canary; other games still
  repeat the pattern (recorded as remaining debt below).
- Raw floating-point response times (`2948.3300000000745 ms`) were rounded at
  the display seam in the two games that printed them unrounded.

## Pass C — "Did we over-style it?"

Checks: saturation, clutter, animation, readability, screen-reader semantics,
performance, density, dark-mode contrast, adult credibility.

| Check | Result |
| --- | --- |
| Saturation | Domain hue stays on art fields and small kickers; actions use coral only; reports are ink on paper. No new gradients or glow. |
| Clutter | Fewer containers per screen than the baseline (artifact + reports); the Games filter cloud collapsed to one rail. |
| Animation | Only existing bounded motion (Entrance, press scale, confetti on strong results/PB). No looping decoration. |
| Readability | `bodyRead` (16/26 400) owns long copy; 900 weight is restricted to page/game/result headings and stat numerals. |
| Screen-reader semantics | New roles use Tappable/Button (roles + labels); decorative art stays hidden; the Games poster tiles keep the exact previous accessible names and hints. |
| Performance | No new images, no new list nesting; catalog remains a single windowed scroll of plain views; see `PERFORMANCE_SANITY.md`. |
| Density | 2-up poster grid on phones, 3-up collectibles; both denser than baseline. |
| Dark-mode contrast | Authored dark palette preserved; flat reports on the ink canvas remove the low-separation stacked panels; dark Results no longer has dead space. |
| Adult credibility | Robotic copy and placeholder labels removed (see `COPY_AND_LABEL_AUDIT.md`); no fake social proof, no claims. |

Fixes produced by pass C:

- Removed the duplicated composite-rating definition sentence on Progress and
  reworded the trend line ("Even with lifetime" → "Matching your lifetime
  average").

## Remaining visual debt (honest, non-blocking)

1. Most of the other 41 games still include a `Final score` block plus a
   `Score` row in their own results children; the shared chrome cannot remove
   a per-game duplicate without touching game modules.
2. In-game Results show the game's own `title` (usually "Session complete")
   rather than a performance band, because games do not pass
   `normalizedResult` to the shared chrome; the route Results and any game that
   adopts the prop do show the band.
3. Gameplay dead space below short boards is game-owned (board size/tuning);
   the shared chrome no longer adds to it but does not resize boards.
4. The Progress drill-down screens (domain/game/activity/detail) keep several
   `explainMetric` captions; the main Progress surface was the campaign scope.

---

# Resumption addendum (2026-09-20) — gameplay dead-space investigation

Debt item 3 above ("Gameplay dead space below short boards is game-owned") was
re-investigated against the shared container source rather than assumed.

## Evidence

- `components/game-host/game-host.tsx` session view is
  `screen (flex:1)` → `content (flex:1, gap)` → `section (gap, no flex)` →
  `mechanicStage` (`padding: Spacing.twoHalf`, hairline border, radius; **no
  `flex`, no fixed height, no `justifyContent`**). The stage is content-sized:
  the shared chrome adds no height and stretches nothing.
- The remaining canvas below a short board is therefore the screen background,
  not a container defect. Boards are game-owned geometry: e.g.
  `attention-target-count` renders a 4-row symbol grid plus a 5-key answer row
  (`screens/after/gameplay.jpg`), while taller boards (e.g. sequence/grid games)
  occupy more of the stage.
- A shared `flex: 1` on `mechanicStage` would not resize any board; it would
  only move the same empty space inside the hairline border and could regress
  games whose controls intentionally anchor directly below the board.

## Disposition

**Class B — legitimate game-owned board sizing / mechanic geometry.** No shared
layout change was made. No board was stretched, no target position or timing was
retuned, no mechanic was altered. Short-board dead space is recorded as
game-specific future visual debt (a per-game board-composition opportunity, not
a Campaign 055 defect). This keeps the investigation bounded and avoids a new
redesign wave.
