# Audit Map — Campaign 016

Baseline: `1b5802d62447c44e58d0f0bdb36ada740b05d023`

| ID | Severity | Area | Evidence | State | Required action |
|---|---|---|---|---|---|
| A-01 | P1 High | Campaign governance | 015 COMPLETED checkpoint exists while GOVERNANCE/CURRENT_CAMPAIGN/STATE/change.json remain ACTIVE | VERIFIED BROKEN | Reconcile 015 task/lifecycle state and close on exact green SHA before 016 activation |
| A-02 | P1 High | Android release evidence | Post-014/015 changed-surface device re-run is NOT VALIDATED due 37.1.x WHPX qemu segfault | VERIFIED GAP | Bounded emulator recovery + fresh changed-surface + full certify evidence |
| A-03 | P1 High | iOS compatibility | README/KNOWN_ISSUES explicitly say iOS build NOT VALIDATED | VERIFIED GAP | macOS CI no-signing simulator build smoke |
| A-04 | P1 High | Reproducibility | CI clean checkout is green, but current-head clean native prebuild/release build is not evidenced | VERIFIED GAP | Add clean-checkout/native build certification path |
| A-05 | P2 Medium | Test signal | Current CI: 4 skipped suites / 5 skipped tests | VERIFIED DEBT | Exact allowlist + fail on new skips; dedicated perf path |
| A-06 | P2 Medium | Test signal | Expected `console.error` emitted in error-boundary and persistence-failure tests | VERIFIED DEBT | Spy/assert expected logging so unexpected console errors remain high-signal |
| A-07 | P2 Medium | CI maintenance | GitHub runner warns v4 actions target Node 20 while runner forces Node 24 | VERIFIED DEBT | Move to current supported action majors after compatibility check |
| A-08 | P2 Medium | Dependency hygiene | 16 advisories documented as build/dev-only; not independently reclassified in this audit | REPO-DOCUMENTED | Re-run runtime-vs-dev audit; remediate only safe, available fixes |
| A-09 | P2 Medium | Performance | Synthetic backup/export probe is multi-second at 5k sessions | VERIFIED CANDIDATE | Reproduce/profile on realistic workload; optimize only with evidence |
| A-10 | P2 Medium | Manual platform flows | SAF/share/document picker sheets remain manual/NOT VALIDATED | VERIFIED GAP | Preserve explicit manual checklist; automate engine-side paths only |
| A-11 | P2 Medium | Physical-device timing | 60/120 Hz and real-device interaction latency not freshly proven | UNVERIFIED | Representative physical-device timing when available; otherwise NOT VALIDATED |
| A-12 | P3 Low | Release metadata | app version 0.1.0, generic identifiers, no EAS config | VERIFIED, DEFERRED | Do not change unless owner explicitly opens store-release decisions |
| A-13 | P3 Low | Deferred seams | assistant/notifications/sync/entitlement seams exist without production services | INTENTIONAL | Do not misclassify as unfinished core product |

## Current green evidence

- App CI run `33105102260`: SUCCESS on baseline.
- Repository Integrity run `33105102351`: SUCCESS on baseline.
- Jest: 487 passed suites, 6,031 passed tests, 4 skipped suites, 5 skipped tests.
- Web export: 20 routes.
- Expo Doctor: 21/21.
- Repository validators: repo-state, registry, provenance, ownership, offline boundary, QA self-test all pass in App CI.

## Evidence that must remain separate

**Do not combine:**
- prior Android certification vs current-head Android proof;
- source-level iOS compatibility vs actual Xcode build;
- statement-count guards vs wall-clock performance;
- engine-level backup tests vs manual system-sheet UX;
- intentionally skipped performance suites vs ordinary unit-test completeness;
- constitution-deferred systems vs defects.
