# Dependency Gate Integrity

## Purpose

Define how this repository enforces dependency alignment and security advisories
hermetically on every push, how an advisory disposition is evidenced rather than
asserted, how recorded gate results stay tied to the commit that produced them,
and how governance status is kept internally consistent.

## ADDED Requirements

### Requirement: The push-triggered build depends only on repository contents

No step of a build that runs on every push to the canonical branch or on every
pull request SHALL depend on a remote manifest, registry, or service whose
content can change without a repository change. A failure of such a step SHALL
NOT be able to mark the build failed.

Steps that inherently require the network — resolving latest upstream versions,
running an advisory audit against a live registry — SHALL run only on a scheduled
or manually dispatched job, and their outcome SHALL be classified explicitly so
that an environment or upstream condition is never reported as a product defect
or silently as success.

#### Scenario: Unchanged repository, unavailable network

- **GIVEN** the repository is unchanged and the network is unavailable
- **WHEN** the push-triggered build runs
- **THEN** every step in that build reaches the same result it would reach with
  network access
- **AND** no step's outcome is derived from a remote manifest

#### Scenario: Upstream publishes a new patch release

- **GIVEN** every declared dependency pin is internally consistent with the
  installed SDK
- **WHEN** an upstream package publishes a new patch release
- **THEN** the push-triggered build result is unchanged
- **AND** the scheduled drift job reports the newly available version as an
  upstream observation

#### Scenario: A network-dependent gate cannot run

- **GIVEN** a scheduled job whose gate requires network access and that network
  access is unavailable
- **WHEN** the job reports its outcome
- **THEN** the outcome is classified as "could not be determined"
- **AND** it is not reported as either a pass or a product failure

### Requirement: Declared Expo-family pins match the installed SDK's own manifest

The repository SHALL provide an executable check comparing every declared
Expo-family dependency against the version range required by the **installed**
Expo SDK's bundled native-module manifest, and SHALL fail when a declared pin
does not satisfy that range. The check SHALL NOT require network access, and it
SHALL validate its own detection behavior before its result is trusted.

#### Scenario: A declared pin is below the installed SDK's requirement

- **GIVEN** a declared Expo-family pin that is below the range required by the
  installed SDK's bundled manifest
- **WHEN** the hermetic alignment check runs
- **THEN** it fails and names the package, the required range, and the declared
  range

#### Scenario: Every declared pin is aligned

- **GIVEN** every declared Expo-family pin satisfies the installed SDK's bundled
  manifest
- **WHEN** the hermetic alignment check runs
- **THEN** it passes without requiring network access

#### Scenario: The check cannot read its input

- **GIVEN** the installed SDK's bundled manifest is missing or unparseable
- **WHEN** the hermetic alignment check runs
- **THEN** it fails closed rather than reporting success

#### Scenario: Detector self-test

- **GIVEN** the alignment check's self-test mode with an injected mismatch
- **WHEN** it runs
- **THEN** it reports the injected mismatch
- **AND** the self-test fails if the detector cannot detect the injected fault

### Requirement: An advisory disposition is evidenced, not asserted

A production-dependency advisory SHALL block the gate unless it is dispositioned
by an explicit entry that names the package and the specific advisory, states
the classification, and records the evidence for that classification — in
particular, whether any first-party runtime import path reaches the vulnerable
code.

An entry SHALL waive only the specific advisory it names. A different advisory
affecting the same package SHALL fail the gate. Entries classified as accepted
runtime debt SHALL additionally carry a rationale, an expiry, and a tracked
follow-up; entries classified as build or test toolchain SHALL be accepted only
while the vulnerable code provably never ships.

#### Scenario: A known toolchain-only advisory is disclosed

- **GIVEN** an advisory reachable only through build or test tooling, with no
  first-party runtime import path reaching it
- **WHEN** the advisory is dispositioned
- **THEN** the entry records the classification, the reachability evidence, and a
  tracking location
- **AND** the gate passes for that advisory

#### Scenario: A new advisory on an already-dispositioned package

- **GIVEN** a package that has a disposition entry for one advisory
- **WHEN** a different advisory affects that same package
- **THEN** the gate fails
- **AND** the failure is not suppressed by the existing entry

#### Scenario: Runtime-reachable advisory

- **GIVEN** an advisory reachable from a first-party runtime import path
- **WHEN** it is dispositioned
- **THEN** the entry records a rationale, an expiry, and a tracked follow-up
- **AND** the disposition does not become permanent by default

### Requirement: Recorded gate results state the commit and date they were observed at

Any durable record of a gate result — validation log, state summary, dependency
audit record, hardening closure, or campaign evidence — SHALL state the commit
and the date at which the result was observed, and SHALL NOT assert an
unqualified passing result for a gate that is not passing at the current commit.

When a recorded result is later found not to hold, the record SHALL be amended
to state the observed condition together with the commit and date, rather than
left in place or silently rewritten.

#### Scenario: A gate regresses after being recorded green

- **GIVEN** a durable record asserting a gate passed
- **WHEN** that gate is observed to fail at the current commit
- **THEN** the record is amended to state the observed failure, the commit, and
  the date
- **AND** the historical claim remains attributable to the commit at which it
  was true

#### Scenario: Reading a gate claim

- **GIVEN** a reader inspecting a recorded gate result
- **WHEN** they read it
- **THEN** they can determine the commit and the date the result belongs to

### Requirement: Governance status is internally consistent

A repository's declared execution status SHALL agree across every durable
record: the control-plane configuration, the current-campaign record, the state
summary, and the terminal evidence for the most recent phase. When a phase has
completed, no durable record SHALL present it as in progress.

The primary implementation plan document SHALL state the repository's current
campaign position, and its campaign index SHALL cover the most recent changes.

#### Scenario: A phase completes

- **GIVEN** a phase has completed and its terminal evidence is recorded
- **WHEN** a reader consults any durable record of the current status
- **THEN** every record presents the phase as completed
- **AND** no record simultaneously presents the same phase as active

#### Scenario: Locating the current state

- **GIVEN** a reader opening the primary implementation plan document
- **WHEN** they read its current-state section
- **THEN** it identifies the current position without claiming that work is in
  progress that has already closed
- **AND** the change index it references includes the most recent changes

### Requirement: Local agent tooling does not pollute the working tree

Directory trees created by locally installed assistant tooling SHALL be ignored
by version control, so working-tree status remains a meaningful signal of
repository-relevant change and machine-specific tool state cannot be committed.

#### Scenario: Local tooling directories present

- **GIVEN** assistant-configuration directories exist in the working tree
- **WHEN** repository status is inspected
- **THEN** they are not reported as untracked additions
- **AND** no file inside them is added by an ordinary commit

#### Scenario: Repository-relevant change

- **GIVEN** a change to a tracked repository file
- **WHEN** repository status is inspected
- **THEN** that change is reported normally
