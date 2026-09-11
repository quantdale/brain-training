# Shell and Routes — Delta Spec

## ADDED Requirements

### Requirement: R1 Recomposed shell

Home, Games, Progress, Profile/Rewards/Data management, Results and the tab
bar MUST be recomposed on the new identity: one hero per screen, one primary
action per screen, section headers with a right-side action, and a filled
lozenge active tab state.

#### Scenario: Home

- GIVEN the Home surface
- WHEN it renders
- THEN a single hero (daily workout/streak/level loop) dominates, secondary
  sections read as rows or quieter cards, and exactly one primary action is
  visually strongest.

### Requirement: R2 Games as a catalog

The library MUST present games with category identity colours and a
recommendation/featured treatment; game detail MUST use a single-path resume
block with one primary CTA.

#### Scenario: Library scan

- GIVEN the Games library
- WHEN it renders
- THEN each category is visually identifiable by its domain hue and the
  featured/recommended game owns the strongest treatment.

### Requirement: R3 Progress readability

Charts MUST be readable (labels/axis context, zero states), metric cards MUST
own identity colours, and an activity dot-matrix or equivalent rhythm view
MUST exist.

#### Scenario: Empty progress

- GIVEN no session history
- WHEN Progress renders
- THEN a designed empty state (mark, headline, one line, CTA) appears instead
  of blank chart frames.

### Requirement: R4 Achievement states

Claimable, in-progress and locked achievements MUST be visually distinct
treatments (action button vs progress meter vs desaturated badge).

#### Scenario: Rewards list

- GIVEN a mixed list of reward states
- WHEN it renders
- THEN each state is distinguishable without reading its label.

### Requirement: R5 TestID and navigation integrity

Every existing testID and route MUST survive the recomposition; the automation
harness selectors (`home-*`, `results-*`, `progress-*`, `profile-*`,
`rewards-*`, `data-*`, `tab-*`, `game-*`) MUST still resolve.

#### Scenario: Harness selectors

- GIVEN the canary automations after the rebuild
- WHEN they run
- THEN every selector they used before still resolves.
