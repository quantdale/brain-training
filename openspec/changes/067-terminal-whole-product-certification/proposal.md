# Change 067 — Terminal Whole-Product Certification

**Status:** IN_PROGRESS
**Predecessor:** `066-adversarial-convergence-static-governance` (VALIDATED)
**Program SHA:** `428d293`
**Theme:** program closure — certification/convergence only.

## Problem / evidence

Changes 056–066 changed product source after the last certified artifact
(Campaign 063, `20e28c64` from `e627473`). The repository is green and
adversarially converged, but no executable proves the current tree, and
the deferred device lanes (six-way pixel/a11y, gameplay captures,
crafted import/wipe journey, cold deep-link fallback) remain
unproven. The 066 residual census (Pass A/B/C) and precondition
checklist define what 067 must produce; this change is the closure, not
a redesign vehicle.

## Desired invariant / outcome

- Exactly one release artifact built from the recorded 067 source
  commit, with SHA-256, size, package/version, signing status, bundle
  hash + freshness markers, and Metro independence; no source drift
  after certification without rebuild + re-certification.
- The strongest repository matrix on that tree: Jest with the console
  gate and exact skip allowlist, opt-in probes, typecheck, lint, Expo
  Doctor, registry/provenance/offline/secrets/workflow/repo-state/
  task-ownership validators, dependency audit, web export.
- The full native journey on the exact artifact: clean install +
  bounded first-install watch, warm/offline/force-stop relaunches,
  route/recovery matrix, provider lifecycle, representative completion
  paths (weak/mid/strong where reachable), workout legs, relaunch
  retention, SQLite integrity/FK/schema/duplicate audit, filtered log
  review.
- Six-way pixel/a11y matrix (default/compact/font-scale-2 × light/dark)
  with zero unlabelled interactive nodes, zero reproducible decorative
  leaks, zero unresolved true undersized targets, and no blocking
  clipping.
- Every recorded deferral either executed or explicitly accepted with a
  reason; every defect found is repaired and the artifact re-certified.
- One authoritative terminal ledger with per-item classifications and
  zero unresolved repository-owned Critical/High/Medium findings; all
  human/external boundaries listed as MANUAL/EXTERNAL.
- The post-067 hardening baseline is handed off with evidence pointers.

## Non-goals

- No speculative redesign, no new features, no scope harvested from the
  residual census beyond what certification requires.
- No coverage-threshold infrastructure, no v12 semantic migration, no
  backup-encryption work (post-067 hardening decisions).
- No weakening of any gate to make the matrix pass.

## Affected areas

`docs/redesign/evidence/campaign067/` (new evidence root), the artifact
build outputs (outside Git), durable state (`.agent/*`), and product
source only if a real defect is reproduced (minimal fix + re-certify).

## Protected contracts

All 056–066 behaviors, schema v12, scoring/economy, routing,
offline-first, console baseline, and the repository's host-input/
emulator policy (one dedicated AVD, emulator-local input only).

## Implementation plan

1. Strict-validate this change before implementation; freeze the source
   commit.
2. Build the release artifact; record identity + bundle evidence.
3. Full repository matrix + validators + probes on the frozen tree.
4. Native journey + six-way pixel/a11y on the exact artifact.
5. Deferral disposition + defect repair loop (bounded, re-certifying).
6. Terminal ledger, durable state, adversarial closure, commit/push.

## Test plan

The full repository matrix and every validator at their strongest
settings; probes 5/5; device evidence recorded, not asserted as unit
tests.

## Runtime/native evidence plan

This change IS the runtime evidence. Raw captures/logs under
`D:\Temp\campaign067-*`; curated evidence committed under
`docs/redesign/evidence/campaign067/`.

## Rollback / risk notes

- A reproduced defect blocks terminal status until fixed and
  re-certified; unrelated findings are recorded for the hardening phase
  rather than absorbed.
- Emulator/tooling failures are classified as tooling with bounded
  retries, never as product PASS/FAIL.

## Completion criteria

Terminal ledger with zero unresolved repository-owned Critical/High/
Medium items, one certified artifact identity, honest NOT VALIDATED /
MANUAL / EXTERNAL boundaries, adversarial closure, durable state
reconciled, committed and pushed with `HEAD == origin/main`.
