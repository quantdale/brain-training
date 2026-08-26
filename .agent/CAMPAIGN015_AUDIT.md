# Campaign 015 Planning Audit — Governance & Depth Convergence

**Audited baseline:** `c8acadceb46ad6ba3f90b0c4222583a9a2912f49`  
**Audit date:** 2026-08-26  
**Status:** planning evidence only; Campaign 014 remains the sole ACTIVE campaign.  
**Proposed next change:** `015-governance-depth-convergence`

## Audit method

This planning audit cross-checked the current tracked repository tree, active
campaign/state documents, OpenSpec lifecycle, CI workflows, repository
validators, task-ownership machinery, app package/configuration, the 42-game
catalog structure, persistence/workout/sync/data-portability surfaces, current
Campaign 014 audit/known issues, and source for the remaining high-value game
and content defects.

The audit deliberately distinguishes:

- **confirmed current defect** — directly observable in current source/state;
- **known remaining debt** — explicitly carried by current durable state and
  re-verified where practical;
- **validation gap** — implementation may be correct, but the required evidence
  is missing or a gate can return a misleading green;
- **historical finding** — useful context but not automatically assumed current.

Code and current repository state outrank older campaign prose.

## Executive verdict

Do **not** start another breadth campaign. Brain Training already has 42 game
modules and broad persistence, progression, workout, portability, QA, and CI
coverage. The highest-value next move is a convergence campaign with two goals:

1. make campaign/OpenSpec/parallel-ownership state mechanically trustworthy, so
   a green repository gate actually proves the active plan is coherent; and
2. finish the small number of high-confidence depth/replayability defects left
   by Campaign 014, with measured runtime evidence instead of more feature count.

Campaign 015 MUST remain PROPOSED until Campaign 014 satisfies its Android
journey and documentation/terminal-checkpoint exit requirements.

## Confirmed P0 — campaign governance can false-green

### P0.1 Active Campaign 014 has no matching OpenSpec change

`.agent/GOVERNANCE.json` names `014-experience-depth-replayability`, while
`openspec/changes/` contains only the older `006r-core-integrity-correction`.

`scripts/validate-repo-state.mjs` checks the active OpenSpec package only when
that directory already exists. If it does not exist, the validator hard-fails
only for the one-off `006r-core-integrity-correction` identifier. Therefore a
newer active campaign can bypass the repository's own "spec-driven campaign
integrity" gate.

**Required correction:** every non-null active campaign MUST have one matching
OpenSpec change directory and complete execution surface. Remove campaign-ID
special casing.

### P0.2 Task-ownership CI validates a historical campaign

`.agent/task-ownership.json` still declares
`change: "006r-core-integrity-correction"` and historical `src/...` surfaces,
while the current app source lives under `apps/mobile/src/...` and governance
names Campaign 014.

The ownership validator proves only that the JSON it was handed is internally
non-overlapping; it does not prove that the file belongs to the active campaign.

**Required correction:** bind ownership metadata to the active OpenSpec change,
reject stale campaign IDs, and validate protected/generated **intersections**
rather than only direct pattern matches.

### P0.3 Durable state is internally contradictory

The header of `.agent/STATE.md` says Campaign 014 is active, but later sections
still say Campaign 013 is the authoritative active change and the next action is
to close Campaign 013.

This is dangerous specifically because fresh agents are required to recover
from these durable files after context loss.

**Required correction:** add semantic state reconciliation checks across
GOVERNANCE, CURRENT_CAMPAIGN, STATE, EXECUTION_PROMPT, OpenSpec metadata, and
ownership metadata. Presence of an ID somewhere in a document is insufficient.

### P0.4 Affected-area planning is only partially enforced

`scripts/validate-affected.mjs` is useful and already machine-readable, but it
only prints required checks. CI does not prove that an active campaign's changed
surfaces have corresponding risk-based checks, and many modern subsystems
(workout, mastery, personalization, spotlight, sync, data-portability, content,
assistant/entitlements) fall outside explicit area rules and are merely
"unmatched" under strict mode.

**Required correction:** extend area coverage for current architecture and make
campaign task packets declare the risk checks they owe. Do not turn every
change into a full hardening run.

## Confirmed P1 — repository hygiene/state drift

### P1.1 Two accidental zero-byte files are tracked at repository root

Current root contains:

- `'`
- `i.startsWith('home')`

Both are zero-byte shell/editor residue.

**Required correction:** remove both and add a narrowly-scoped root hygiene
validator that catches suspicious empty/unrecognized root artifacts without
forbidding legitimate empty fixtures elsewhere in the repository.

### P1.2 Campaign 014 documentation is not yet reconciled

`README.md` and `.agent/BACKLOG.md` still describe Workout V2 while Campaign 014
durable progress says Workout V3 has landed. This aligns with Campaign 014's
explicitly unfinished "docs-final reconciliation sweep".

**Required correction:** this belongs to Campaign 014 closure, not Campaign 015
implementation. Campaign 015 activation must fail until predecessor closure is
durably recorded.

