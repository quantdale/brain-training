# Known Issues / Blockers

## Current status — Campaign 022 VALIDATED, release verdict CONDITIONAL GO

Campaign 022 is terminal. There is no active campaign and no repository-owned release blocker remains. The application is **not yet fully store/public-release cleared** because several evidence classes are deliberately external/manual:

- production/Play store signing credentials and store-signing reproducibility;
- manual TalkBack accessibility review;
- Android SAF/share/document-picker system-sheet flows;
- physical-device behavior;
- manual iOS runtime UX on a suitable macOS/iOS environment.

These remain **NOT VALIDATED / DEFERRED / EXTERNALLY BLOCKED** as applicable. They are not failures of the repository-owned automated matrix, and they must not be reported as PASS until actually performed.

## Open non-blocking maintenance

- **`xp_awards` schema-level idempotency idea — NON-BLOCKING MAINTENANCE:** Campaign 022 proved every production award writer commits inside one serialized transaction behind a CAS claim gate, with currency ledger operations additionally guarded by operation-id uniqueness. A blanket `UNIQUE(source)` would be wrong because legitimate legacy/generic sources such as `system` may repeat during supported restore semantics. Keep the adversarial proof in the Campaign 022 audit map rather than adding the incorrect constraint.
- **Offline validator heuristic gap — Low:** the static validator can miss runtime-reassembled network-call strings. Runtime/offline certification is the stronger evidence for the shipped boundary; improve the heuristic only in a scoped maintenance campaign.
- **Seeding test-fixture seam noise — Low:** partial Jest DB facades can emit non-fatal startup noise not representative of the production facade.
- **Permanent provenance allowlist dead entries — Low:** legacy permanent entries are ignored by design and are misleading configuration debt; remove only in an identity-aware maintenance change.
- **QA artifact retention — Low:** transient `qa-artifacts/` output is gitignored but can accumulate locally; add bounded retention before automation volume grows materially.
- **Build/dev dependency advisories:** retain the existing dependency-audit classification and re-evaluate with planned framework/toolchain upgrades; do not force unrelated dependency churn into a release-doc cleanup.
- **Achievements sync scope — Low:** quest/achievement evaluation scans up to
  5000 recent sessions (`SYNC_SESSION_SCAN_LIMIT`,
  `apps/mobile/src/progression/sync.ts`); measured flat ~78 ms at cap (W13
  baselines), far above realistic foundations-phase history. Documented cap,
  non-blocking.
- **Constitution-deferred product systems (not bugs):** cloud sync/auth,
  telemetry, and monetization/ads remain deferred by
  `docs/PROJECT_CONSTITUTION.md`; they are planned future layers, not open
  defects, and must not be implemented without an owner-authorized campaign.

## Operational recommendation (owner-side, not a product blocker)

- **`main` branch protection not configured:** observed 2026-09-05/06 — the
  GitHub repository has no branch-protection rules and no required status
  checks on `main`, so direct pushes can bypass CI. Recommended: protect
  `main` and require the four release checks. Repository-administration
  changes require explicit owner authorization; not executed autonomously.

## Evidence location

Exact Campaign 022 artifact hashes, 42/42 certify evidence, Workout/lifecycle/SQLite/backup/offline/security evidence, platform classifications, workflow run IDs, and prior campaign history remain in `.agent/VALIDATION.md` and the OpenSpec packet. Historical blockers and earlier campaign limitations remain available in Git history; this living file intentionally contains only the current actionable truth.
