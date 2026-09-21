# Spec — adversarial-convergence-runtime-data-pixel

## ADDED Requirements

### Requirement: Replace import cannot brick progression bootstrap

Definition seeding SHALL NOT trust the persisted progression fingerprint
alone: when the fingerprint matches but the persisted quest/achievement
definitions are missing or incomplete, the seed pass SHALL run. A
replace import SHALL NOT be able to leave the profile fingerprint
claiming catalogs that the imported data does not contain.

#### Scenario: Crafted replace import recovers

- GIVEN a valid backup whose profile carries the current seed fingerprint
  and whose definition arrays are empty
- WHEN it is imported in Replace mode and bootstrap runs
- THEN seeding restores the definitions and bootstrap reaches Home
  without a foreign-key failure or recovery loop.

#### Scenario: Fingerprint with missing rows re-seeds

- GIVEN a database whose fingerprint matches the in-code version but
  whose definition tables are empty
- WHEN `refreshProgression` runs
- THEN the missing definitions are seeded before quest/achievement sync.

### Requirement: Device transactions enforce foreign keys

The app database adapter SHALL enable `PRAGMA foreign_keys = ON` on every
connection used for transactions, so a FK-violating write inside
`db.transaction()` fails on device exactly as it does on the main
connection and in the Node backend.

#### Scenario: Transaction FK violation is rejected

- GIVEN a transaction callback that inserts a child row with no parent
- WHEN the transaction runs through the adapter
- THEN the write is rejected with a foreign-key error and the
  transaction rolls back.

#### Scenario: Adapter applies the pragma on the transaction connection

- GIVEN the expo adapter's transaction path
- WHEN a transaction starts
- THEN the pragma is executed on the transaction connection before the
  callback body runs.

### Requirement: Database initialization is idempotent

`initDatabase()` SHALL return the existing singleton when one is already
initialized instead of opening a second connection; sequential retries
after a successful initialization SHALL NOT leak native handles or
replace the write queue.

#### Scenario: Success-then-ready retry does not re-open

- GIVEN an initialized database
- WHEN `initDatabase()` is called again
- THEN the same instance is returned and the adapter is not re-created.

#### Scenario: Retry after failure still initializes

- GIVEN a failed initialization that closed its adapter
- WHEN `initDatabase()` is called again
- THEN a fresh pass runs and succeeds normally.

### Requirement: Workout repair is CAS-safe and portability-aware

The reconcile/persistRepaired repair paths SHALL predicate their writes
on the observed workout state so a concurrent leg advance cannot be
replayed or deleted; `applyReroll` SHALL include the raw
`game_ids_json` in its compare predicate. Replace import and wipe SHALL
emit the workout-changed signal so in-memory workout consumers refetch.

#### Scenario: Repair racing an advance does not replay a leg

- GIVEN a stored workout at `currentIndex = n` with a retired future game
- WHEN a repair read is interleaved with a successful advance CAS
- THEN the repair write does not commit against the advanced row.

#### Scenario: Portability operations invalidate workout state

- GIVEN Home is mounted with an active workout
- WHEN the user wipes local data or replace-imports a backup
- THEN workout consumers refetch and render the durable state.

### Requirement: Economy retries and rating recency are time-safe

UI-initiated economy operations SHALL reuse a stable operation key across
retries of the same user intent. `domain_ratings.updated_at` SHALL be
monotonic (never move backwards for out-of-order completions). A
personal-best badge SHALL require exactly one eligible session in the
comparison universe.

#### Scenario: Retrying a streak-item purchase does not double-charge

- GIVEN a purchase whose first attempt committed but reported failure
- WHEN the user retries the same purchase intent
- THEN the retry is idempotent and the balance is debited once.

#### Scenario: Out-of-order completion does not regress recency

- GIVEN a domain rated at time T2
- WHEN a session with `completedAt < T2` is applied
- THEN the stored `updated_at` does not move backwards.

#### Scenario: Future-dated session cannot claim a personal best

- GIVEN a session whose `completedAt` is after the comparison bound
- WHEN its results render
- THEN no personal-best badge is awarded unless the session is inside
  its own eligible universe.

### Requirement: Test signal cannot be silenced

The QA-gate production-safety checks SHALL run unconditionally; the
jest-skip allowlist SHALL pin each reviewed skip exactly (no
substring-absorption of new skips); the console guard SHALL detect and
fail when a test replaces a guarded console method; the jest-signal
report SHALL NOT emit counters that cannot be populated; and the
certification gate SHALL enforce reviewed minimum suite/test floors.

#### Scenario: New skip inside an allowlisted suite fails

- GIVEN an allowlisted opt-in suite
- WHEN an additional `it.skip` appears whose name contains the
  allowlist pattern but is not the reviewed test
- THEN the signal validator rejects it.

#### Scenario: Console spy is detected

- GIVEN a test that replaces `console.error`
- WHEN it emits unexpected output and the assertion runs
- THEN the gate fails and names the replaced method.

#### Scenario: Suite floor protects against mass test loss

- GIVEN a run below the reviewed minimum suites/tests
- WHEN the signal validator runs
- THEN it fails instead of passing green.

#### Scenario: QA gates execute

- GIVEN the production-safety suite
- WHEN the matrix runs
- THEN the dev-only hook assertions execute (not conditionally skipped).

### Requirement: Catalog reintroduction guards

Shared deterministic guards SHALL cover the catalog for: (a) at most one
score statement per results surface; (b) every game's tutorial using the
shared frame (explicit exemptions only); (c) the pause control wired
into the wrapping session header; (d) interactive nodes in rendered
game sessions meeting the 44 dp floor.

#### Scenario: Duplicate score row is caught

- GIVEN a game whose results render two score statements
- WHEN the catalog results guard runs
- THEN it fails naming the game.

#### Scenario: Touch-target floor is caught

- GIVEN a game control rendering below the 44 dp contract without
  hit-slop
- WHEN the catalog session guard runs
- THEN it fails naming the game and node.

### Requirement: In-session results and failures are announced

The in-session result headline, persist-failure message, and
workout-advance failure SHALL expose live-region semantics (or focused
reachability) so assistive technology receives them; `ResultRow` SHALL
present label and value as one accessible statement.

#### Scenario: Result announcement exists

- GIVEN a completed in-session result
- WHEN the results chrome renders
- THEN the headline is inside an announced live region.

### Requirement: Scaling and wrapping contracts for game controls

Game controls SHALL grow with font scaling or cap their label scale:
fixed-size answer buttons SHALL use minimum dimensions, answer chips
SHALL meet the 44 dp floor, and the pause overlay's action row SHALL
wrap instead of clipping.

#### Scenario: Font-scale-2 label fits

- GIVEN font scale 2
- WHEN the color-match answer buttons render
- THEN their labels fit without clipping (minimum sizing or capped
  scale).

### Requirement: Governance and evidence reconciliation

Durable governance SHALL name the active 056–067 program; certified
artifact provenance SHALL name the commit the artifact was built from;
064 probe baselines SHALL be durable; falsified closure sentences in
campaign-055 evidence SHALL be corrected; and `validate-repo-state`
SHALL reflect the active program on the next change.

#### Scenario: Fresh session sees the active program

- GIVEN the repository at the 065 close
- WHEN the startup protocol reads governance state
- THEN the active program and current change are stated, not "none".

#### Scenario: Artifact provenance is exact

- GIVEN the certified 063 artifact metadata
- WHEN its source commit is read
- THEN it names `e627473` (the build source), not the prior checkpoint.

## MODIFIED Requirements

None.

## REMOVED Requirements

None.
