## Purpose

Make product-wide interface quality an evidence-backed release condition through reproducible device observations and honest coverage accounting, independent of code-level test success.

## ADDED Requirements

### Requirement: Traceable before-and-after visual evidence
Before implementation changes the presentation, the project SHALL preserve a release-build baseline with source SHA, APK identity, device configuration and state/route metadata. After implementation, matched device captures SHALL include Home/workouts, discovery/detail, active/feedback/results, Progress, Rewards, Profile/settings and error/recovery states. Evidence MUST distinguish a screenshot, an automated reachability check, and a human visual assessment; missing or inaccessible states SHALL be marked NOT VALIDATED rather than passed.

#### Scenario: Comparison on a matched surface
- **WHEN** reviewers compare a before and after capture
- **THEN** they can determine the source/build, route, UI state, device size, theme and text scale of each, and see whether visual hierarchy and action accessibility improved.

#### Scenario: Incomplete baseline
- **WHEN** a required pre-change state was not captured
- **THEN** the coverage report marks it NOT VALIDATED and schedules a pre-change capture before replacing its presentation; a new-build screenshot is not relabeled as a baseline.

### Requirement: Catalog and route coverage manifest
The project SHALL maintain a review matrix for every registered game and every player-facing route/state, with individually assessed active boards, supported feedback/results and error states, plus representative before/after device images. Successful static tests or a single shared-shell capture SHALL NOT count as visual acceptance for all 42 games.

#### Scenario: Unreviewed game
- **WHEN** any registered game's active board lacks a recorded device-level visual and interaction review
- **THEN** full-catalog experience certification remains incomplete regardless of shared component tests.

#### Scenario: State not reachable in test environment
- **WHEN** a particular state cannot be entered reliably
- **THEN** the manifest records the limitation, cause and remediation plan; it does not silently count a different state as reviewed.

### Requirement: Design and usability decision gate
The redesign SHALL compare three meaningfully different, Refero-anchored directions using working prototypes of the same product journey, document selected and rejected traits and token roles, and select a direction by evidenced legibility, action clarity, playability, accessibility and aesthetic distinction rather than by token similarity alone.

#### Scenario: Prototype decision
- **WHEN** a visual direction is selected for rollout
- **THEN** device captures and a scored comparison of each direction on the same screens exist, and the selected reference lock explicitly protects its typographic, color-role, composition, surface, motion and media rules.

### Requirement: Release-device acceptance
Final acceptance SHALL require a newly built app visibly different from the baseline across multiple destinations and game mechanics; validated Android first-run, daily workout, resume, completion and diagnostic journeys through the repository's authorized runtime controller; light/dark and enlarged-text checks; accessibility review; and regression checks required by the impact map. iOS checks SHALL be recorded independently as PASS, NOT VALIDATED or BLOCKED according to actual tooling and evidence; Android evidence cannot substitute for an iOS pass.

#### Scenario: Tests green but presentation unchanged
- **WHEN** unit and snapshot tests pass but matched device captures show unchanged hierarchy or uncovered game states
- **THEN** the redesign is not certified complete.

#### Scenario: Runtime controller unavailable
- **WHEN** authorized Android runtime automation cannot run
- **THEN** device journeys remain BLOCKED or NOT VALIDATED with the concrete blocker recorded; no alternative host-input automation is counted as an equivalent pass.
