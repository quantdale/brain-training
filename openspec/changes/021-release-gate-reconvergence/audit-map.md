# Audit Map — Campaign 021

| ID | Severity | Area | Required action |
|---|---|---|---|
| R-01 | High | Android release gate red at head | Root-cause `yes \| sdkmanager --licenses` SIGPIPE/pipefail failure; fix without weakening the gate. |
| R-02 | High | Exit-status masking class | Static workflow validator + self-test; Repository Integrity gate. |
| R-03 | High | Declared-vs-executable status contradiction | Reconcile durable terminal/VALIDATED claims with current-head CI evidence. |
| R-04 | Medium | Full-matrix staleness at head | Re-run the authoritative local gate matrix on the final candidate SHA. |
| R-05 | Medium | Runtime non-regression | Dedicated AVD canaries or honest NOT VALIDATED. |
| R-06 | Medium | Whole-codebase release-readiness audit | Targeted audit of shell/env/native/persistence assumptions; fix real defects. |

## Evidence separation

Green local checks cannot substitute for observed current-head workflow
results, and CI build evidence cannot substitute for Android runtime or manual
platform evidence.
