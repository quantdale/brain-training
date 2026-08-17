# Math Equation Builder — Delta Spec

## ADDED Requirements

### Requirement: Solver models actual player grammar
The solvability oracle MUST model the same legal operations the UI permits for the selected difficulty: allowed operators, number-use rule, ordering/permutation rule, grouping/parentheses behavior, division constraints, and result semantics.

### Requirement: Every emitted puzzle is proven solvable
Every puzzle returned by curated-template, procedural, retry, or fallback path MUST pass the final solvability oracle under the active difficulty before it may be displayed.

#### Scenario: Easy operators
- GIVEN Easy allows only `+` and `-`
- WHEN a curated template would require multiplication or division
- THEN the template MUST be rejected for Easy or transformed into a puzzle solvable with Easy's legal operators
- AND it MUST NOT reach the player merely because number count and target range match.

### Requirement: No invalid fallback
Fallback generation MUST be subjected to the same final invariant checks. If no valid puzzle can be produced within the bounded attempt budget, the generator MUST fail explicitly rather than emit an unproven puzzle.

### Requirement: All-difficulty property sweep
Tests MUST exercise every named difficulty over a substantial deterministic seed set and verify solvability plus all parameter invariants. Testing Normal alone is insufficient.

### Requirement: Tutorial uses production grammar
The interactive tutorial demo MUST evaluate equations using rules compatible with the real game and MUST compile without type suppression shortcuts.

### Requirement: Generator version advances
Any correction that changes deterministic puzzle selection/output MUST advance Equation Builder's generator version.