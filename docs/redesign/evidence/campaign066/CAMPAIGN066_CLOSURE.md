# Campaign 066 — closure

**Change:** `066-adversarial-convergence-static-governance`
**Status:** VALIDATED
**Verdict:** `CHANGE_066_COMPLETE`
**Predecessor:** `065-adversarial-convergence-runtime-data-pixel` (VALIDATED)

## What changed

Three independent read-only lanes (static/architecture/contract,
flake/allowlist/debt, governance/state) attacked the 065-closed tree;
every accepted finding was reproduced before disposition
(`CRITIC_FINDINGS.md`). Repairs:

- **Canonical helpers:** `seedToNumber` and `clamp01` were duplicated in
  all 42 game modules; both are now single-sourced in `@/sdk`
  (`canonicalSeedToNumber`, `canonicalClamp01`) with every game
  re-exporting the same public name, plus a contract test pinning the
  exact outputs. 84 game files touched, all game suites green.
- **Static/contract fixes:** `rating/pipeline.ts` now imports types from
  the `@/db/types` leaf (breaks one type-only cycle edge);
  `parseWorkoutMetadata` validates `focus` with `isGameCategory`;
  `mastery-card`/`mastery-insights`/`spotlight-card` read the catalog
  through the validated registry accessors; the content-pack registry no
  longer lies about the pack type (`PackEnvelope`, cast removed).
- **Waiver hygiene:** the two provenance waivers were dead exemptions
  (their edits are in the drift base) carrying a hard-fail expiry — both
  removed, allowlist empty, freshness gate still wired; jest-skip
  waivers now name a live renewal owner; deferred items gained durable
  BACKLOG rows with owners.
- **Governance reconciliation:** 057's OpenSpec count corrected to
  41/41; `STATE.md`/ledger cursors reflect 056–065 validated + 066 in
  progress; baseline residue removed; `KNOWN_ISSUES`/`BACKLOG` titles
  and successor text corrected; `ARCHITECTURE.md` seam status
  reconciled.

## Terminal validation

| Gate | Result |
|---|---|
| Full Jest matrix | **PASS** — 589 suites (585 passed + 4 skipped), 6,900 passed / 5 classified opt-in skips, 5 snapshots, exit 0 (241.6 s) |
| Jest signal | **PASS** — exact-name pinning, floors met, 0 unclassified/ambiguous, 0 unexpected console output |
| Typecheck / lint | **PASS** (both packets ran `tsc --noEmit` and eslint clean on changed files) |
| OpenSpec `--all --strict` | **PASS** (066 package valid; 067 opened at close) |
| repo-state / task-ownership | **PASS** (active program cursor enforced) |
| Validators | offline 30/30 CLEAN; secrets PASS; provenance 13/13 + empty-allowlist OK; affected 16/16; runtime-QA 16/16; dependency-audit 41/41; workflows 44/44 |
| Device | **NOT APPLICABLE** — static/governance-only change; the 065 device evidence stands, and 067 certifies the final artifact |

## Deliverables for the next phase

- `RESIDUAL_CENSUS.md`: Pass A (11 items), Pass B (10 items), Pass C
  (10 items), each with evidence and a verification recipe.
- 067 precondition checklist with current status; the 067 OpenSpec
  package is created at this close.

## Boundaries

No product behavior change beyond the guard/type fixes rolled into the
matrix; the 063 artifact remains the last certified executable until 067
builds and certifies the final one.
