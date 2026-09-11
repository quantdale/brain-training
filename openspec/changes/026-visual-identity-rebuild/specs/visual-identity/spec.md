# Visual Identity — Delta Spec

## ADDED Requirements

### Requirement: R1 New palette, both themes

The app MUST ship a new palette (distinct from the Campaign 024 blue-indigo
system) through `theme/tokens.ts` only, applied consistently in both light and
dark themes.

#### Scenario: Theme switch

- GIVEN any shell surface in light theme
- WHEN the system theme switches to dark
- THEN the same surface renders with the dark palette and no element keeps a
  light-theme literal.

### Requirement: R2 Contrast verified

Every text/background and UI-boundary pairing used by the system MUST pass
WCAG AA (>= 4.5:1 for body text, >= 3:1 for large text and UI boundaries) in
both themes, asserted by the contrast harness.

#### Scenario: Contrast test

- GIVEN the updated contrast test
- WHEN it runs
- THEN every declared pairing asserts the WCAG threshold for its role.

### Requirement: R3 Semantic colour roles

Semantic families (success/danger/warning/info/accent), metric identities
(XP/streak/level/time/accuracy/best) and eight domain identities MUST map to
stable hues whose meaning never changes between screens or themes.

#### Scenario: Domain identity

- GIVEN two different games from different categories
- WHEN their category chips render
- THEN each uses its own domain hue, and the hue is identical on every other
  surface that shows that domain.

### Requirement: R4 Typography and numerals

The identity MUST use a heavier display scale with tabular numerals for every
score/metric, and font-scale-2 MUST remain legible.

#### Scenario: Score rendering

- GIVEN a score that changes value
- WHEN the numeral updates
- THEN it keeps a fixed tabular width and does not reflow its layout.

### Requirement: R5 Geometry and motion tokens

Radii, button heights/lip, spacing rhythm and motion timings MUST come from
tokens; press/entrance/celebration motion MUST be reduced-motion aware.

#### Scenario: Reduced motion

- GIVEN reduced motion is enabled
- WHEN a celebration or entrance would animate
- THEN the end state renders statically without motion.

### Requirement: R6 No stray literals

Presentation code MUST NOT carry hardcoded colour literals outside the token
definitions (existing documented exceptions may only be removed, not added).

#### Scenario: Colour sweep

- GIVEN the shell, routes, kit and game chrome
- WHEN they are searched for hex/rgba literals
- THEN only token files and justified data (e.g. a game's stimulus palette)
  contain them.
