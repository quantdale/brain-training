# Shared Game Platform — Delta Spec

## ADDED Requirements

### Requirement: Stable lazy component identity
Lazy game component wrappers MUST be created/cached outside ordinary route render so unrelated route rerenders do not create a new component type and unexpectedly remount game state.

### Requirement: Generated registry remains generated
Any generated loader/registry output MUST be produced through its generator. Agents MUST NOT hand-edit generated files as the normal implementation path.

### Requirement: Shared generic UI primitives reduce drift
The platform SHOULD provide shared primitives for generic repeated game UI when behavior is intended to be identical across games, including candidates such as button, pause frame, tutorial frame, QA shell, result stat row, difficulty selector, and session header. Game-specific mechanics/reducers/generators remain module-owned.

### Requirement: Error boundary can recover safely
A game-route error boundary MUST capture useful game/context diagnostics and provide a retry/reset path that remounts the crashed subtree safely without corrupting persisted progression.

### Requirement: Sensory feature claims match implementation
If UI exposes sound/haptic settings as functional product controls, production game feedback MUST route through a real service honoring those settings. If the implementation remains no-op/deferred, product/docs/parity MUST say so rather than claiming completion. Settings intended to survive restart MUST persist.

### Requirement: Duplicate mechanic review
The three Memory sequence-style games MUST be reviewed for meaningful mechanical distinction. Pattern Tap Back documentation/implementation MUST agree. If distinct value cannot be demonstrated, consolidate into variants/deprecate rather than preserve count inflation.