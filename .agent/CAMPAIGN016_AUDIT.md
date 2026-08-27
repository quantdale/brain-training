# Campaign 016 Audit — Release Certification & Hardening

**Audit baseline:** `1b5802d62447c44e58d0f0bdb36ada740b05d023`  
**Date:** 2026-08-28  
**Decision:** Codebase Hardening + Release Certification  
**OpenSpec:** `openspec/changes/016-release-certification-hardening/` (PROPOSED)

## Repository state assessment

The project is mature enough that another broad implementation campaign would be lower value than hardening. The 42-game catalog and major product systems are implemented, current App CI and Repository Integrity are green, and the repo has a large deterministic test/validator surface.

The main readiness deficit is evidence quality across campaign lifecycle, clean native reproducibility, and target-platform runtime/compile proof.

## Audit methodology

This audit used:
- recursive repository tree inspection (1,777 tracked files);
- source/config/topology review across app, games, DB, workout, portability, platform, plugins, scripts, workflows, OpenSpec and durable state;
- recent commit/campaign history;
- current `main` GitHub Actions run status and App CI job logs;
- current package/app config;
- current 015 OpenSpec/lifecycle/checkpoint state;
- existing project constitution, known issues, master plan and prior certification evidence.

This session did not execute local Android/iOS binaries itself. Platform evidence is therefore classified from repository/GitHub artifacts and never promoted beyond what those artifacts support.

## Highest-priority findings

### P1 — 015 lifecycle truth contradiction
The repository contains `.agent/checkpoints/015-governance-depth-convergence-COMPLETED.md`, but machine-readable campaign fields still make 015 ACTIVE. This undermines fresh-agent recovery and means the campaign is not durably closed despite its checkpoint.

### P1 — Current Android proof gap
Current-head post-015 Android runtime evidence is missing because the dedicated WHPX emulator segfaults after boot. Older Android certification is strong but cannot prove the final changed surfaces.

### P1 — iOS build proof gap
iOS is a declared platform target, yet current source compatibility has no Xcode build evidence.

### P1 — Native clean-checkout proof gap
GitHub CI proves clean JS/TS installation and web build, but not current-head clean native generation/build reproducibility.

### P2 — CI green signal contains known noise
App CI passes, but 4 suites / 5 tests are skipped and several expected failure-path tests print `console.error`. Runner/tooling deprecation warnings also remain.

### P2 — Dependency and performance follow-up
The repo documents 16 build/dev-toolchain advisories and synthetic multi-second backup/export work. These require reclassification/reproduction, not speculative rewrites.

## Non-findings / intentionally deferred
No new campaign should add game breadth or open final branding, Supabase/auth, AI production, monetization, ads, social, store signing/listing, notifications/widgets, or final public OS-floor decisions. Those are constitution-deferred and are not defects.

## Recommended execution
Use the OpenSpec 016 package. Close 015 first, then activate 016 and execute through exact-SHA final certification.
## Planning-package validation note

The initial Campaign 016 planning commit exposed an OpenSpec-format error in the four new delta specs. The specs were corrected to the repository's required `ADDED Requirements -> Requirement -> Scenario` structure before this audit package was finalized. This note intentionally creates one final coherent documentation-only head so App CI and Repository Integrity can validate the complete planning package without concurrency cancellation from the sequential repair commits.
