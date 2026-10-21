## Purpose

Keep the repository's quality gates self-describing, machine-enforceable, and
honest about what has and has not been verified, so release decisions rest on
reproducible evidence at exact revisions rather than prose claims.

## ADDED Requirements

### Requirement: Validator CLI contracts are machine-enforced
Every repository gate script's documented command-line options SHALL be
recognized by its own argument parser, every option invoked by GitHub Actions
SHALL be recognized by the invoked script, and unsupported options SHALL fail
deterministically with a usage error and a non-zero exit code. A regression
detector SHALL run in CI and fail when a documented or CI-invoked flag is
unknown to the parser, when exit-code contracts drift, or when gate scripts
are not invocation-independent.

#### Scenario: A documented flag is rejected by its own parser
- **WHEN** a gate script's usage text documents an option that its argument
  parser rejects
- **THEN** the CI regression detector fails and names the script and option

#### Scenario: A workflow invokes an unsupported option
- **WHEN** a GitHub Actions workflow invokes a gate script with a flag the
  script does not recognize
- **THEN** the CI regression detector fails before the workflow's own run can
  silently pass the malformed invocation

#### Scenario: An invalid option is used
- **WHEN** any gate script is invoked with an unknown option
- **THEN** it prints a deterministic usage error, exits non-zero, and produces
  no success output

### Requirement: Complete dependency advisory register
Every accepted dependency advisory SHALL carry a concrete risk rationale with
reachability evidence, a responsible role, a review date, an exit condition,
and its remediation dependency. New advisories on already-accepted packages
SHALL NOT inherit acceptance. Advisories with available in-range fixes SHALL
be remediated in the lockfile rather than waived.

#### Scenario: An advisory is accepted
- **WHEN** a moderate-or-higher production advisory cannot be remediated
  within supported dependency ranges
- **THEN** the reviewed allowlist records its package, GHSA id,
  classification, rationale with reachability, owner, review date, exit
  condition, and remediation dependency, and the dependency gate passes only
  when no unallowlisted finding remains

#### Scenario: An in-range fix becomes available
- **WHEN** a fixed release for an accepted advisory is published inside the
  parents' supported semver ranges
- **THEN** the lockfile is updated to the fixed line, the acceptance entry is
  removed, and the remediation is recorded as remediation rather than waiver

### Requirement: Evidence-bound release certification
Release gates SHALL be recorded in one authoritative certification matrix with
gate identifier, requirement, procedure, source revision, environment, result,
evidence, and limitation. Results SHALL distinguish PASS, FAIL, BLOCKED, and
NOT VALIDATED; source-test success SHALL NOT be recorded as native runtime
certification, compilation SHALL NOT be recorded as runtime testing, and
accepted vulnerabilities SHALL NOT be recorded as remediated.

#### Scenario: Certifying a candidate revision
- **WHEN** a candidate revision is certified
- **THEN** every required gate carries its exact revision and reproducible
  evidence, and any gate that could not run is recorded BLOCKED or NOT
  VALIDATED with its limitation, never PASS
