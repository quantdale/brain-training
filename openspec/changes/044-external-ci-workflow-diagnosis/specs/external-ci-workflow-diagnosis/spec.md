# External CI / workflow diagnosis

## ADDED Requirements

### Requirement: External CI failures are classified from current evidence

The campaign MUST inspect current run, job, step, runner, and annotation data
before changing repository workflow configuration.

#### Scenario: A job fails before a runner starts

- **WHEN** the job has no steps, no runner assignment, and provider annotations
  identify account, policy, or billing state
- **THEN** the campaign MUST classify the failure as external and MUST NOT edit
  workflows merely to make the status appear green.

### Requirement: Workflow repairs require repository proof

The campaign MUST make a workflow change only when local source and current
execution evidence demonstrate a repository-side defect.

#### Scenario: No repository-side defect is demonstrated

- **WHEN** workflow syntax and local repository checks remain valid
- **THEN** the campaign MUST preserve workflow configuration and document the
  external blocker.
