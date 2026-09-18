# Campaign 044 — External CI Diagnosis

## Classification

`ACCOUNT_OR_POLICY`

The current GitHub Actions failures are external pre-run account/policy
failures, not demonstrated repository workflow defects.

## Current synchronized head

At head `59bc801bbaa047834f78819370aa7a805acb1783`, the four push runs created
at 2026-09-18T16:11:41Z all completed as failures:

| Workflow | Run | Job | Label | Steps | Runner | Result |
| --- | ---: | --- | --- | ---: | --- | --- |
| App CI | 35366998725 | Mobile app build/typecheck/tests | ubuntu-latest | 0 | runner_id 0 / blank name | failure |
| Android Build Smoke | 35366998695 | Android clean native build | ubuntu-latest | 0 | runner_id 0 / blank name | failure |
| Repository Integrity | 35366998693 | durable-state | ubuntu-latest | 0 | runner_id 0 / blank name | failure |
| iOS Build Smoke | 35366998651 | iOS Simulator compile smoke | macos-latest | 0 | runner_id 0 / blank name | failure |

Each job started and completed within the provider pre-step window, but the
GitHub job API returned an empty `steps` array and no runner assignment. The
check-run annotations for all four runs state:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

The ubuntu annotations also contain a future runner-image migration notice;
that notice is informational and is not the failure cause.

## Repetition and cross-check

The immediately preceding synchronized documentation/source heads show the
same shape: runs at `afeca4d`, `1ca5811`, and `2fdcb95` also fail within seconds
with zero job steps. This repeated pre-run signature is consistent with the
current account/policy annotation and not with a command failure inside this
repository.

## Repository-side checks

- `node scripts/validate-workflows.mjs`: PASS, 4 workflow files scanned.
- `node scripts/validate-repo-state.mjs`: PASS.
- `node scripts/validate-task-ownership.cjs`: PASS.
- OpenSpec validation: 29 passed, 0 failed.
- `git diff --check`: PASS.
- No `.github/workflows/**` file was modified.

The repository has no evidence-based CI repair to apply. Account billing,
spending-limit, runner allocation, and provider policy changes require the
repository owner/GitHub account administrator and are outside this campaign's
authority.
