# Runtime Certification — Delta Spec

## ADDED Requirements

### Requirement: Game certification breadth beyond canaries

Runtime certification MUST exercise the game registry at the strongest
practical breadth via the existing autobot harness, and every failure MUST be
individually investigated rather than converted into a skip or selector
weakening.

#### Scenario: Registry-wide certification

- GIVEN the dedicated AVD runs the candidate build
- WHEN certify-mode journeys execute across registered games
- THEN each executed game demonstrates reachable controls, legitimate
  interaction, completion, exactly-one session persistence, and invariants on
  score/duration/type.

### Requirement: Lifecycle and Workout V3 state survive hostile conditions

Process death, force-stop, and background/foreground churn during active
games and active Workout V3 sessions MUST NOT produce duplicate writes,
double-paid legs, lost XP, negative durations, stale timers, or corrupted
provenance.

#### Scenario: Process death mid-workout

- GIVEN a Workout V3 session with completed legs
- WHEN the app process is force-stopped and relaunched
- THEN the authoritative workout resumes unchanged and completed legs cannot
  be paid twice.
