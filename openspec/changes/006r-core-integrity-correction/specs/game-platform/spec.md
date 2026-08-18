# Shared Game Platform — Delta Spec

## ADDED Requirements

### Requirement: Stable lazy component identity
Lazy game component wrappers MUST be created/cached outside ordinary route render so unrelated route rerenders do not create a new component type and unexpectedly remount game state.

#### Scenario: Route rerender keeps component identity
- GIVEN lazily wrapped game components cached outside route render
- WHEN an unrelated route rerenders
- THEN the game wrapper type is not recreated and game state does not unexpectedly remount.

### Requirement: Generated registry remains generated
Any generated loader/registry output MUST be produced through its generator. Agents MUST NOT hand-edit generated files as the normal implementation path.

#### Scenario: Registry produced by generator
- GIVEN a loader/registry output
- WHEN it is created
- THEN it is produced through its generator and not hand-edited as the normal path.

### Requirement: Shared generic UI primitives reduce drift
The platform MUST provide shared primitives for generic repeated game UI when behavior is intended to be identical across games, including candidates such as button, pause frame, tutorial frame, QA shell, result stat row, difficulty selector, and session header. Game-specific mechanics/reducers/generators remain module-owned.

#### Scenario: Identical UI uses shared primitive
- GIVEN two games with identical intended behavior for a generic UI element
- WHEN they render that element
- THEN they use the shared primitive rather than divergent copies, while game-specific mechanics stay module-owned.

### Requirement: Error boundary can recover safely
A game-route error boundary MUST capture useful game/context diagnostics and provide a retry/reset path that remounts the crashed subtree safely without corrupting persisted progression.

#### Scenario: Retry remounts without progression loss
- GIVEN a game route crashes
- WHEN the error boundary retry/reset path activates
- THEN it captures diagnostics, remounts the subtree, and does not corrupt persisted progression.

### Requirement: Sensory feature claims match implementation
If UI exposes sound/haptic settings as functional product controls, production game feedback MUST route through a real service honoring those settings. If the implementation remains no-op/deferred, product/docs/parity MUST say so rather than claiming completion. Settings intended to survive restart MUST persist.

#### Scenario: Claimed feature routes through real service
- GIVEN UI exposes sound/haptic settings as functional controls
- WHEN production feedback fires
- THEN it routes through a real service honoring the settings, and if deferred the docs say so rather than claiming completion.

### Requirement: Duplicate mechanic review
The three Memory sequence-style games MUST be reviewed for meaningful mechanical distinction. Pattern Tap Back documentation/implementation MUST agree. If distinct value cannot be demonstrated, consolidate into variants/deprecate rather than preserve count inflation.

#### Scenario: Indistinct Memory games consolidated
- GIVEN the three Memory sequence-style games
- WHEN reviewed for mechanical distinction and none is demonstrated
- THEN they are consolidated into variants or deprecated rather than preserving count inflation, with docs and implementation agreeing.