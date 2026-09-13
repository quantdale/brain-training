# Validator / CI Hardening — Delta Spec

## ADDED Requirements

### Requirement: V1 Dependency-audit allowlist policy is enforced

The dependency-audit gate MUST enforce its written allowlist policy:
`runtime-accepted-debt` entries require a future ISO `expires` and a
non-empty `tracking` reference; unknown classifications are rejected; expired
entries fail closed; new advisories never inherit acceptance.

#### Scenario: Expired accepted debt

- GIVEN an allowlisted runtime advisory whose `expires` is in the past
- WHEN the gate runs
- THEN the run fails closed and names the expired entry.

#### Scenario: Missing tracking

- GIVEN a `runtime-accepted-debt` entry without `tracking`
- WHEN the allowlist is parsed
- THEN the gate fails with a schema error.

### Requirement: V2 Offline boundary detection is robust

The static offline validator MUST detect network APIs reached through
aliasing, dynamic property access, whitespace-separated calls, and the
`sendBeacon`/`EventSource` APIs, and MUST NOT skip a code line merely because
it contains `*` or `//` outside a real comment. Self-test fixtures MUST pin
each class and run in CI.

#### Scenario: Aliased fetch

- GIVEN a source file assigning `globalThis.fetch` to a local binding and
  invoking it
- WHEN the validator runs
- THEN the file is reported as a violation.

#### Scenario: Multiplication line

- GIVEN a violating fetch call on a line that also multiplies two numbers
- WHEN the validator runs
- THEN the line is still reported.

### Requirement: V3 IMPACT_MAP and affected-rules cannot drift silently

The affected-validation rules MUST expose structured area/path data, the
human IMPACT_MAP MUST be checked for content-level agreement (not row count
alone), and the check MUST run in CI.

#### Scenario: Drifted pattern

- GIVEN a path pattern added to the executable rules but absent from the
  IMPACT_MAP table (or vice versa)
- WHEN the sync check runs
- THEN it fails with the specific drift.

### Requirement: V4 Repository-state validation cannot fail open

The repository-state validator MUST require `.agent/task-ownership.json` and
`.agent/EXECUTION_PROMPT.md`, MUST report ownership parse failures instead of
silently skipping them, and MUST verify that scripts referenced by workflow
files exist.

#### Scenario: Malformed ownership file

- GIVEN a malformed `.agent/task-ownership.json`
- WHEN the validator runs
- THEN it fails with a parse error instead of skipping the binding check.

### Requirement: V5 Skip allowlists cannot go stale

The Jest skip allowlist MUST be validated for staleness: every entry's file
MUST exist and contain its `enableWith` token; entries that match no current
skip MUST be reported. Entries MUST carry review metadata.

#### Scenario: Stale allowlist entry

- GIVEN an allowlist entry whose `enableWith` token no longer exists in the
  named file
- WHEN the validator runs
- THEN it fails naming the stale entry.

### Requirement: V6 Clean-checkout certification matches CI

The clean-checkout certification script MUST run the same gate families as
CI (dependency audit, workflow hygiene, secrets, jest signal) so its verdict
cannot overstate release confidence, and its documentation MUST describe the
real gate set.

#### Scenario: Divergent gate set

- GIVEN the certification runs on a tree that fails the dependency audit
- WHEN it completes
- THEN it fails rather than certifying.

### Requirement: V7 Advisory freshness is scheduled

The repository-integrity workflow MUST run on a weekly schedule so network
advisory checks surface without a push.

#### Scenario: Scheduled run

- GIVEN no pushes for a week
- WHEN the schedule fires
- THEN the dependency-audit gate runs and reports any new advisory.
