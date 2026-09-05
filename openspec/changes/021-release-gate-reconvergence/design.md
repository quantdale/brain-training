# Design — Campaign 021 Release-Gate Re-convergence

## Gate repair boundary

- The Android release gate stays fail-closed: the pinned `sdkmanager` install
  remains a directly-checked command under the runner's `bash -eo pipefail`,
  and a postcondition enumerates installed packages so a silent partial
  install fails the step.
- License acceptance is owned by `android-actions/setup-android@v3`
  (`accept-android-sdk-licenses: true` by default). A second acceptance in a
  workflow step is redundant and, once licenses are already accepted, the
  `yes` producer deterministically dies of `EPIPE`, which `pipefail` reports
  as a step failure even though `sdkmanager` exited 0.
- No `|| true`, no `continue-on-error`, no step removal beyond the redundant
  license command: the workflow must keep proving the real clean native build.

## Static hygiene guard

`scripts/validate-workflows.mjs` scans committed `.github/workflows/*.yml` for
the failure class and its historical mask:

1. `yes |` producer pipes (deterministic SIGPIPE under runner pipefail once the
   consumer stops reading),
2. `|| true` exit masking in run blocks,
3. redundant standalone `sdkmanager --licenses`.

It ships a `--self-test` with positive/negative fixtures so the guard cannot
silently regress, mirroring the secret-scanner pattern. It runs in Repository
Integrity (no dependency install needed).

## Evidence discipline

Historical evidence stays historical. Current-head claims cite SHA + run id.
A workflow is PASS only when observed completed/success on the final candidate
SHA; queued/running is reported as such. Missing platform evidence stays
NOT VALIDATED.
