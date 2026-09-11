# Design Language v2 — Delta Spec

## ADDED Requirements

### Requirement: R1 Single token source of truth

Colour, radius, spacing, typography, elevation, motion and breakpoints MUST be
expressed exclusively through `apps/mobile/src/theme/**`. Literal colour values,
raw font sizes, raw radii and raw durations MUST NOT appear in `src/app/**`,
`src/components/**` or `src/games/*/components/**`, except fully transparent or
`none` values, testIDs, and documented decorative constants declared in the
token layer.

#### Scenario: Colour-literal sweep

- GIVEN the repository at the campaign's final SHA
- WHEN the token-guard sweep enumerates screen and component sources
- THEN zero `#rrggbb`/`rgba(` literals are found outside the allowlist.

### Requirement: R2 Semantic colour families

`accent`, `success`, `warning`, `danger`, `info`, `streak`, `xp`, `currency` and
the eight domain identities MUST each expose `base`, `text`, `soft` and
`softText` slots, and `light` and `dark` MUST expose identical key sets.

#### Scenario: Family and theme completeness

- GIVEN the exported palettes
- WHEN the token test compares key sets and slot coverage
- THEN both themes expose the same keys and every family exposes all four slots.

### Requirement: R3 Contrast compliance

`text` slots MUST reach ≥4.5:1 against `surface` and `background`; `softText`
MUST reach ≥4.5:1 against its `soft` fill; `base` MUST reach ≥3:1 against
`surface`; and text drawn on a `base` fill MUST reach ≥4.5:1, in both themes.

#### Scenario: Accent-as-text regression cannot recur

- GIVEN the Campaign 023 failure (accent 3.8:1 light, 3.9:1 dark as text)
- WHEN the contrast test evaluates the v2 accent `text` slot
- THEN the computed ratio is ≥4.5:1 in both themes.

### Requirement: R4 Elevation ramp

Elevation MUST expose an ordered ramp of at least four levels with monotonic
visual weight, each defining both `boxShadow` and Android `elevation`.

#### Scenario: Monotonic ramp

- GIVEN the elevation export
- WHEN the token test compares consecutive levels
- THEN elevation values increase monotonically and every level defines both
  properties.

### Requirement: R5 Metric identity

The mapping XP→violet, streak→orange, time→sky, accuracy→green,
currency→amber MUST be exposed as named tokens and used wherever those metrics
appear.

#### Scenario: Consistent metric colour

- GIVEN the results, progress and home surfaces
- WHEN metric colour usage is audited
- THEN no metric is rendered in a family other than its identity token.

### Requirement: R6 Typography tokens

The scale MUST include `eyebrow`, `caption`, `label`, `bodySmall`, `body`,
`bodyLarge`, `headline`, `title`, `display`, `numeral`, `numeralLg` and
`numeralXl`, each defining size, lineHeight and weight; numeral tokens MUST
enable tabular figures.

#### Scenario: Token completeness

- GIVEN the typography export
- WHEN the token test inspects each entry
- THEN every entry defines the three properties and numeral entries set
  `fontVariant: 'tabular-nums'`.

### Requirement: R7 Motion specification

Motion MUST define durations `press`, `quick`, `base`, `entrance`,
`celebration`, a stagger step ≤100 ms, and spring presets for press feedback and
progress fills.

#### Scenario: Ordered durations

- GIVEN the motion export
- WHEN the token test compares the duration values
- THEN `press ≤ quick ≤ base ≤ entrance < celebration` holds and the stagger
  step is within bound.

### Requirement: R8 Breakpoints are genuinely consumed

`compact`, `medium` and `expanded` MUST be exposed as tokens consumed by
`platform/layout.ts` hooks, and every exported layout hook MUST have at least
one production consumer.

#### Scenario: No dead responsive API

- GIVEN the layout hooks
- WHEN a consumer sweep runs over `src/app/**` and `src/components/**`
- THEN every hook resolves at least one non-test consumer.

#### Scenario: Documented design system

- GIVEN the campaign completes
- WHEN a maintainer reads `docs/DESIGN_SYSTEM.md`
- THEN the token layer, contrast rules, hierarchy rules and usage constraints
  are documented in it.
