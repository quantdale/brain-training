# External GitHub Actions Classification

## Current runs

The current pushed product SHA was `4c0e5f819bbc1d7fd83f9ac979e19406c50753a9`. GitHub was queried with `gh` after authentication was checked. All four workflow runs completed with failure before any job step executed:

| Workflow | Run | Result | Job/steps evidence |
|---|---:|---|---|
| iOS Build Smoke | [35313513609](https://github.com/quantdale/brain-training/actions/runs/35313513609) | failure | One job, `completed/failure`, `steps=0`; failed log unavailable. |
| Android Build Smoke | [35313513511](https://github.com/quantdale/brain-training/actions/runs/35313513511) | failure | One job, `completed/failure`, `steps=0`; failed log unavailable. |
| App CI | [35313513495](https://github.com/quantdale/brain-training/actions/runs/35313513495) | failure | One job, `completed/failure`, `steps=0`; failed log unavailable. |
| Repository Integrity | [35313513462](https://github.com/quantdale/brain-training/actions/runs/35313513462) | failure | One job, `completed/failure`, `steps=0`; failed log unavailable. |

`gh run view --log-failed` returned `log not found` for the job IDs. Metadata showed push events at the same SHA; no repository test/build command, annotation, or workflow step output was available. The preceding SHA `56bf17d8b3a857f0ac645330ecbe1fe54fd8c8a1` also had the same four pre-step failures, which makes a transient single-run explanation less likely but still does not expose the provider cause.

## Classification

**`INDETERMINATE_EXTERNAL_PRE_STEP`**

This is not classified as `REPOSITORY_WORKFLOW_DEFECT`: local workflow validation passed, and no workflow step executed to demonstrate a YAML/script defect. It is not promoted to `RUNNER_INFRASTRUCTURE`, `ACCOUNT_OR_POLICY`, or `GITHUB_TRANSIENT` because the available metadata does not distinguish those causes. It is an external pre-step/provider failure with no actionable repository evidence.

Workflow YAML was not edited to hide the red indicator. Local gates, native builds, and direct tests are reported independently.