### P1.3 Legacy 006R OpenSpec state needs reconciliation, not blind editing

`006r` metadata says VALIDATED while its task checklist still carries a
GitHub-CI checkbox that was historically UI-observable. Current `main` App CI
and Repository Integrity are green, but historical intent must be resolved
against the intended 006R final SHA before changing archival state.

**Required correction:** one evidence-based legacy reconciliation task; do not
rewrite history or mark a historical SHA green from unrelated current evidence.

## Confirmed P1 — remaining product-depth defects

### P1.4 Logic Rule Grid is still a one-cell Latin-square lookup

Current generator creates a Latin square and blanks exactly one cell. Difficulty
changes grid size, round count, and time budget. The answer is recoverable by
the missing symbol in one row/column; there is no chained inference.

**Required correction:** redesign around solver-proven chained deduction. Hard
and Expert must require multiple dependent inference steps, not merely larger
grids or more independent blanks.

### P1.5 Language Word Chain content is still starved

Current pack declares `chainCount: 30`, with only six t1 chains and six t2
chains.

**Required correction:** at least 90 curated, mechanically validated chains with
balanced tier coverage and diversity/near-duplicate guards. Content version
must advance.

### P1.6 Language Context Fit is still 60 items total, not 60 per tier

Current pack declares `itemCount: 60` total.

**Required correction:** at least 60 validated items per tier (>=180 total),
with a single defensible best answer, non-trivial distractors, and no obvious
grammar/part-of-speech leakage. Register/provenance-check the pack and advance
content version.

### P1.7 Spatial Transform Match still has invariant-risk fallbacks

The current generator states strong non-symmetry and option-count invariants,
but its bounded fallbacks can accept a source after generation attempts are
exhausted, single-transform mode bypasses symmetry rejection, and the random
distractor loop can stop before the requested option count is reached.

Campaign 014 also records a hidden-source semantic ambiguity when multiple
displayed options are exact transform outcomes of the source.

**Required correction:** make the final return boundary validate all invariants,
regenerate/fail deterministically rather than return a weakened candidate,
guarantee the requested option count for production parameter space, and make
hidden-source option semantics unambiguous. Advance generator version and add
many-seed/all-production-profile property sweeps.

## P2 — runtime evidence gaps

Campaign 014 explicitly did not rerun opt-in timing probes. Its dedicated AVD
also went offline before required Workout V3/canary device journeys completed.

The code already has statement-count guards and substantial deterministic tests;
there is no justification for a generic optimization rewrite.

**Required correction:**

- Campaign 014 must finish its required Android closure first.
- Campaign 015 reruns opt-in performance probes after its own changes and records
  before/after baselines for affected hot paths.
- Add representative input-to-feedback timing/observability for changed timed
  games only where the existing harness can measure it reliably.
- Never claim a latency or performance improvement without a recorded probe.

## P2 — targeted accessibility verification

Campaign 014 strengthened shared accessibility primitives and some game-specific
labels. Campaign 015 should re-audit only changed surfaces, especially the
reworked Rule Grid and Transform Match interactions, plus any visual-only
mental-rotation path still lacking equivalent semantics.

Do not launch an unrelated catalog-wide accessibility redesign. Device-only or
manual evidence remains NOT VALIDATED when the environment cannot provide it.

## Surfaces judged structurally strong / not rewrite targets

The audit found broad regression coverage around:

- SQLite migrations, invariants, economy, sessions, ratings, and workout state;
- data portability checksum/deserialize/apply/rollback/legacy/large-backup paths;
- deterministic workout V3 and repeated-use simulations;
- registry/provenance/offline validators;
- Android emulator-local QA harness and self-test;
- CI typecheck/lint/Jest/web export/Expo Doctor;
- 42 self-contained game module directories under the shared SDK.

These systems may be touched when a Campaign 015 requirement demands it, but
they are not candidates for speculative rewrites.

## Campaign 015 priority order

1. **Activation/predecessor gate** — finish Campaign 014 honestly; then activate
   015 atomically.
2. **Governance truthfulness** — OpenSpec-active binding, ownership binding,
   durable-state consistency, root hygiene, affected-area coverage.
3. **Game/content convergence** — Rule Grid chained deduction; Word Chain and
   Context Fit pool expansion; Transform Match invariant/ambiguity repair.
4. **Measured runtime/a11y evidence** — targeted probes and changed-surface
   accessibility checks.
5. **Convergence** — full repository gates, targeted Android journeys, CI green,
   durable state synchronized, no unresolved Critical/High regression.

## Non-goals

- no game #43;
- no cloud/auth/social/leaderboards/AI/ads/payments/store work;
- no full hardening campaign unless the owner explicitly starts one;
- no architecture rewrite for its own sake;
- no dependency churn solely to reduce audit counts;
- no broad visual redesign;
- no fake PASS for unavailable Android/iOS/manual evidence.

## Execution pointer

The executable proposed change is:

`openspec/changes/015-governance-depth-convergence/EXECUTION.md`

The short agent handoff is:

`.agent/CAMPAIGN015_PROMPT.md`
