# Campaign 065 — catalog repeatability spot-check

Seven bounded re-runs of the catalog/game suites at `a9111c3` (before the
065 fixes), executed by the reintro-guards critic lane. Purpose: detect
order-dependence, flake, and open-handle leaks in the "single-run
fragile" catalog area.

| # | Scope | Workers | Wall | Jest | Suites | Tests | Result |
|---|-------|---------|------|------|--------|-------|--------|
| 1 | `catalog-integrity-sweep.test.ts` | runInBand | 12.4 s | 8.277 s | 1 | 1 | PASS |
| 2 | `catalog-contracts` + `sdk/__tests__/catalog` + `games/memory` (A) | runInBand | 95.8 s | 91.611 s | 65 | 900 | PASS |
| 3 | same scope (B) | runInBand | 72.2 s | 68.603 s | 65 | 900 | PASS |
| 4 | `src/games` | `--maxWorkers=2` | 197.8 s | 193.605 s | 353 | 4213 | PASS |
| 5 | `projections.test.ts` + `--detectOpenHandles` | runInBand | 19.3 s | 14.953 s | 1 | 7 | PASS, no open handles |
| 6 | contracts scope (C) | default | 35.4 s | 32.683 s | 65 | 900 | PASS |
| 7 | sweep repeat | runInBand | 8.9 s | 5.416 s | 1 | 1 | PASS |

Findings: none. Runs 2/3/6 produced identical counts (65/900) across two
worker modes; the sweep payload was identical (`37 games, 0 findings, 0
notes`); suite completion order varied benignly under `--runInBand`;
duration spread tracks caching/worker scheduling. No cross-suite state
leakage, no order-dependence, no console-gate violations, and no open
handles. The "single-run fragile" catalog concern is not currently
reproducible; the 067 matrix adds the final-artifact repetition.

Raw logs: `D:\Temp\campaign065-repeatability-*` (outside Git).
