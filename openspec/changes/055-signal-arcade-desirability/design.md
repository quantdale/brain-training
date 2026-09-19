# Campaign 055 — Design

## Context

Campaign 052's visual debt map classifies Home/Game Detail/Tutorial/Progress/
Rewards as REFINE, Games/Results/Profile as RETHINK, active gameplay and dark
mode as KEEP, and no surface as REPLACE_DIRECTION. The independent critic
nonetheless rated active gameplay among the weakest surfaces, so this campaign
preserves the mechanic-first architecture and only refines its visual identity
where fresh native evidence supports it.

## Refinement contract

The complete role contract lives in
`docs/redesign/evidence/campaign055/REFINEMENT_LOCK.md`. Implementation must
consume it rather than re-derive visual decisions per screen.

## Shared system first

1. `theme/tokens.ts`: add typography voices (`gameTitle`, `resultHeadline`,
   `bodyRead`), document shape roles, and re-point colour slots only where the
   semantic table requires it (keeping the contrast suite green).
2. `components/ui`: add role primitives — `ArcadePanel` (focal surface),
   `Report`/`ReportRow` (borderless grouped rows), `GameStage` (code-native
   world scene), `CollectibleTile` (slot plate) — and a `flush` Card variant.
   Existing component APIs and testIDs stay intact.
3. Result primitives: a band model (personal best / strong / building) derived
   from the session's own performance, an artifact layout, and a reward chip
   row; shared by the in-session results and the route results.

## Surface order

Home (focus) → Games (storefront) → Game Detail (fantasy) → Tutorial/Gameplay
(chrome) → Results (event) → Progress (narrative) → Profile (identity) →
Rewards (collection) → copy audit. Shared changes land before surface changes;
each surface is validated with its focused tests before the next begins.

## Performance

Poster grids and stages are plain views and text on existing primitives; no new
image decoding, no new animation loops. The catalog keeps a single flattened
grid (no nested virtualized lists inside a scroll view) and remains a windowed
`SectionList`/`FlatList` if that is what it uses today.

## Risks

- The single committed snapshot (`visual-baselines.test.tsx.snap`) will change
  intentionally; it must be regenerated deliberately and reviewed.
- Test suites pin testIDs, DOM order, colours and copy; each surface change
  updates its focused tests rather than weakening assertions.
- Dark-mode token edits must keep the contrast suite and the authored look.
