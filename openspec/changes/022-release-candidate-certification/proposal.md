# Proposal — Campaign 022 Release-Candidate Certification

## Decision

Campaign 021 closed the repository-owned automation story: the full local
matrix and all four workflows are green at `76a58dc`. What remains between
this repository and a defensible release candidate is not more automation
breadth but real-runtime certification, release-artifact validation, honest
platform-evidence classification, and disposition of tracked release-relevant
debt. This campaign produces and certifies the strongest release candidate
currently possible from this machine, and ends in an evidence-backed
GO / CONDITIONAL GO / NO-GO verdict.

## Starting evidence

- Head `76a58dccf819c57364d5531c2ca4c2bc3c375e46` == `origin/main`, clean
  tree, no worktrees, single branch.
- All four workflows green at head: App CI `33944241059`, Repository
  Integrity `33944241055`, Android Build Smoke `33944241051`, iOS Build
  Smoke `33944241057`.
- `validate-repo-state` PASS at activation time.
- Tracked open debt (KNOWN_ISSUES): `xp_awards` idempotency (Medium), offline
  validator heuristic gap (Low), seeding mock seam (Low), provenance-allowlist
  dead entries (Low), QA artifact retention (Low).

## In scope

Debt triage with adversarial proof (priority: `xp_awards` idempotency); clean
Android release artifact build + inspection; standalone release-artifact
runtime on the dedicated AVD; broad game certification via the autobot
certify mode; Workout V3 runtime certification; lifecycle/process-death
torture testing; real-SQLite soak; backup/restore certification; accessibility
inspection; SAF/system-sheet classification; physical-device evidence if
hardware exists; performance soak; offline proof; security/privacy data-boundary
review; iOS evidence to the limit of host capability; full final regression
matrix and current-head CI at the final SHA; durable release-readiness matrix.

## Out of scope

Game #43+, new gameplay systems, cloud sync, accounts/auth, remote backend,
social, ads/monetization, AI, push notifications, telemetry expansion, visual
redesign, architecture/database/framework replacement, dependency upgrades
unrelated to certification, speculative cleanups.

## Completion definition

022 is complete when the release artifact is built, inspected, and proven
standalone; broad runtime certification (games, Workout V3, lifecycle, DB,
backup/restore, offline) has executed evidence; every platform-evidence area
carries an honest PASS / FAIL / NOT VALIDATED / DEFERRED / EXTERNALLY-BLOCKED
classification; the full automated matrix and all four workflows are green at
the exact final SHA; durable state reflects evidence; and the release verdict
is issued with its justification.
