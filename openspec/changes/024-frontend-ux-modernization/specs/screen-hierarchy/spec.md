# Screen Hierarchy — Delta Spec

## ADDED Requirements

### Requirement: R1 One hero per surface

Each surface listed below MUST render exactly one hero element that is
unambiguously the largest and most contrasted element in its first viewport:
Home, Games, Game detail, Progress, Results, Rewards, Profile, Data management,
game intro, game session HUD, game results.

#### Scenario: Hero identification

- GIVEN the after-change screenshot set
- WHEN each surface's first viewport is reviewed
- THEN exactly one dominant element is identified, and `audit-map.md` records
  the hero chosen per surface.

### Requirement: R2 One primary action per viewport

A viewport MUST contain at most one filled primary button; competing actions
MUST be rendered as secondary, ghost or textual actions.

#### Scenario: Primary-button audit

- GIVEN the render tree of each surface
- WHEN primary-variant buttons are counted per viewport region
- THEN the count is at most one.

### Requirement: R3 Uniform section anatomy

Sections MUST use the shared `SectionHeader` (title, optional caption, optional
"See all" action) and any section with deeper content MUST expose that action.

#### Scenario: No inline section headers

- GIVEN Home, Progress and Profile
- WHEN section headers are inspected
- THEN none is implemented inline outside the shared primitive.

### Requirement: R4 Reference-grade per-surface structure

Each surface MUST implement the structure recorded for it in
`research/refero-core-screens.md` (`PATTERNS-CORE`) and
`research/refero-play-screens.md` (`PATTERNS-PLAY`): Home carries a daily-goal
hero with progress and a dual-line primary CTA; Results uses celebration →
headline → metric row → single CTA; streaks render as a day strip with count;
metric cards carry identity colour; lists render as `ListRow`s; game intro
shows a reward box with one CTA.

#### Scenario: Pattern mapping recorded

- GIVEN the campaign's task records
- WHEN a reviewer reads `audit-map.md`
- THEN each implemented pattern maps to a pattern id, the element that
  implements it, and a screenshot reference.

### Requirement: R5 No dead ends

Every empty or error surface MUST present a next step (retry, first action or
navigation) rather than a bare message.

#### Scenario: Empty surfaces are actionable

- GIVEN Games with no search results, Rewards with nothing claimable, Progress
  with no data, and Data management with no backup
- WHEN each is rendered
- THEN each shows an empty state with an action.

### Requirement: R6 Tab bar contract

The tab bar MUST mark the active destination with more than a tint change, MUST
provide an accessible label for every destination, and MUST NOT overlap content
or the gesture bar in any orientation.

#### Scenario: Labels and state

- GIVEN the running app
- WHEN the hierarchy is dumped on any tab
- THEN every destination exposes a label and the active destination exposes a
  selected state.

#### Scenario: No clipping under chrome

- GIVEN every scrollable surface
- WHEN scrolled to its end
- THEN the last element is fully visible above the tab bar and gesture bar.

### Requirement: R7 Preserved QA contracts

All existing testIDs and copy semantics that QA/certification depends on MUST
remain present (`home-*`, `games-*`, `game-detail-*`, `progress-*`,
`profile-*`, `rewards-*`, `data-*`, `results-*`, `<game>-intro|start|results|
restart|done`). Removing one requires updating the harness in the same change.

#### Scenario: Harness contracts still resolve

- GIVEN the rebuilt app
- WHEN `node scripts/qa/autobot.mjs --self-test` and the canary journeys run
- THEN every selector resolves and the journeys pass.
