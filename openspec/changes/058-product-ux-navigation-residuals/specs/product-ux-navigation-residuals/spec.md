# Spec — product-ux-navigation-residuals

## ADDED Requirements

### Requirement: Canonical text links meet the touch floor by style

The Progress activity link and the empty-domain back link SHALL render at
≥44dp height via an explicit `minHeight` style with vertical centering, so
the contract holds by construction rather than by padding arithmetic.

#### Scenario: Links are full-height controls

- GIVEN the Progress Activity card and the missing-domain state
- WHEN measured
- THEN both link controls are at least 44dp tall.

### Requirement: Recovery and empty copy is never truncated

`EmptyState` messages SHALL wrap to full readable text. The recovery retry
control SHALL carry an explicit 44dp minimum plus hit slop on its plain
`Pressable` (provider-free by architectural requirement — `Tappable` is
prohibited on degraded surfaces that must render while providers have
failed).

#### Scenario: Long guidance stays visible

- GIVEN the unknown-game empty state (~100-char message)
- WHEN rendered at default, compact, and font-scale-2
- THEN the full message is visible (no ellipsis hiding guidance).

#### Scenario: Degraded retry meets the floor without providers

- GIVEN the storage/bootstrap recovery screen
- WHEN measured
- THEN the retry control is at least 44dp tall with additional hit slop,
  built from plain RN primitives only.

### Requirement: App-route backs resolve with an empty stack

Every app-route back control SHALL go back when the navigation stack allows
it, and SHALL replace to a per-route fallback otherwise: `/progress` for
the four Progress surfaces (both progress-game instances), `/` for
Results, `/games` for Game Detail (whose local duplicate back control is
replaced by the shared primitive).

#### Scenario: Cold deep link never strands

- GIVEN a cold start directly on `/results?id=X` (empty stack)
- WHEN the back control is pressed
- THEN the app replaces to `/` instead of no-op.

#### Scenario: Normal flows unchanged

- GIVEN a non-empty stack
- WHEN any migrated back control is pressed
- THEN it goes back exactly as before.

### Requirement: Game tiles carry a touch floor by construction

Attention-visual-search tiles SHALL declare the same `MinTouchTarget`
minimum dimensions as memory-grid-recall cells, guarding narrower devices
and future grid growth without changing current geometry.

#### Scenario: Tile floor exists

- GIVEN the AVS tile styles
- WHEN inspected
- THEN `minHeight` and `minWidth` equal `MinTouchTarget`.

## MODIFIED Requirements

None. All changes are additive floors, wrapping, and fallback wiring.

## REMOVED Requirements

None.
