# Audit Map — Campaign 021

| ID | Severity | Area | Required action |
|---|---|---|---|
| R-01 | High | Android release gate red at head | Root-cause `yes \| sdkmanager --licenses` SIGPIPE/pipefail failure; fix without weakening the gate. |
| R-02 | High | Exit-status masking class | Static workflow validator + self-test; Repository Integrity gate. |
| R-03 | High | Declared-vs-executable status contradiction | Reconcile durable terminal/VALIDATED claims with current-head CI evidence. |
| R-04 | Medium | Full-matrix staleness at head | Re-run the authoritative local gate matrix on the final candidate SHA. |
| R-05 | Medium | Runtime non-regression | Dedicated AVD canaries or honest NOT VALIDATED. |
| R-06 | Medium | Whole-codebase release-readiness audit | Targeted audit of shell/env/native/persistence assumptions; fix real defects. |

## Dispositions (2026-09-05, candidate `4734fa0`)

- **R-01 CLOSED** — `1a946a9`: redundant license pass removed; pinned install
  stays fail-closed with a `--list_installed` postcondition. Android Build
  Smoke green at `695f236` (run `33935472497`) end-to-end through Gradle
  assembly, APK boundaries, SHA-256, artifact upload.
- **R-02 CLOSED** — `scripts/validate-workflows.mjs` + `--self-test` (16
  assertions) wired into Repository Integrity; green at `4734fa0`
  (`33936169975`).
- **R-03 IN PROGRESS** — durable state rewritten to ACTIVE-campaign wording;
  terminal form only after 3.3 completes.
- **R-04 CLOSED** — full matrix + clean-checkout certification PASS at
  `4734fa0` (see VALIDATION final candidate wave).
- **R-05 CLOSED** — dedicated `braintraining-qa36`: guard self-heal proven on
  the live DB; `math-fast-math`, `speed-tap-rush`, `attention-odd-one-out`
  canaries PASS on the patched build.
- **R-06 CLOSED** — findings F1 (trigger crash-window; fixed + 4 regression
  tests) and F2 (write-path integer canonicalization; audited already
  fail-closed, no change). No other repository-owned defects found.

## Evidence separation

Green local checks cannot substitute for observed current-head workflow
results, and CI build evidence cannot substitute for Android runtime or manual
platform evidence.
