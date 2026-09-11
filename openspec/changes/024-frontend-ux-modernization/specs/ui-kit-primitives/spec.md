# UI Kit Primitives — Delta Spec

## ADDED Requirements

### Requirement: R1 Required primitives

The kit at `apps/mobile/src/components/ui/**` MUST provide `Tappable`, `Button`,
`IconButton`, `Card`, `Chip`, `Badge`, `ProgressBar`, `ProgressRing`,
`AnimatedNumber`, `StatBlock`, `ListRow`, `EmptyState`, `Skeleton`,
`TextField`, `ScreenHeader`, `Avatar`, `Toast`/`ToastHost`, `Sheet` and an
upgraded `SegmentedControl`.

#### Scenario: Kit renders

- GIVEN the kit index
- WHEN each primitive is rendered in a test environment
- THEN it mounts without a native-module error and without requiring props
  beyond its documented contract.

### Requirement: R2 State completeness

Every pressable primitive MUST implement enabled, disabled and pressed states,
and MUST expose a `loading` state where an asynchronous action is plausible.
Disabled or loading controls MUST NOT fire their action.

#### Scenario: Disabled and loading block activation

- GIVEN a `Button` in disabled state and another in loading state
- WHEN each is pressed
- THEN neither invokes its `onPress` handler.

### Requirement: R3 Press feedback contract

Every pressable MUST animate press-in/out with the motion tokens, MUST fire a
selection haptic where supported and enabled, and MUST NOT delay `onPress`
behind the animation. Both effects MUST be suppressed appropriately: animation
under reduced motion, haptics under the global sensory setting.

#### Scenario: Press is immediate

- GIVEN a pressable in the kit
- WHEN the gesture activates
- THEN `onPress` fires with the gesture and the pressed visual state applies
  within one frame.

#### Scenario: Reduced motion keeps state feedback

- GIVEN reduced motion is enabled
- WHEN a pressable is pressed
- THEN scale animation is skipped and the pressed visual state still applies.

### Requirement: R4 Accessibility by construction

Every interactive primitive MUST set an accessibility role, MUST require a
non-empty accessible name through its typed props, and MUST guarantee an
interaction area of at least 44×44 dp via layout size or `hitSlop`.

#### Scenario: Role, name and target size

- GIVEN every pressable exported by the kit
- WHEN rendered and measured
- THEN each exposes a role, a non-empty accessible name, and an interaction
  area of at least 44×44 dp.

### Requirement: R5 Token purity

Kit components MUST consume theme tokens only and MUST NOT contain colour, size
or duration literals beyond the `design-language-v2` allowlist.

#### Scenario: Kit is covered by the literal sweep

- GIVEN the token-guard sweep
- WHEN it runs over `src/components/ui/**`
- THEN no non-allowlisted literal is reported.

### Requirement: R6 Inline duplication removed

The inline patterns enumerated in `audit-map.md` (CTA pills, hairline `rgba`
literals, linear track+fill copies, navigation rows, empty-state cards, badges,
raw `TextInput`s) MUST be replaced by kit primitives, leaving zero remaining
copies.

#### Scenario: Duplication sweep is clean

- GIVEN the enumerated patterns
- WHEN a repository sweep runs at the campaign's final SHA
- THEN zero non-allowlisted occurrences remain.

### Requirement: R7 Loading and empty coverage

Every data-driven screen MUST render a non-blocking placeholder (skeleton or
equivalent) while loading instead of bare spinner text, and every list that can
be empty MUST render `EmptyState` with a next step.

#### Scenario: Coverage inventory

- GIVEN the surface inventory in `audit-map.md`
- WHEN each data-driven surface is exercised with an empty and a loading state
- THEN a placeholder and an actionable empty state are observed.
