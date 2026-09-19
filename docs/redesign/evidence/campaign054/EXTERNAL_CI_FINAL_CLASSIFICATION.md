# Campaign 054 — External CI Final Classification

**Status:** `ACCOUNT_OR_POLICY` — refreshed with current run evidence
**Date:** 2026-09-19
**Repository:** `quantdale/brain-training`

## Current runs re-queried (head `9fe9b41ec7a27f3097a3b5d319bcf73c5214dd86`)

All four workflows triggered by the push of the Campaign 054 prompt commit
(2026-09-19T13:03:13Z) failed before any repository command executed:

| Workflow | Run ID | Job | Steps | Runner | Check-run ID |
| --- | ---: | --- | ---: | --- | ---: |
| Repository Integrity | 35444630023 | durable-state | 0 | blank (`runner_id: 0`) | 105901327813 |
| App CI | 35444630100 | Mobile app build/typecheck/tests | 0 | blank | 105901328540 |
| Android Build Smoke | 35444630078 | Android clean native build | 0 | blank | 105901328109 |
| iOS Build Smoke | 35444630111 | iOS Simulator compile smoke | 0 | blank | 105901328152 |

Every job carries the same check-run annotation (fetched via
`GET /repos/quantdale/brain-training/check-runs/{id}/annotations`):

> **The job was not started because recent account payments have failed or your
> spending limit needs to be increased. Please check the 'Billing & plans'
> section in your settings**

The Ubuntu jobs additionally carry an informational notice about the
`ubuntu-latest` → Ubuntu 26 label migration (October 2026). That notice is not
the failure cause.

## History scan

Full `actions/runs` history was scanned via the API (pages through 2026-08 and
earlier; 1,013 runs):

- 332 successes, 614 failures, 67 cancelled (all-time, within the scanned
  window).
- **Most recent success:** `2026-09-05T17:42:45Z`, Android Build Smoke,
  run `33981809666`, SHA `22bf19600dd6ecdd949c0d9615c1d8a43a5542f3`.
- Every run since 2026-09-05 has failed in the pre-step window; the failure
  signature (zero steps, no runner assignment, billing annotation) is uniform.

## Attempted account-level inspection

- `GET /users/quantdale/settings/billing/actions` → HTTP 404 with the current
  token; the endpoint requires the `user` token scope (`gh auth refresh -s user`),
  which is an owner credential action, not a repository action.
- `GET /repos/quantdale/brain-training/actions/permissions` →
  `{"enabled":true,"allowed_actions":"all","sha_pinning_required":false}`.

The provider's own check-run annotation is the authoritative account/policy
evidence; the billing API is not required to establish it.

## Repository-side checks (all PASS)

- `node scripts/validate-repo-state.mjs` — PASS.
- `node scripts/validate-workflows.mjs --self-test` — 44/44.
- `node scripts/validate-workflows.mjs` — PASS (4 workflow files scanned).
- `npx openspec validate --all --strict` — 37/37 at the time of this CI check
  (38/38 after the Campaign 054 change packet landed).
- No `.github/workflows/**` file was modified by this campaign.

## Classification

`ACCOUNT_OR_POLICY` (EXTERNAL_BLOCKER_VERIFIED).

- Not `REPOSITORY_WORKFLOW_DEFECT`: not a single step executed; the runner was
  never assigned; every local equivalent gate passes.
- Not `GITHUB_TRANSIENT`: the signature has persisted for two weeks with an
  explicit, consistent account annotation.
- Not `RUNNER_INFRASTRUCTURE`: the provider states the cause is account
  payments/spending limit.
- Repair requires the repository owner/GitHub account administrator to resolve
  billing or the spending limit. No workflow YAML was changed to mask it.
