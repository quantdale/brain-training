# Kit Rebuild — Delta Spec

## ADDED Requirements

### Requirement: R1 Kit restyle

Every `components/ui/**` primitive MUST adopt the new identity (palette, radii,
type, tactile press) while preserving its public API: component names, props,
testIDs and accessibility contract.

#### Scenario: Existing callers

- GIVEN a caller that uses a kit primitive with its documented props
- WHEN the kit is rebuilt
- THEN the caller compiles and behaves unchanged apart from styling.

### Requirement: R2 Tactile interaction

Primary actions MUST present a physical press affordance (lip/edge
compression or equivalent) and MUST keep a >= 44x44 dp target.

#### Scenario: Press

- GIVEN a primary button
- WHEN it is pressed
- THEN the visible surface compresses without moving surrounding layout and
  releases back.

### Requirement: R3 Hero and celebration primitives

The kit MUST provide the identity primitives required by the surfaces: a hero
metric block (value inside/next to a progress visual), a spark/confetti
celebration component and a streak day-strip — all theme-aware, reduced-motion
safe and dependency-free.

#### Scenario: Hero metric

- GIVEN a screen requiring a hero metric
- WHEN it renders
- THEN the metric uses the hero primitive with a labelled value and an
  accessible description.

### Requirement: R4 Contract tests preserved

The kit contract tests (activation blocking, a11y naming, 44 dp, reduced
motion) MUST remain green, updated only where the identity changes the
primitive's default rendering.

#### Scenario: Kit tests

- GIVEN the rebuilt kit
- WHEN `components/ui/__tests__/**` runs
- THEN every contract test passes without weakening assertions.

### Requirement: R5 No new native dependencies

The kit MUST be built from the existing dependency set (React Native views,
Reanimated/worklets if needed); no new native module or asset pipeline.

#### Scenario: Dependency audit

- GIVEN the campaign diff
- WHEN `package.json` files are inspected
- THEN they are unchanged.
