# Tutorial Lifecycle — Delta Spec

## ADDED Requirements

### Requirement: Tutorial completion is durable
Tutorial completion MUST persist across component remount, navigation away/back, process death, and app restart.

#### Scenario: Completion survives restart
- GIVEN a completed tutorial
- WHEN the component remounts, navigates away/back, the process dies, and the app restarts
- THEN completion persists through all of those.

### Requirement: Tutorial state is versioned
State MUST be keyed by game plus tutorial version (or equivalent). A materially changed tutorial MAY intentionally use a new version to show again without erasing historical completion of the old version.

#### Scenario: New tutorial version shows without erasing old completion
- GIVEN a materially changed tutorial with a new version
- WHEN the player encounters it
- THEN it can show again keyed by game+version while historical completion of the old version is preserved.

### Requirement: First-play behavior
A never-completed tutorial MUST show according to game policy. After completion it MUST auto-skip on normal subsequent play unless the user explicitly requests replay.

#### Scenario: Auto-skip after completion
- GIVEN a tutorial never completed
- WHEN the game starts
- THEN it shows per policy; after completion, normal play auto-skips unless replay is explicitly requested.

### Requirement: Replay does not destroy completion
Requesting tutorial replay MUST show the tutorial again while preserving the fact that it had previously been completed; finishing/canceling replay follows documented semantics.

#### Scenario: Replay preserves completion flag
- GIVEN a previously completed tutorial
- WHEN the user requests replay
- THEN the tutorial shows again but the prior completion fact is preserved.

### Requirement: QA bypass remains dev-only
QA may mark a tutorial completed instantly, but production builds MUST NOT expose dangerous QA controls.

#### Scenario: Production hides QA controls
- GIVEN a production build
- WHEN the tutorial lifecycle is exercised
- THEN dangerous QA instant-completion controls are not exposed, while dev/QA builds may use them.

### Requirement: Production store injection
Game routes/screens MUST use a persistent TutorialStore by default. The in-memory implementation is allowed for isolated tests, not as the normal production default.

#### Scenario: Restart
- GIVEN a player completes a game's tutorial
- WHEN the process is killed and relaunched
- THEN starting that game does not automatically show the same tutorial version again.