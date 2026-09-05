# Design — Campaign 022 Release-Candidate Certification

## Evidence model

Every certification claim is classified into exactly one of:
`PASS` (executed, observed, attributed to SHA/device/artifact),
`FAIL` (executed, defect found),
`NOT VALIDATED` (executable in principle, not yet performed),
`DEFERRED` (constitution/owner decision),
`EXTERNALLY BLOCKED` (host/tooling cannot execute; evidence of the blocker
recorded). Transitions to PASS require re-runnable evidence pointers (run id,
artifact SHA-256, AVD name, DB row counts, log excerpt).

## Layered certification stack

1. **Static/automated** (already green at baseline): validators, Jest, tsc,
   lint, secret scanner, CI workflows. Re-proved at the final SHA only.
2. **Artifact layer**: fresh clean `npm ci` → Expo Doctor → clean `expo
   prebuild` → Gradle release assembly → APK (+AAB if credential-free) →
   manifest/permission/ABI/version inspection → SHA-256 recorded.
3. **Standalone runtime layer**: install the produced artifact on the
   dedicated `braintraining-qa36` AVD from an uninstalled state; prove no
   Metro dependency; drive autobot certify journeys against the release build
   where the harness supports it, otherwise against the closest reproducible
   dev-client build with the difference stated.
4. **Integrity layer**: lifecycle torture (force-stop, process death mid-flow,
   relaunch cycles), real-SQLite soak (integrity_check, FK checks, migration
   replay, large corpus), backup/export/restore round-trip equivalence with
   adversarial archives.
5. **Platform layer**: accessibility tree audit + honest TalkBack
   classification; SAF system sheets split into app-side vs system-side
   evidence; physical device if authorized hardware is attached; iOS runtime
   only if a macOS environment exists.

## Debt triage protocol

Each tracked debt item gets: intent → code reality → adversarial construction →
classification (RELEASE BLOCKER / RELEASE RELEVANT / NON-BLOCKING MAINTENANCE /
FALSE-OBSOLETE) → action (fix with migration+tests, or documented proof of
safety and reclassification). No speculative fixes; no blind schema churn.

## Concurrency model

Read-only investigations parallelize (scouts). All device work is serialized
(single AVD, single Metro, single autobot driver via lockfile). Shared hotspots
(db schema, registries, governance, durable state) are orchestrator-owned.
Coder packets only when file-disjoint and beneficial.

## Falsification discipline

Before any major PASS is recorded, the campaign states what observation would
falsify it and attempts that falsification when safe (duplicate-write probes,
adversarial archives, process-death races, offline mode, forbidden-permission
scan). Failed falsification strengthens PASS; successful falsification creates
a defect entry with severity per the release-blocker policy.
