## ADDED Requirements

### Requirement: Home reroll failures are visible
A rejected reroll (paid debit failure, apply failure, or unexpected throw) MUST surface a danger message on Home, keep the control retryable, and leave the workout instance and balance unchanged.

#### Scenario: Paid reroll rejects
- GIVEN a Home workout with a paid reroll available
- WHEN `paidReroll` / apply rejects
- THEN a danger toast (or equivalent) is visible, coins are unchanged, and reroll can be attempted again

### Requirement: Progress and Profile distinguish error from empty
Progress tab and Profile MUST NOT present a load failure as a new-player/empty state. They MUST show an error with a retry action, matching Home (`home-data-error`) and progress-detail.

#### Scenario: Progress load rejects
- GIVEN the Progress snapshot loader rejects
- WHEN the tab renders
- THEN the "No sessions yet" empty state is not the only content; an error + retry is visible

#### Scenario: Profile load rejects
- GIVEN `loadProfile` rejects
- WHEN Profile renders
- THEN zeros/new-player chrome are not presented as success; an error + retry is visible

### Requirement: Sensory persist failure is disclosed
If sfx/haptics persistence rejects, the in-session toggle may stay, but the user MUST be told it may revert on restart.

#### Scenario: Haptics persist rejects
- GIVEN the player toggles haptics
- WHEN the profile settings write rejects
- THEN a danger toast (or equivalent) is shown

### Requirement: Workout load failure is not "no catalog"
When games are registered, a failed workout instance load MUST NOT use the copy that implies no games are registered.

#### Scenario: Workout load rejects with a catalog
- GIVEN `getAllGameDefinitions()` is non-empty and workout load fails
- WHEN Home renders the workout slot
- THEN it does not claim the plan is missing because games are unregistered
