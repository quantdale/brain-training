# Shared UI Contract

## Purpose

Define the observable contract of the shared component kit that every screen and
game renders through: how accessibility state is composed from component and
caller inputs, how the minimum touch-target contract is named and shaped, and
the guarantee that a documented kit component is reachable, tested, and not
duplicated by an unused twin.

## ADDED Requirements

### Requirement: Accessibility state composes component and caller inputs

When a control has its own accessibility state — such as disabled — and the
caller additionally supplies accessibility state, the state applied to the
rendered control SHALL contain both, with the component's own safety-relevant
flags present.

A caller SHALL NOT be able to remove a component's disabled state by supplying
accessibility state. When the component is disabled, the rendered control SHALL
be announced as disabled regardless of what the caller passed.

#### Scenario: Caller supplies partial accessibility state

- **GIVEN** a control rendered in its disabled state
- **AND** the caller supplies accessibility state that does not mention
  `disabled`
- **WHEN** the control is queried
- **THEN** its accessibility state contains `disabled` as true
- **AND** it also contains the state the caller supplied

#### Scenario: Caller supplies its own disabled value

- **GIVEN** a control rendered in its disabled state
- **AND** the caller supplies accessibility state that explicitly sets
  `disabled`
- **WHEN** the control is queried
- **THEN** the applied state is consistent with the control's own disabled
  state and the caller's other values

#### Scenario: Enabled control

- **GIVEN** a control that is not disabled
- **WHEN** the caller supplies accessibility state
- **THEN** the applied state contains the caller's values
- **AND** it reports not disabled

#### Scenario: Regression guard

- **GIVEN** the primitive's prop-composition implementation
- **WHEN** a caller-supplied state is combined with a component-computed state
- **THEN** a test asserts the merged value is the one applied
- **AND** restoring the previous prop order causes that test to fail

### Requirement: The minimum touch-target contract has one canonical name and one shape

The kit SHALL expose the minimum interactive target size under exactly one
canonical name, with exactly one shape. The shape SHALL be the one a consumer can
apply directly to a visible control's style so that the hit area matches what
the user sees.

No second export of the same contract SHALL exist under the same or a similar
name with a different shape. A consumer's style that applies the contract SHALL
compile to a valid minimum target.

#### Scenario: A consumer applies the contract

- **GIVEN** a consumer imports the canonical touch-target contract
- **WHEN** the consumer applies it to a control's style
- **THEN** the resulting style is valid
- **AND** the control's rendered minimum size meets the declared minimum in both
  supported display densities

#### Scenario: Only one definition exists

- **GIVEN** the whole source tree
- **WHEN** the minimum touch-target contract is searched for
- **THEN** exactly one definition of its name is exported
- **AND** no other export provides the same value under a different shape

#### Scenario: Numeric use is explicit

- **GIVEN** code that needs the numeric minimum rather than the style fragment
- **WHEN** it obtains the value
- **THEN** it obtains it from an explicitly numeric export, not by applying the
  style contract in a numeric position

### Requirement: A documented kit component is reachable and tested

A component documented as part of the kit SHALL have at least one product
importer. A kit export with no product importer SHALL either be removed or be
explicitly labelled as not part of the shipped kit surface. A component SHALL
NOT have a live twin with a near-identical name while the duplicate remains the
documented one.

Tests SHALL cover the primitives the kit documents as its contract surface, and
documentation SHALL NOT claim coverage that does not exist.

#### Scenario: An unreachable export exists

- **GIVEN** a kit export with no product importer
- **WHEN** the kit's public surface is enumerated
- **THEN** that export is either absent or explicitly marked as not shipped
- **AND** no test suite exists solely to cover an unreachable export

#### Scenario: Documented contract coverage

- **GIVEN** the kit's documented contract primitives
- **WHEN** their test coverage is enumerated
- **THEN** each has at least one test exercising its documented behavior
- **AND** a documentation claim of exercised behavior is backed by a test that
  would fail if the behavior regressed

#### Scenario: Token changes propagate honestly

- **GIVEN** a design token changes
- **WHEN** the kit is typechecked and its suites run
- **THEN** every shipped component remains correct under the new token values
- **AND** no shipped component is kept alive only by a test

### Requirement: Reduced-motion preference is respected from the first frame

A user who has enabled reduced motion SHALL NOT observe decorative motion that
ignores the preference. Until a persisted preference has been read, the system
SHALL behave as if reduced motion were requested, and SHALL NOT play decorative
motion in that window.

Motion that communicates essential state change — for example feedback that a
value changed — MAY play, and SHALL be distinguishable from decorative motion.

#### Scenario: Cold start with reduced motion enabled

- **GIVEN** a user who previously enabled reduced motion
- **WHEN** a screen with decorative motion mounts for the first time
- **THEN** no decorative motion plays before the persisted preference is known

#### Scenario: Preference read after mount

- **GIVEN** the persisted preference is read after the first render
- **WHEN** the preference indicates reduced motion
- **THEN** subsequent decorative motion does not play

#### Scenario: Reduced motion not enabled

- **GIVEN** a user who has not enabled reduced motion
- **WHEN** a screen with decorative motion mounts
- **THEN** the motion plays as designed
