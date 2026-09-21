# Spec — terminal-whole-product-certification

## ADDED Requirements

### Requirement: One exact certified artifact

The change SHALL produce exactly one release APK built from the recorded
067 source commit and record SHA-256, byte size, package/version,
signing status, embedded bundle hash, bundle freshness markers, and
Metro independence. No executable source SHALL drift after
certification without a rebuild and re-certification.

#### Scenario: Artifact pinned

- GIVEN a completed release build
- WHEN recorded
- THEN hash, size, package, version, signing, bundle hash, and Metro
  independence are all stated for the exact commit.

### Requirement: Strongest repository matrix on the frozen tree

On the frozen source commit the full Jest matrix with the exact skip
allowlist and console gate, all opt-in probes, typecheck, lint, Expo
Doctor, and every repository validator SHALL run green, and OpenSpec
`--all --strict` SHALL pass with every change 056–067 valid.

#### Scenario: Matrix green

- GIVEN the frozen commit
- WHEN the terminal matrix runs
- THEN suites/tests/skips counts, unexpected-console count, probes, and
  validator totals are recorded exactly with exit codes.

### Requirement: Full native journey on the exact artifact

The artifact SHALL be exercised on the dedicated emulator: clean
install with a bounded first-install watch, warm/offline/force-stop
relaunches, the route and recovery matrix, provider open/cancel
boundaries, representative completion persistence (weak/mid/strong where
reachable, plus workout legs), relaunch retention, SQLite
integrity/FK/schema/duplicate audit, and a filtered log review.

#### Scenario: Journey recorded with honest boundaries

- GIVEN the certified artifact installed
- WHEN the journey runs
- THEN every lane is recorded as PASS / NOT VALIDATED with captures,
  hierarchy, SQLite, and log evidence.

### Requirement: Six-way pixel and accessibility matrix

On the artifact, canonical and interaction surfaces SHALL be captured
across default/compact/font-scale-2 × light/dark, and the accessibility
audit SHALL report zero unlabelled interactive nodes, zero reproducible
decorative-art leaks, and zero unresolved true undersized targets, with
no blocking clipping.

#### Scenario: Six-way matrix complete

- GIVEN the capture harness
- WHEN the matrix runs on the artifact
- THEN all captures are nonblank, route-verified, dialog-free, and the
  a11y audit totals are recorded.

### Requirement: Deferral disposition and defect re-certification

Every deferral recorded by 065/066 SHALL be executed on the artifact or
explicitly accepted with a reason. Any reproduced product defect SHALL be
minimally repaired, covered by a focused test, rebuilt, and re-certified
before terminal status.

#### Scenario: Defect forces re-certification

- GIVEN a reproduced defect on the artifact
- WHEN the repair lands
- THEN a new artifact is built from the repaired commit and the affected
  matrix lanes re-run before certification.

### Requirement: Authoritative terminal ledger

The change SHALL produce one terminal ledger classifying every program
item, with zero unresolved repository-owned Critical/High/Medium
findings, explicit MANUAL/EXTERNAL boundaries, and the post-067
hardening baseline handed off with evidence pointers.

#### Scenario: Terminal ledger complete

- GIVEN all certification evidence
- WHEN the ledger is written
- THEN every item carries a classification and the unresolved
  repository-owned counts are zero.

## MODIFIED Requirements

None.

## REMOVED Requirements

None.
