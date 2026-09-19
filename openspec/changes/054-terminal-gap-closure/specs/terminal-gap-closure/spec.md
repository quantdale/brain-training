## Purpose

Leave exactly one coherent, evidence-backed answer to what is still open in
the repository before any new product or design campaign begins.

## ADDED Requirements

### Requirement: Authoritative gap census
The repository SHALL maintain a terminal gap census that records every known,
recorded, or observed gap with its sources, first campaign, current evidence,
owner class, severity, closure action, and exactly one final disposition from
the defined taxonomy. No gap may be left in an unclassified "known issue"
state.

#### Scenario: Census completeness
- **WHEN** the terminal closure is executed
- **THEN** every open or ambiguous item across durable state, evidence
  packets, CI, dependencies, tests, builds, and runtime is enumerated with a
  final disposition

#### Scenario: No vague bucket
- **WHEN** a gap cannot be classified
- **THEN** it is recorded as an open product defect rather than hidden in
  general documentation

### Requirement: Validation-count reconciliation
The repository SHALL reconcile any disagreement between recorded validation
counts and the authoritative full-suite run, correcting current documentation
while preserving historically correct intermediate counts.

#### Scenario: Count mismatch
- **WHEN** recorded suite/test counts disagree
- **THEN** the authoritative current run is executed, the delta is root-caused
  to specific suites/tests, and all current documentation states one truth

### Requirement: Exact-final artifact provenance
The repository SHALL establish that runtime evidence corresponds to the exact
current product source, or rebuild and re-validate the release artifact when
source changed.

#### Scenario: Product source unchanged
- **WHEN** no executable source changed after the prior runtime artifact
- **THEN** the equivalence is proven from Git history and a forced rebuild is
  compared by artifact hash

#### Scenario: Product source changed
- **WHEN** executable source changed
- **THEN** a new release artifact is built, hashed, installed, and exercised
  before any closure claim

### Requirement: Runtime and provider gap re-testing
The repository SHALL re-test previously unclosed runtime observations on the
exact final artifact with bounded repetition, separating application behavior
from platform/provider behavior.

#### Scenario: Observation not reproduced
- **WHEN** a historical observation is not reproduced across the bounded
  matrix
- **THEN** it is classified as not reproducible with bounded evidence, not as
  impossible and not as a clean guarantee

#### Scenario: Provider path exercised
- **WHEN** a system picker/provider path is involved
- **THEN** app-side invocation, cancel, selection, preview, and malformed
  handling are tested separately from provider behavior

### Requirement: External and dependency disposition currency
The repository SHALL refresh external classifications and dependency
dispositions with current evidence and SHALL apply only safe, compatible,
in-range remediations.

#### Scenario: Safe remediation available
- **WHEN** a safe compatible dependency remediation exists
- **THEN** it is isolated, applied, re-validated, and its waiver removed

#### Scenario: No compatible remediation
- **WHEN** no compatible remediation exists
- **THEN** the accepted disposition carries current reachability evidence,
  rationale, and a time bound

### Requirement: Durable-state consistency
The repository SHALL keep governance, state, execution prompt, task ownership,
OpenSpec status, and evidence references mutually consistent while preserving
historical records.

#### Scenario: Stale OpenSpec status
- **WHEN** a change whose campaign terminally validated still reads ACTIVE
- **THEN** its terminal status and note are recorded and strict validation is
  rerun

### Requirement: Adversarial closure review
The repository SHALL challenge every closure claim before a terminal verdict,
and the verdict SHALL be accompanied by a definitive ledger with disposition
totals.

#### Scenario: Hidden blocker found
- **WHEN** the adversarial pass finds a repository-owned Critical/High/Medium
  gap
- **THEN** the verdict is conditional or blocked until it is resolved or
  honestly classified

#### Scenario: Clean closure
- **WHEN** no hidden repository-owned blocker remains
- **THEN** the ledger records zero open product defects of Critical/High/
  Medium severity and the terminal verdict
