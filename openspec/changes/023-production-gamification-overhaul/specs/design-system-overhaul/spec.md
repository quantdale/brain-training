# Design System Overhaul — Delta Spec

## ADDED Requirements

### Requirement: Single token source of truth

All shell and game-chrome visual values MUST resolve from `theme/tokens.ts`
(color, spacing, radii, typography, elevation, motion). Screens and shared
components MUST NOT introduce one-off magic colors or sizes.

#### Scenario: Token discipline

- GIVEN any modified screen or shared component
- WHEN its styles are inspected
- THEN colors/spacing/radii/type reference exported tokens, and new values are
  added to the token file rather than hardcoded.

### Requirement: Unified tactile interaction language

Primary actions across menus, game shells, and completion surfaces MUST share
one tactile button treatment (rest/pressed/disabled states, visible feedback,
minimum 44×44 touch targets) and one card/feedback surface treatment with
consistent elevation and radius.

#### Scenario: Consistent primary CTA behavior

- GIVEN the Home start-workout CTA, game start CTA, and modal confirm CTAs
- WHEN pressed, disabled, or focused
- THEN they present the same interaction semantics and accessible labels.

### Requirement: Progress meters and feedback cards are standardized

Streak, daily-workout, quest, XP, and game-progress indicators MUST use the
shared progress-meter primitive, and success/fail game feedback MUST use the
shared feedback-card primitive.

#### Scenario: Shared primitives everywhere

- GIVEN a progress indicator or game feedback banner in any screen
- WHEN rendered
- THEN it is produced by the shared primitive, not a screen-local variant.

### Requirement: Accessibility contracts are preserved

The overhaul MUST preserve or improve accessibility: labels/roles/hints on
interactive elements, screen-reader announcements on results and rewards,
reduced-motion compliance, font-scale tolerance, and adequate contrast.

#### Scenario: Motion and contrast

- GIVEN reduced-motion is enabled in settings
- WHEN celebrations and transitions render
- THEN they degrade to non-animated equivalents and no contrast regression is
  introduced.

### Requirement: Visual regression baselines are re-baselined deliberately

Snapshot/visual baseline tests MUST be updated only by explicit re-baselining
after the new visual language is reviewed, never silently skipped.

#### Scenario: Baseline update

- GIVEN the visual-baseline suite fails because styles intentionally changed
- WHEN the new rendering is reviewed and accepted
- THEN baselines are updated in a dedicated commit and the suite passes.
