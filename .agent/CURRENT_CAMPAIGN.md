# Campaign 022 — Release-Candidate Certification

**Status:** ACTIVE
**Campaign id:** `022-release-candidate-certification`
**Predecessor:** `021-release-gate-reconvergence` (VALIDATED)
**Mode:** day
**Change:** `022-release-candidate-certification` (ACTIVE; `change.json` ACTIVE, `GOVERNANCE.activeCampaign` set, `STATE` and ownership synchronized)
**Authorization:** explicit owner directive on 2026-09-05 after Campaign 021 closed VALIDATED at `05c16bc` with all four workflows green at head `76a58dc`.
**Baseline SHA:** `76a58dccf819c57364d5531c2ca4c2bc3c375e46`

## Mission

Produce and certify the strongest release candidate currently possible from
this machine: disposition release-relevant tracked debt with adversarial
proof; build, inspect, and standalone-run a clean Android release artifact;
execute broad real-runtime certification (registry-wide games, Workout V3,
lifecycle/process death, real SQLite, backup/restore, offline, accessibility,
SAF, physical device, performance); classify every platform-evidence domain
honestly (PASS / FAIL / NOT VALIDATED / DEFERRED / EXTERNALLY BLOCKED);
re-prove the full automated matrix and all four workflows at the exact final
SHA; and issue an evidence-backed GO / CONDITIONAL GO / NO-GO verdict.

## Scope guard

No game #43+, new gameplay systems, cloud/auth/backend/social/ads/monetization/
AI/push/telemetry, visual redesign, architecture/database/framework replacement,
unrelated dependency upgrades, or speculative cleanups. Validators, tests, and
gates may be strengthened, never weakened.

## Stop conditions

Stop for a user decision only on a proven external blocker (credentials,
absent platform hardware, irreversible publication). Never convert
unavailable evidence into PASS. Absent physical device or macOS host must not
stall executable Android certification work.

## Recovery order

1. `AGENTS.md`
2. `docs/PROJECT_CONSTITUTION.md`
3. `.agent/GOVERNANCE.json`
4. `.agent/STATE.md`
5. `.agent/CURRENT_CAMPAIGN.md`
6. `.agent/KNOWN_ISSUES.md`, `.agent/VALIDATION.md`
7. `openspec/changes/022-release-candidate-certification/EXECUTION.md`
