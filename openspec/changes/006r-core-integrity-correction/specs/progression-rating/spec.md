# Progression and Rating — Delta Spec

## ADDED Requirements

### Requirement: Canonical difficulty values
The shared progression engine MUST consume the SDK `DifficultyLevel` type (`easy|normal|hard|expert|adaptive`) directly. It MUST NOT depend on differently-cased string aliases.

#### Scenario: Easy session
- GIVEN a completed session persisted with `difficulty.level = "easy"`
- WHEN authoritative progression is computed
- THEN Easy's configured challenge/expectation policy is used
- AND it does not fall through to Normal because of casing.

#### Scenario: Every named mode
- GIVEN one otherwise-identical session for each canonical named mode
- WHEN the progression engine evaluates them
- THEN each maps through a typed exhaustive policy with no default caused by a valid canonical value.

### Requirement: Continuous challenge evidence
A completed session MUST persist the resolved challenge evidence used for rating, including the final adaptive challenge when adaptive difficulty changes during play. Expected performance SHOULD be a documented function of that challenge evidence rather than named mode alone.

#### Scenario: Adaptive moves harder
- GIVEN an adaptive session whose internal challenge increases from baseline
- WHEN it completes
- THEN persisted evidence contains the final/aggregate challenge required by the rating policy
- AND rating expectation reflects the harder challenge rather than the initial `adaptive` label only.

### Requirement: One authoritative completion outcome
The session-completion boundary MUST return the authoritative persisted XP, currency award, applied rating deltas, resulting ratings, and balance needed by result UI. Game UI MUST NOT display a separate no-op/guessed XP as the earned value.

#### Scenario: Game result after persistence
- GIVEN a game normalizes performance and completes successfully
- WHEN SQLite commits the session and progression transaction
- THEN the UI receives the committed outcome
- AND displayed XP equals persisted session XP
- AND displayed rating movement equals rating history for that session.

#### Scenario: Persistence failure
- GIVEN session persistence fails
- WHEN the game reaches its result phase
- THEN it MUST NOT claim the authoritative XP/rating was saved
- AND retry/error state is explicit.

### Requirement: Easy farming protection
The rating policy MUST prevent trivial easy-mode play below a player's demonstrated challenge from producing material positive skill inflation, while still allowing participation XP according to product policy.

### Requirement: Historical correction is auditable
If historical derived ratings were produced by the defective policy, correction MUST preserve raw sessions, be deterministic/idempotent, and document whether each corrected period had sufficient evidence. If evidence is insufficient, the system MUST use an explicit cutover/uncertainty policy rather than invent data.

### Requirement: Applied delta integrity
Rating history MUST record the actual movement applied after floors/caps, not a larger requested delta that was clipped.