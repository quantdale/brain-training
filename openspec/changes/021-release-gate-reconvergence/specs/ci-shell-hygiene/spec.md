# CI Shell Hygiene — Delta Spec

## ADDED Requirements

### Requirement: Workflow shell steps cannot mask real failures

Committed GitHub Actions workflows MUST NOT contain shell constructs that turn
a successful tool into a failed step, or a failed tool into a successful step.
Specifically prohibited: an unbounded `yes` producer feeding a pipeline
(whose SIGPIPE status is reported under the runner's `pipefail` semantics),
`|| true` exit masking, and a redundant standalone `sdkmanager --licenses`
invocation when the setup action already accepts licenses.

#### Scenario: Broken-pipe producer is committed

- GIVEN a workflow run block contains a `yes |` pipeline
- WHEN the workflow validator runs
- THEN it fails and names the offending file and line.

#### Scenario: Exit masking is committed

- GIVEN a workflow run block masks a command with `|| true`
- WHEN the workflow validator runs
- THEN it fails and names the offending file and line.

#### Scenario: Clean workflows

- GIVEN every committed workflow is free of the prohibited constructs
- WHEN the workflow validator runs
- THEN it reports success.

### Requirement: The hygiene guard is self-testing

The workflow validator MUST provide a self-test that proves both detection and
non-detection on fixtures, and MUST run as a Repository Integrity gate.

#### Scenario: Guard regression

- GIVEN the validator stops detecting a prohibited construct
- WHEN the self-test runs
- THEN the self-test fails.
