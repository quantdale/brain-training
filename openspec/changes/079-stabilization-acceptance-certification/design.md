# Design — 079-stabilization-acceptance-certification

## Context

Campaign 079 is a bounded stabilization and certification program, not a
feature build. The architecture (React Native + Expo + TypeScript, SQLite,
offline-first, generated registries, shared Game SDK) is settled and validated
through Campaign 078. This change therefore adds no runtime architecture; it
hardens the quality gates, the evidence model, and the release governance
around the existing product.

## Decisions

1. **Validator CLI-contract gate is static and deterministic.** The regression
   class at `d26cd536` (a documented flag rejected by its own parser) is
   caught by comparing, per gate script, the flags documented in usage text,
   the flags the argument parser recognizes, and the flags `.github/workflows/`
   actually invoke. It runs offline in Repository Integrity. Live
   execution of every flag stays with the existing per-script self-tests; the
   contract gate complements them rather than replacing them.
2. **Security remediation is lockfile-only and in-range.** `brace-expansion`
   fixed lines were inside the parents' semver ranges, so
   `npm update brace-expansion` is the entire patch surface (no overrides, no
   major upgrades, no manifest churn). Advisories without an in-range fix keep
   reviewed acceptances with owner/review/exit/remediation fields.
3. **Branch protection is verified through the GitHub API, never assumed.**
   Required checks use the exact `name:` values of the four top-level
   workflows so check-name matching is stable, and the PR-triggered workflows
   must be able to satisfy their own requirements (no circularity).
4. **Certification evidence is recorded per gate at exact revisions.** The
   matrix lives at `docs/certification/079-release-certification/` and uses
   PASS / FAIL / BLOCKED / NOT VALIDATED. Historical campaign evidence remains
   immutable; new observations are appended with their own revision and
   environment, never merged into old claims.

## Non-goals

No gameplay, persistence, scoring, economy, routing, or dependency-major
changes. No physical-device or iOS-runtime claims. No production release
publication.
