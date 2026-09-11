# Responsive & Adaptive Layout — Delta Spec

## ADDED Requirements

### Requirement: R1 Breakpoint behaviour is real

Screens MUST adapt across `compact` (<480), `medium` (480–767) and `expanded`
(≥768): `expanded` uses multi-column grouped sections and multi-column grids,
`medium` increases gutters, `compact` keeps a single column.

#### Scenario: Library grid adapts

- GIVEN the Games library
- WHEN rendered at `expanded` and at `compact` width
- THEN the grid presents multiple columns at `expanded` and a single column at
  `compact`, with screenshot evidence for both.

#### Scenario: Grouped sections at expanded width

- GIVEN Home and Progress at `expanded` width
- WHEN their grouped sections render
- THEN sections lay out in two columns instead of one long column.

### Requirement: R2 No clipping at extreme profiles

At the smallest supported width and at tablet width, every surface MUST render
without clipped cards, overlapping controls, or unintended horizontal overflow.

#### Scenario: Profile screenshot set

- GIVEN the compact and expanded screenshot sets for every surface
- WHEN each screenshot is reviewed
- THEN no clipped or overlapping element is present.

### Requirement: R3 Orientation support

Landscape MUST remain usable on every surface: no content trapped off-screen
and no fixed-height layout that overflows; game boards scale or scroll.

#### Scenario: Landscape review

- GIVEN landscape screenshots of Home, Games, a game session and Results
- WHEN reviewed
- THEN all content and controls remain reachable.

### Requirement: R4 Inset correctness

Content MUST clear the status bar, tab bar, keyboard and gesture bar in every
orientation, and the last row of every scrollable surface MUST be fully
reachable.

#### Scenario: Scroll-to-end correctness

- GIVEN every scrollable surface
- WHEN scrolled to its end
- THEN no element is permanently hidden under chrome.

#### Scenario: Keyboard reachability

- GIVEN the Data-management surface with a text input focused
- WHEN the keyboard is open
- THEN the primary action remains reachable.

### Requirement: R5 Font-scale safety

At system font scale up to 2.0 (where the platform allows), text MUST wrap or
grow rather than truncate information, no interactive control may fall below its
44 dp target, and heuristic caps remain only for decorative glyphs.

#### Scenario: Large-font screenshots

- GIVEN `font_scale=2.0` screenshots of Home, Games, a game session and Results
- WHEN reviewed
- THEN no text is clipped or overlapping.

### Requirement: R6 Measurement harness

The campaign MUST provide a repeatable, emulator-local way to switch display
profile/orientation/font scale and capture evidence, documented in
`docs/ANDROID_AUTOMATION.md`.

#### Scenario: Reproducible capture

- GIVEN a running capture AVD
- WHEN the documented capture command is executed
- THEN the full evidence set (PNGs plus manifest) is produced without host
  input.
