# Integrated Release Candidate Certification

## ADDED Requirements

### Requirement: Certification must be current-state and evidence-backed

The final candidate MUST be evaluated from the current product lineage with
authoritative local gates, protected-flow evidence, and exact Git provenance.
Inherited evidence MAY satisfy an unchanged surface only when its source SHA
and boundary are recorded explicitly.

#### Scenario: Current integrated candidate

- **WHEN** Campaign 050 closes
- **THEN** the closure MUST identify the current product SHA, the checks
  actually run, the inherited evidence used, and any NOT VALIDATED or BLOCKED
  boundary without converting it to PASS.

### Requirement: Release certification protects core offline and durable flows

The candidate MUST build and start as a release artifact without Metro and MUST
retain the protected workout, game-result, SQLite persistence, backup/import,
offline, and recoverable-route contracts.

#### Scenario: Metro-independent release smoke

- **WHEN** the release APK is installed on the dedicated Android emulator
- **THEN** it MUST launch, render the core surfaces, survive force-stop/relaunch,
  and show no unresolved app fatal, ANR, SQLite-lock, or data-integrity signal.

### Requirement: Final verdict must separate technical and unavailable lanes

The certification verdict MUST distinguish executable Android/repository
evidence from human usability, physical/OEM, iOS/VoiceOver, store signing,
system-provider usability, and account/policy-blocked CI evidence.

#### Scenario: Conditional external boundaries

- **WHEN** local technical gates pass while one or more external lanes remain
  unavailable or policy-blocked
- **THEN** the final result MUST be `CAMPAIGN_050_RELEASE_CONDITIONAL` or
  another truthful non-green label, and MUST list the exact handoff items.
