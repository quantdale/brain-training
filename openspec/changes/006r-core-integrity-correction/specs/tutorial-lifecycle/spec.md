# Tutorial Lifecycle — Delta Spec

## ADDED Requirements

### Requirement: Tutorial completion is durable
Tutorial completion MUST persist across component remount, navigation away/back, process death, and app restart.

### Requirement: Tutorial state is versioned
State MUST be keyed by game plus tutorial version (or equivalent). A materially changed tutorial MAY intentionally use a new version to show again without erasing historical completion of the old version.

### Requirement: First-play behavior
A never-completed tutorial MUST show according to game policy. After completion it MUST auto-skip on normal subsequent play unless the user explicitly requests replay.

### Requirement: Replay does not destroy completion
Requesting tutorial replay MUST show the tutorial again while preserving the fact that it had previously been completed; finishing/canceling replay follows documented semantics.

### Requirement: QA bypass remains dev-only
QA may mark a tutorial completed instantly, but production builds MUST NOT expose dangerous QA controls.

### Requirement: Production store injection
Game routes/screens MUST use a persistent TutorialStore by default. The in-memory implementation is allowed for isolated tests, not as the normal production default.

#### Scenario: Restart
- GIVEN a player completes a game's tutorial
- WHEN the process is killed and relaunched
- THEN starting that game does not automatically show the same tutorial version again.