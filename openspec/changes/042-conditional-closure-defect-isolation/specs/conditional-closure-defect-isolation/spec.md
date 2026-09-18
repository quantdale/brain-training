# Conditional closure and defect isolation

## ADDED Requirements

### Requirement: Reproduced runtime defects are isolated before certification

The campaign MUST record a reproducible pre-repair signal, a bounded root-cause
classification, the smallest justified repair, and post-repair alternate-order
runtime evidence before issuing a technical closure label.

#### Scenario: SQLite runtime teardown is observed

- **WHEN** an Android runtime reload can leave a native database handle unusable
- **THEN** the app MUST isolate operation ordering and connection lifetime
  without changing persistent schema or session semantics, and the failure MUST
  be rechecked after cold launch, transition, and relaunch paths.

### Requirement: Representative results must prove retention separately from mechanics

The campaign MUST distinguish real mechanic interaction, deterministic QA
completion, result rendering, and persisted result/reward state.

#### Scenario: A representative game reaches a result

- **WHEN** the result route is completed by a normal or explicitly labeled QA
  path
- **THEN** the evidence MUST include the result surface and a direct
  persistence/duplicate-write check, without calling QA completion mechanic
  proof.

### Requirement: Technical accessibility evidence must preserve boundaries

The campaign MUST audit the installed release artifact at the required route,
theme, viewport, and text-scale states and MUST mark human, iOS, physical,
store, system-sheet, and unavailable external checks as NOT VALIDATED or
external.

#### Scenario: Large text changes the initial viewport

- **WHEN** a primary action is demonstrated as partially clipped
- **THEN** the campaign MUST repair the smallest local layout seam and verify
  the action bounds and automated accessibility result at the affected scale.
