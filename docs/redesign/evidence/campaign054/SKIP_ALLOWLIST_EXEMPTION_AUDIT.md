# Campaign 054 — Skips / Allowlists / Exemptions Audit

**Status:** FINAL
**Date:** 2026-09-19

## Method

- Static scan of `apps/mobile/src` for `it.skip`, `test.skip`, `describe.skip`,
  `it.todo`, `xit`, `xdescribe`, `@ts-ignore`, `@ts-expect-error`, and
  `eslint-disable` (`D:\Temp\campaign054\scan-skips.mjs`).
- Inventory of `scripts/certification/jest-skip-allowlist.json`,
  `scripts/certification/dependency-audit-allowlist.json`,
  `.agent/provenance-allowlist.json`, the catalog persistence exemption
  mechanism, and the unexpected-console baseline.
- Full-suite result and the `validate-jest-signal` gate.

## Skipped tests (5 `describe.skip` sites)

All five are the classified opt-in probes; there are **no other test skips**
(no `it.skip`, `test.skip`, `it.todo`, `xit`, or `xdescribe` anywhere in
`apps/mobile/src`).

| Probe file | Enable cond. | Purpose | Executed in 054? |
| --- | --- | --- | --- |
| `src/__tests__/perf-baseline-probe.test.ts` | `PERF_PROBE=1` | history-read/export cost baselines | see probe run below |
| `src/__tests__/perf-sync-scan-probe.test.ts` | `PERF_PROBE=1` | quest/achievement sync scan costs at 100–20k sessions | see below |
| `src/__tests__/perf-quest-eval-ab.test.ts` | `PERF_PROBE=1` | quest evaluation A/B timing | see below |
| `src/analytics/__tests__/projections-differential.test.ts` | `PERF_PROBE=1` | projection-vs-legacy read cost (deterministic differential tests in the same file always run) | see below |
| `src/data-portability/__tests__/large-backup-memory.test.ts` | `LARGE_BACKUP_PROBE=1` | 20k-session large-backup memory measurement | see below |

The enable conditions are pinned by
`src/__tests__/perf-probe-contract.test.ts` (1 suite / 2 tests), so a skip
cannot silently become unconditional and the roster cannot grow unreviewed.

## Probe execution results (2026-09-19)

All five allowlisted opt-in probes were executed this campaign:

| Probe | Command / enable | Result |
| --- | --- | --- |
| `perf-baseline-probe` + `perf-sync-scan-probe` | `node scripts/perf/run-probes.mjs` (`PERF_PROBE=1`) | **PASS** — 1 suite / 1 test each; `PERF_BASELINE_JSON` + `PERF_SYNC_JSON` written; new timestamped baselines `scripts/perf/baselines/perf-baseline-2026-09-19T14-31-01-691Z.json` and `perf-sync-scan-2026-09-19T14-31-01-691Z.json` |
| `perf-quest-eval-ab` | `PERF_PROBE=1 npx jest src/__tests__/perf-quest-eval-ab.test.ts --runInBand` | **PASS** — 1 suite / 1 test; `PERF_QUEST_AB_JSON` emitted |
| `projections-differential` (perf block) | `PERF_PROBE=1 npx jest src/analytics/__tests__/projections-differential.test.ts --runInBand` | **PASS** — 1 suite / 18 tests (the always-run deterministic differential tests plus the opt-in timing block) |
| `large-backup-memory` | `LARGE_BACKUP_PROBE=1 npx jest src/data-portability/__tests__/large-backup-memory.test.ts --runInBand` | **PASS** — 1 suite / 1 test at 20k sessions |

Raw outputs: `D:\Temp\campaign054\runtime\probe-*.txt` and `probe-summary.json`.
The standard CI command still skips these five classified measurements; nothing
functional is hidden (the deterministic assertions inside the same files run in
the full suite).

## Allowlists / exemptions

| Mechanism | Entries | State | Notes |
| --- | --- | --- | --- |
| `jest-skip-allowlist.json` (schema v2) | 5 | current | Each entry names file + test pattern + `enableWith` + rationale + `reviewedAt`; `validate-jest-signal` self-test passes and the CI gate classifies every skip by name |
| `dependency-audit-allowlist.json` | 4 (was 5) | reduced | The `js-yaml` waiver was removed after the in-range patch remediation; remaining: `decode-uri-component` (runtime-accepted-debt, expires 2027-03-31), `image-size` x2 and `uuid` (build-dev-toolchain) |
| `.agent/provenance-allowlist.json` | 2 | current (expire 2026-11-11) | Both are non-semantic export-removal cleanup entries from Campaign 027; provenance gate reports no drift |
| Catalog persistence exemption roster | 0 | empty | Mechanism requires identity + reason + alternate evidence; no game needs an exemption (42/42 covered) |
| Unexpected-console baseline (`jest/setup.js`) | 0 | empty | Full suite passes with the gate active; deliberate error paths assert through `expectConsoleNoise()` |

## Suppressions

- `eslint-disable` directives: 13, all narrow, inline, rule-specific
  (`react-hooks/exhaustive-deps`, `react-hooks/set-state-in-effect`,
  `react-hooks/refs`, `@typescript-eslint/no-require-imports`, `import/first`)
  with stated reasons in the same line or comment. No file-wide or blanket
  disables; lint reports 0 errors / 0 warnings.
- `@ts-ignore` (1) and `@ts-expect-error` (1): both in test files exercising
  deliberate invalid inputs; typecheck is clean.

## Disposition

No skip, allowlist, or exemption is hiding a normal functional test. Every
safe opt-in probe was executed; the unexpected-console and catalog-exemption
rosters remain empty.
