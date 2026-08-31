# Tasks — Campaign 019 Game Lifecycle Resilience

## 1. Shared lifecycle and timing

- [x] 1.1 Audit every catalog screen for async completion and session identity
      guards.
- [x] 1.2 Verify pause/background/resume timing and deadline preservation with
      injected monotonic clocks and no orphan timers.
- [x] 1.3 Harden unsafe session/provenance inputs at runtime boundaries.

## 2. Workout ownership and catalog drift

- [x] 2.1 Verify exact workout instance/leg ownership through persistence,
      relaunch, duplicate delivery, and catalog changes.
- [x] 2.2 Repair non-finite/corrupt resume state deterministically and preserve
      legacy metadata compatibility.
- [x] 2.3 Add a source-level guard preventing future screens from omitting the
      shared callback identity contract.

## 3. Verification and closure

- [x] 3.1 Run focused lifecycle, timer, provenance, workout, and catalog suites.
- [x] 3.2 Run the complete current-head test/static validation matrix.
- [x] 3.3 Record exact PASS/NOT VALIDATED/BLOCKED evidence and close 019 only
      after durable state, OpenSpec, and ownership agree.
