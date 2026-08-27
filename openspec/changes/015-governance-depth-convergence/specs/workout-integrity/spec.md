# Workout Completion Attribution Integrity — Delta Spec

## ADDED Requirements

### Requirement: Workout advancement uses causal ownership, not a time grace window

A persisted game session MUST advance a workout only when the system can establish that the session belongs to that workout instance and its current leg. A positive fixed-duration timestamp grace window MUST NOT be the sole or decisive ownership proof.

#### Scenario: Historical result opened shortly after workout creation
- GIVEN an active workout whose current game matches an older persisted session
- AND the older session falls within any former clock-grace interval
- WHEN the results screen is opened
- THEN the workout does not advance unless independent causal ownership is proven.

#### Scenario: Equal timestamps
- GIVEN a session completion timestamp equals the workout's last-touch timestamp
- WHEN ownership is evaluated
- THEN equality alone does not make the session eligible.

### Requirement: Workout identity survives launch, persistence, results, and relaunch

New workout-launched sessions MUST carry enough durable provenance to identify the owning workout instance and, where needed, the expected leg/index. The provenance MUST survive process death and results re-opening.

Legacy sessions that lack this provenance MUST degrade safely: they may be displayed normally, but MUST NOT be allowed to corrupt workout progress through an ambiguous fallback.

#### Scenario: Relaunch after completing a workout game
- GIVEN a workout game is completed and its session is durably persisted
- WHEN the app is killed and results/home are reopened
- THEN the same owning workout resumes at exactly the next leg or completed state
- AND the session cannot advance it a second time.

### Requirement: Concurrent matching workouts are unambiguous

If multiple active workout instances contain the same game at their current position, a completed session MUST advance only its owning instance. Recency ordering MAY be used for display/selection but MUST NOT substitute for persisted ownership.

#### Scenario: Daily and focus workout share the current game
- GIVEN a daily workout and a focus template are both active with the same current game
- WHEN the player completes the game launched from the focus template
- THEN only the focus template advances.

### Requirement: Completion advancement is idempotent at the persistence boundary

Duplicate delivery, repeated results renders, rapid navigation, stale React state, and process relaunch MUST NOT advance one workout leg more than once.

#### Scenario: Same session delivered twice
- GIVEN a session already advanced its owning workout
- WHEN the same session is processed again after local state has been discarded
- THEN persisted workout progress remains unchanged.

### Requirement: Clock skew cannot create false ownership

Workout correctness MUST NOT require wall-clock ordering between independently captured `createdAt`, `updatedAt`, `startedAt`, and `completedAt` values beyond what is explicitly proven by a single authoritative transaction/monotonic source.

#### Scenario: Completion appears slightly earlier than creation
- GIVEN host/device/test clocks or capture order produce small timestamp skew
- WHEN the legitimately owned session is processed
- THEN ownership is determined by durable causal provenance rather than accepting all sessions inside a time window.

### Requirement: Attribution migration is backward-compatible and atomic

If storage schema changes are required, the migration MUST preserve existing sessions/workout history and data-portability behavior. Session persistence and ownership provenance MUST be committed atomically enough that a crash cannot leave an advanceable session with mismatched ownership metadata.

#### Scenario: Legacy database upgrade
- GIVEN a pre-attribution database containing sessions and active/completed workouts
- WHEN the app migrates
- THEN all historical data remains readable
- AND legacy sessions without ownership provenance are handled conservatively without false advancement.

### Requirement: Adversarial routing tests cover ambiguity boundaries

Automated tests MUST cover at least: equal timestamps, historical results inside the former 10-second window, rapid first completion, clock skew, two active instances sharing a game, repeated game IDs, standalone play, duplicate completion, stale hook state, result re-view, process relaunch, and catalog reconciliation.

#### Scenario: Regression suite
- GIVEN the attribution implementation changes
- WHEN targeted and full CI tests run
- THEN every ambiguity/idempotency case passes without weakening historical-session rejection.
