# Runtime Evidence & Accessibility — Delta Spec

## ADDED Requirements

### Requirement: Performance claims use recorded comparable probes

Campaign 015 MUST record comparable before/after probe evidence for any claimed
performance improvement in affected hot paths.

#### Scenario: Optimization claim has evidence
- GIVEN an implementation is described as faster
- WHEN campaign evidence is reviewed
- THEN it identifies the probe, dataset/workload, runtime context, before
  measurement, after measurement, and result.

### Requirement: Existing opt-in probes are rerun at convergence

The campaign MUST rerun relevant opt-in timing probes after its implementation
waves and record fresh baselines or an honest NOT VALIDATED reason.

#### Scenario: Probe unavailable
- GIVEN a required probe cannot execute in the environment
- WHEN campaign validation is recorded
- THEN the result is NOT VALIDATED/BLOCKED rather than inferred from statement
  counts or unit-test success.

### Requirement: Statement-count and wall-clock evidence are not conflated

Database statement-count guards MAY prove bounded query shape but MUST NOT be
presented as wall-clock or interaction-latency measurements.

#### Scenario: Statement count stays green
- GIVEN a hot-path statement-count test passes
- BUT no timing probe was run
- WHEN validation is summarized
- THEN the campaign may claim bounded query count but not a measured latency
  improvement.

### Requirement: Changed timed-game interactions have observable feedback

For changed timed/latency-sensitive games, the interaction path MUST expose
enough deterministic instrumentation or harness evidence to verify that valid
input produces timely state/feedback without relying on arbitrary sleeps.

#### Scenario: Timed game canary
- GIVEN a changed timed game on the dedicated Android AVD
- WHEN the QA harness performs a deterministic valid action
- THEN it can observe the expected state/feedback transition and record
  diagnostics on failure.

### Requirement: Changed puzzle surfaces preserve accessible semantics

Changed Rule Grid and Transform Match interactive cells/options MUST expose
stable semantic labels/roles/state sufficient for non-visual navigation without
revealing the answer.

#### Scenario: Accessible cell semantics
- GIVEN a changed puzzle screen
- WHEN accessibility semantics are inspected
- THEN actionable cells/options have stable labels/roles/state and decorative
  elements are not misleadingly focusable.

### Requirement: Accessibility evidence is platform-honest

Static/unit semantics, Android device evidence, manual system-sheet evidence,
and iOS build/device evidence MUST be reported separately.

#### Scenario: Windows host cannot validate iOS
- GIVEN no macOS/Xcode environment is available
- WHEN final validation is written
- THEN iOS remains NOT VALIDATED rather than being inferred from TypeScript or
  Android success.
