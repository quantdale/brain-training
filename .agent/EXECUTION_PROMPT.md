# Execution Prompt — Campaign 027: Deep Hardening

**Status:** ACTIVE
**Change:** `027-deep-hardening`
**Planned-From:** `832971c`
**Planned-At:** 2026-09-13
**Target-Branch:** `main`
**Predecessor:** `026-visual-identity-rebuild` (VALIDATED)

## Mission

Execute the owner's Master Autonomous Overnight Development Campaign as a
deep repository-wide hardening pass: repair the audited correctness defects,
make the unbounded hot paths bounded and observable, close the highest-value
reliability test gaps, harden CI/tooling, make the documentation true, and
remove dead weight — leaving verified progress, an evidence-backed state, and
a precise continuation path. Feature development is frozen (user-invoked
hardening).

## Why this is the right next campaign

Campaign 026 closed with a green matrix and a transformed UI, but the
2026-09-13 forensic audit (`openspec/changes/027-deep-hardening/audit-map.md`)
found real defects and debt that compound with history size: one adaptive
difficulty defect, a lingering stimulus, dead reducer actions, a non-finite
metric, unbounded full-history scans on hot paths, ungated bootstrap work,
weak fail-path coverage, tooling blind spots, stale docs, and dead exports.
None is a P0; together they are the highest-value work the repository has.

## Repository findings that shape the plan

- The full matrix is green at `832971c` (536 suites / 6412 tests), so repairs
  start from a clean, verifiable baseline with strong guards (statement-count,
  contrast, provenance, a11y contracts).
- Versioned game logic requires provenance version bumps and registry
  regeneration — those are orchestrator convergence edits.
- The perf channel is dev-only and no-ops in release; instrumentation is safe.
- Deferred/externally blocked evidence classes (store signing, manual
  TalkBack, SAF sheets, physical device, iOS runtime) remain out of scope and
  must stay honestly classified.

## Scope

In: `correctness-repairs`, `performance-startup`, `reliability-tests`,
`tooling-ci`, `docs-truth`, `cleanup-dead-code` (specs in this packet).
Out: features, redesign, new dependencies, constitution-deferred systems,
dependency-major upgrades, external evidence classes, history rewrite.

## Ordered workstreams

1. **W1 correctness repairs** (game defects + sibling scan).
2. **W3 reliability tests** (fail paths, missing screen test) — started before
   the performance redesign so the new tests also guard it.
3. **W2 performance/startup** (bounds, version gates, instrumentation, export).
4. **W4 tooling/CI** (validator rules, dependency gate, pins).
5. **W5 docs truth**.
6. **W6 cleanup**.
7. **W7 verification, adversarial review, closure.**

## Implementation constraints

- No gameplay/scoring change beyond the explicit repairs; no persistence
  format change; every existing testID survives.
- Bounds/version gates must be fail-closed and documented; numbers pinned by
  the progression/analytics suites must not change.
- CI gates must fail closed, never mask, and self-test their detection.
- Comments explain invariants, not obvious code.

## Test requirements

Every repair ships a test that fails on the old behavior. New route tests
inject the failure (no trivial assertions). The full matrix plus lint,
validators and runtime canaries/workout must pass at the closure head.

## Acceptance criteria and completion gate

- All in-scope tasks in `tasks.md` complete or explicitly deferred with
  evidence.
- Full Jest matrix, `tsc --noEmit`, `expo lint`, all validators, OpenSpec
  validation green at the closure tree.
- No introduced Critical/High regression; canaries 8/8 and daily-workout
  journey PASS on the campaign head (or honest environment BLOCKED).
- `docs/` and `.agent/` describe reality; KNOWN_ISSUES holds only true items.

## Git requirements

Commit per coherent workstream; push `main`; keep it buildable/startable; no
force-push; remove temporary branches/worktrees; never commit secrets or
generated garbage.
