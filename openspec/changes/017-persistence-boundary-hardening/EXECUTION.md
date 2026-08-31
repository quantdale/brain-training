# Execution Entry — Campaign 017 Persistence Boundary Hardening

**Status:** ACTIVE
**Change:** `017-persistence-boundary-hardening`
**Baseline:** `27c9174` plus the owner-authorized initial audit repair set
**Target branch:** `main`
**Predecessor:** `016-release-certification-hardening` (VALIDATED terminal)

## Mission

Harden every local persistence boundary that can affect player history,
progression, currency, rewards, backup/restore, or synchronization. Keep the
implementation offline-first, deterministic, and recoverable.

## Execution order

1. Validate repository inputs and numeric domains before opening writes.
2. Finish schema/replay/backup/sync repairs and their real-DB regressions.
3. Run focused persistence and portability tests.
4. Run the complete static/test gate, classify unavailable Android/manual
   evidence, update durable records, and close 017 before activating 018.

## Exit gate

No new Critical/High data-integrity defect may remain. Any test or platform
check that cannot execute must be recorded as `NOT VALIDATED` or `BLOCKED`; it
must not be converted to a pass by an allowlist or retry.

## Scope guard

No game #43, feature expansion, cloud/auth/AI/monetization/social system,
signing, or store-publication work is allowed in this change.
