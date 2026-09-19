## Why

The current product is buildable and its broad deterministic suite passes, but
the audit found four bounded integrity gaps that can conceal failure or weaken
confidence: post-initialization bootstrap failures can still yield a ready
shell, an accepted runtime router dependency advisory needs a safe remediation
decision, passing tests emit uncontrolled signal noise, and persistence failure
coverage is representative rather than catalog-wide. Addressing those gaps now
reduces the chance that new product work is built on unobservable degradation.

## What Changes

- Define an explicit startup-integrity and recovery contract that separates
  foundational registry/progression failure from independently nonfatal
  preference reads, with retry/relaunch convergence and honest user-visible
  state.
- Define a dependency-and-route-safety decision gate: accept only an
  Expo-compatible upstream remediation for the existing router advisory, or
  retain the time-bounded accepted-debt record with evidence; add a bounded
  route-input defense only where architecture proves it is effective.
- Establish an automated-test signal contract that repairs known async test
  patterns, captures expected error paths deliberately, and rejects newly
  unexpected test-console noise without hiding real failures.
- Establish a discoverable, table-driven persistence-failure contract across
  the registered game catalog, including restart/stale-completion behavior and
  explicit exemptions where a game cannot use the shared fixture surface.
- Add a proportional convergence plan that pairs affected deterministic checks
  with emulator-local runtime evidence while preserving clear NOT VALIDATED
  boundaries for external CI, iOS, physical-device, accessibility-assistive,
  store-signing, and system-sheet coverage.

## Must Not Change

- Do not rewrite SQLite, data portability, currency/progression semantics,
  game mechanics, scoring rules, generators, or historical result formats.
- Do not introduce a database migration, native module, host-input automation,
  a second runtime controller, or a broad visual/product redesign.
- Do not downgrade Expo Router blindly, add a permanent audit exemption, claim
  local route validation cures upstream parsing, or alter CI workflow files to
  mask external zero-step failures.
- Do not change production behavior in this proposal-only campaign; all work
  here is an executable plan and evidence record.

## Capabilities

### New Capabilities

- `startup-integrity-recovery`: truthful startup state and recovery behavior
  when foundational initialization cannot complete.
- `dependency-route-safety`: safe lifecycle for accepted runtime dependency
  debt and bounded deep-link/route input handling.
- `automated-test-signal-integrity`: reliable asynchronous test and console
  signal behavior without blanket suppression.
- `catalog-persistence-failure-contract`: executable all-catalog persistence
  failure and stale-completion regression coverage.

### Modified Capabilities

- None. The repository has no corresponding main OpenSpec capability specs;
  these contracts are introduced as new, bounded requirements.

## Acceptance and Validation

- A foundational bootstrap failure cannot silently present a normal ready shell;
  retry and cold relaunch have deterministic, tested outcomes while cosmetic
  preference failure remains nonfatal.
- A dependency decision records the exact compatible remediation evidence or a
  renewed, time-bounded accepted-debt rationale; no unsafe downgrade is made.
- The test command has a documented baseline with known `act`/deprecation
  faults repaired and newly unexpected console errors actionable.
- Every registered game is dynamically covered by a persistence
  success/failure/stale-completion matrix or has a reviewed, explicit
  exemption; failure does not award duplicate progression/currency or leave
  stale completion actionable.
- Required checks are selected through `.agent/IMPACT_MAP.md`, include the
  repository validators and affected unit/integration tests, then add a
  bounded Android emulator-local launch/recovery journey. Unavailable external
  environments remain NOT VALIDATED rather than assumed green.

## Sequencing and Rollback

Bootstrap integrity is first and serial. Dependency decision work is isolated;
test-signal and catalog-contract work can run in parallel after their baselines
are captured. Convergence validation is serial and gates completion. Each slice
must be independently commit/revertible; dependency lockfile changes are
separate from behavior changes. Rollback reverts the affected slice without a
database migration or compatibility break, followed by the same startup and
persistence canaries.

## Impact

Future implementation is expected to touch the mobile bootstrap boundary,
route/session-provenance validation where proven effective, test harnesses and
targeted tests, catalog contract fixtures, the dependency lockfile only after a
safe decision, and durable validation evidence. It must not alter product code,
dependencies, schemas, or production tests in this Campaign 053 proposal
commit.
