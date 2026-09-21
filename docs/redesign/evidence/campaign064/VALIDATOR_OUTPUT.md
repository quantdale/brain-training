# Campaign 064 — validator output

Captured 2026-09-21 from the repository root after the adversarial-review
fixes. Every command below is deterministic and offline except where
noted.

## Self-tests and scans

```
$ node scripts/validate-offline.mjs --self-test
Offline validator self-test: 30 passed, 0 failed

$ node scripts/validate-offline.mjs --check
validate-offline: scanning D:\Documents\tryPython\brain-training\apps\mobile\src
  files scanned: 983  (excludes __tests__, __mocks__, *.test.ts, *.spec.ts)
  CLEAN — no network API usage outside the allowlist.

$ node scripts/validate-secrets.mjs --self-test
validate-secrets self-test: PASS

$ node scripts/validate-secrets.mjs
validate-secrets: CLEAN — scanned 2633 tracked text files

$ node scripts/validate-provenance.mjs --self-test
provenance self-test: PASS (12 checks)

$ node scripts/validate-provenance.mjs --check-allowlist
provenance allowlist check: OK (2 entries; earliest expiry 2026-11-11T18:14:06.296Z)

$ node scripts/certification/validate-jest-signal.mjs --self-test
validate-jest-signal self-test: PASS

$ node scripts/certification/validate-jest-signal.mjs --check-allowlist
validate-jest-signal: allowlist OK — 5 entries, earliest expiry 2027-03-31

$ node scripts/validate-affected.mjs --self-test
validate-affected self-test: 16 passed, 0 failed

$ node scripts/validate-affected.mjs --check-sync
IMPACT_MAP sync: OK (19 areas, 51 patterns)

$ node scripts/validate-affected.mjs --strict <unmatched path>
Unmatched paths (1): ... ; exit code 1

$ node scripts/qa/validate-runtime-qa-contract.mjs --self-test
Runtime QA contract self-test: PASS (16 checks)

$ node scripts/qa/validate-runtime-qa-contract.mjs
Runtime QA contract: PASS

$ node scripts/validate-dependency-audit.mjs --self-test
Dependency audit self-test: 41 passed, 0 failed

$ node scripts/validate-workflows.mjs --self-test
Workflow validator self-test: 44 passed, 0 failed

$ node scripts/validate-workflows.mjs
Workflow hygiene validation PASS (4 files scanned)

$ node scripts/validate-repo-state.mjs
Repository state validation PASS

$ node scripts/validate-task-ownership.cjs
Task-ownership validation passed.
```

## Repository gates

```
$ cd apps/mobile && npm run typecheck
TYPECHECK_EXIT=0

$ cd apps/mobile && npm run lint
LINT_EXIT=0

$ npx --yes @fission-ai/openspec@1.6.0 validate --all --strict
Totals: 48 passed, 0 failed (48 items)   # includes change/064

$ npx expo-doctor   # (Expo Doctor, see closure doc for the run)
```

## Focused Jest (harness changes)

```
$ cd apps/mobile && npx jest src/test-utils/__tests__/console-signal.test.ts \
    src/__tests__/jest-config-coverage.test.ts \
    src/__tests__/offline-boundary.test.ts --runInBand
Test Suites: 3 passed, 3 total
Tests:       17 passed, 17 total
```

## Probe runner (all five opt-in probes)

```
$ node scripts/perf/run-probes.mjs --list
perf-baseline | src/__tests__/perf-baseline-probe.test.ts | env: PERF_PROBE=1 | marker: PERF_BASELINE_JSON: | ...
perf-sync-scan | src/__tests__/perf-sync-scan-probe.test.ts | env: PERF_PROBE=1 | marker: PERF_SYNC_JSON: | ...
perf-quest-ab | src/__tests__/perf-quest-eval-ab.test.ts | env: PERF_PROBE=1 | marker: PERF_QUEST_AB_JSON: | ...
perf-projection-w10 | src/analytics/__tests__/projections-differential.test.ts | env: PERF_PROBE=1 | marker: PERF_W10_JSON: | ...
perf-large-backup | src/data-portability/__tests__/large-backup-memory.test.ts | env: LARGE_BACKUP_PROBE=1 | marker: LARGE_BACKUP_MEMORY_JSON: | ...

$ node scripts/perf/run-probes.mjs
[perf] baseline written: scripts\perf\baselines\perf-baseline-<stamp>.json
[perf] baseline written: scripts\perf\baselines\perf-sync-scan-<stamp>.json
[perf] baseline written: scripts\perf\baselines\perf-quest-ab-<stamp>.json
[perf] baseline written: scripts\perf\baselines\perf-projection-w10-<stamp>.json
[perf] baseline written: scripts\perf\baselines\perf-large-backup-<stamp>.json
exit code 0
```

The runner exits non-zero when any marker line is missing, so all five
`baseline written` lines prove the console-gate forwarding keeps markers
on stdout.

## APK permission comparison

```
PERMISSION_SET_MATCH (8 permissions)
```

See `APK_PERMISSION_GATE.md` for the full `aapt2` output.

## Full Jest matrix

```
$ cd apps/mobile && npm run test:ci -- --json --outputFile=jest-summary.json --cacheDirectory=.jest-cache
Test Suites: 4 skipped, 579 passed, 579 of 583 total
Tests:       5 skipped, 6854 passed, 6859 total
Snapshots:   5 passed, 5 total
Time:        269.983 s
MATRIX_EXIT=0

# JSON status breakdown: 578 passed + 1 'focused' (green suite containing an
# allowlisted opt-in pending test) + 4 skipped; 0 failed suites/tests.

$ node scripts/certification/validate-jest-signal.mjs --summary apps/mobile/jest-summary.json
... "pass": true   # 5 classified skips, 0 unclassified, 0 ambiguous, 0 unexpected console output
SIGNAL_EXIT=0

$ cd apps/mobile && npx expo-doctor
21/21 checks passed. No issues detected!   # DOCTOR_EXIT=0
```
