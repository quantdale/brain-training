# QA Harness Reliability — Delta Spec

## ADDED Requirements

### Requirement: Q1 Deep-link arrival is verified and retried

The autobot MUST verify that a game deep link actually changed the route; a
dropped intent (still Home or unknown route) MUST be retried within the
existing screen budget, with every attempt traced and disclosed. Loading
fallbacks MUST be waited out, not treated as failures.

#### Scenario: Dropped intent under a cold bundle

- GIVEN the app warm on Home but the target chunk still building
- WHEN the deep-link intent is dropped and the route stays Home
- THEN the harness re-issues the link (cold-start escalation if delivered but
  ignored), reaches the target within budget, and records the retry in the
  trace.

#### Scenario: Budget exhausted

- GIVEN repeated dropped intents
- WHEN the screen budget expires with the route never reaching the target
- THEN the failure names the attempt count and the last observed route.

### Requirement: Q2 Pause dismissal is verified on every branch

A pause/resume attempt MUST set resumed only after the overlay has been
observed gone; a missed tap MUST be retried or reported as not resumed.

#### Scenario: Missed patient retry tap

- GIVEN the pause overlay still present after the patient retry tap
- WHEN verification re-dumps the hierarchy
- THEN the harness does not mark the session resumed without overlay-gone
  evidence.

### Requirement: Q3 Canary and certify modes pre-warm routes automatically

Before a canary/certify run, planned game routes MUST be pre-warmed
best-effort, skippable via `QA_PREWARM=0`, and recorded in the run metadata
as non-certification work.

#### Scenario: Default pre-warm

- GIVEN a canary run with pre-warm enabled
- WHEN the run starts
- THEN planned game chunks are warmed before the timed loop and the warm
  block is recorded in `run.json` without affecting pass/fail counts.

### Requirement: Q4 QA artifacts have bounded retention

Harness run directories MUST be pruned under explicit safety guards: only
harness-owned run-id directories, only when a complete `run.json` exists,
never the current run, never curated evidence directories; `QA_KEEP_RUNS`
(default 10) and `QA_NO_PRUNE` control behavior; deletions are logged.

#### Scenario: Old runs pruned

- GIVEN more than `QA_KEEP_RUNS` completed harness run directories
- WHEN a new run initializes
- THEN the oldest excess run directories are removed and the curated evidence
  directories are untouched.

### Requirement: Q5 Navigation helpers have offline self-tests

The pure route-classification and `am start` parsing helpers MUST be covered
by the offline harness self-test that CI runs.

#### Scenario: Self-test covers helpers

- GIVEN `autobot.mjs --self-test`
- WHEN it runs in CI
- THEN route states and delivery parsing are asserted for target, loading,
  home, other-game, unknown, started, and delivered-warning fixtures.
