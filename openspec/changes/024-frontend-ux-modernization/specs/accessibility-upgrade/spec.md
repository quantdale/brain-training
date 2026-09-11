# Accessibility Upgrade — Delta Spec

## ADDED Requirements

### Requirement: R1 Contrast compliance in shipped UI

Every foreground/background pairing used in production code MUST meet WCAG AA —
≥4.5:1 for body text, ≥3:1 for large text and UI boundaries — in both themes.

#### Scenario: Accent text failure resolved

- GIVEN the Campaign 023 accent-as-text values (3.8:1 light, 3.9:1 dark)
- WHEN the v2 tokens are measured
- THEN each pairing used in code passes its threshold in both themes.

#### Scenario: Soft-fill text passes

- GIVEN success, warning, danger and streak soft cards
- WHEN text-on-soft ratios are computed in both themes
- THEN each is ≥4.5:1.

### Requirement: R2 Accessible names, roles and states

Every interactive element MUST expose a role; icon-only controls MUST expose a
label; toggles MUST expose checked/selected state; navigation rows MUST expose
button or link roles; charts MUST expose a textual summary.

#### Scenario: Audited gaps closed

- GIVEN the gap list recorded in `audit-map.md`
- WHEN each element is inspected in a hierarchy dump
- THEN it carries a role, a name, and state where applicable.

### Requirement: R3 Minimum touch targets

Every interactive element MUST present at least 44×44 dp, through layout size or
`hitSlop`.

#### Scenario: Audited violations closed

- GIVEN the Code Cracker pegs and every other sub-44 dp control found in recon
- WHEN the runtime hierarchy is measured
- THEN each exposes an interaction area of at least 44×44 dp.

### Requirement: R4 Screen-reader flow

Headings MUST be discoverable in order, modals MUST isolate the accessibility
tree and announce on open, decorative art MUST be hidden from assistive
technology, and live regions MUST be limited to changes that are not otherwise
perceivable.

#### Scenario: Structural dump review

- GIVEN Home, Progress and Results
- WHEN their hierarchies are dumped
- THEN headings appear in visual order and celebration/decorative nodes are
  hidden.

### Requirement: R5 Dynamic type

Text MUST remain legible and layouts intact up to 2.0× system font scale, and
truncation MUST NOT hide task-critical information.

#### Scenario: Large-font layout

- GIVEN the `font_scale=2.0` screenshot set
- WHEN reviewed
- THEN no task-critical text is clipped and no control is unreachable.

### Requirement: R6 Reduced motion and sensory control

Every animation MUST collapse under reduced motion, and every audio or haptic
effect MUST honour the global sensory settings.

#### Scenario: Gating verified

- GIVEN reduced motion enabled and each sensory toggle disabled in turn
- WHEN affected surfaces and games run
- THEN animation collapses and the gated effects do not fire.

### Requirement: R7 Measured evidence and honest classification

The campaign MUST record accessibility measurements (contrast values, target
sizes, hierarchy dumps) in `.agent/VALIDATION.md` and MUST classify manual
TalkBack/screen-reader review as NOT VALIDATED unless actually performed.

#### Scenario: Evidence recorded

- GIVEN the campaign's validation entry
- WHEN reviewed
- THEN each accessibility claim cites a measurement artifact, and unperformed
  manual review is marked NOT VALIDATED with the reason.
