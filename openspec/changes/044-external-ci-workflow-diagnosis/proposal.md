# Campaign 044 — External CI / Workflow Infrastructure Diagnosis

## Problem

Current GitHub Actions runs for Repository Integrity, App CI, Android Build
Smoke, and iOS Build Smoke fail before repository steps execute. The cause
must be classified from current API evidence without assuming a repository
defect or masking the failure.

## Outcome

Inspect current runs, jobs, step arrays, annotations, workflow SHAs, runner
labels, and repository workflow syntax; classify the failure; repair only a
demonstrated repository-side defect; and leave an evidence-backed handoff for
the remaining overnight campaigns.

## Non-goals

Do not disable jobs, weaken required checks, swallow failures, change billing or
account settings, or modernize unrelated workflow configuration.
