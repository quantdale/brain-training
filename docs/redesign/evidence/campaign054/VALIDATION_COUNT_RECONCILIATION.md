# Campaign 054 — Validation Count Reconciliation

**Status:** RECONCILED — authoritative terminal count established
**Date:** 2026-09-19
**Authoritative command:** `npm run test:ci` (`jest --ci --maxWorkers=2`) in
`apps/mobile`, on the synchronized `main` tree at `9fe9b41` (whose executable
product source is identical to the Campaign 053 artifact source `02a7ecb`; see
`FINAL_SHA_ARTIFACT_PROVENANCE.md`).

## The contradiction

| Source | Suites | Tests |
| --- | --- | --- |
| Terminal Campaign 053 commit message `8350db2` | 564 | 6,726 |
| `openspec/changes/053-full-system-hardening/change.json` | 563 | 6,724 |
| `.agent/VALIDATION.md` (Campaign 053 section) | 563 | 6,724 |
| `.agent/KNOWN_ISSUES.md` (Campaign 053 disposition) | 563 | 6,724 |
| `.agent/STATE.md` (Campaign 053 section) | 563 | 6,724 |
| `docs/redesign/evidence/campaign053/CAMPAIGN053_EVIDENCE.md` | no count line (verified by search) | no count line |
| `openspec/changes/053-full-system-hardening/exploration.md` (discovery baseline) | 559 passed of 563 total | 6,575 passed of 6,580 total |
| Commit `e154f5b` message (implementation checkpoint) | 563 | 6,724 |

Note: the Campaign 054 prompt listed the evidence packet as one of the
563/6,724 sources; a direct search of the committed packet shows no suite/test
count line. The affected documentation sources are `change.json`,
`.agent/VALIDATION.md`, `.agent/KNOWN_ISSUES.md`, and `.agent/STATE.md`, all of
which are reconciled below. `exploration.md`'s 559/563 figure is the correct
pre-implementation discovery baseline and is preserved as historical.

## Authoritative current run (2026-09-19)

Command: `npm run test:ci` in `apps/mobile`.

```
Test Suites: 4 skipped, 564 passed, 564 of 568 total
Tests:       5 skipped, 6726 passed, 6731 total
Snapshots:   5 passed, 5 total
Time:        233.923 s
```

Zero unexpected-console violations: the empty-baseline gate installed by
Campaign 053 (`apps/mobile/jest/setup.js`) is active in this run, and it fails
any test that emits an unexpected console error or warning. The run passed.

## Root cause of the mismatch

The intermediate count `563 suites / 6,724 tests` was measured during the
Campaign 053 implementation of `e154f5b`, **before the final
`apps/mobile/src/__tests__/perf-probe-contract.test.ts` suite existed** in the
measured tree. That suite pins the opt-in probe enable conditions (H-03) and
contains exactly **1 suite / 2 tests**, which is precisely the delta:

```
563 + 1 = 564 suites
6,724 + 2 = 6,726 tests
```

Proof that no other suite/test source changed after `e154f5b`:

- `git diff --name-only e154f5b..HEAD` contains **no** test, jest, or setup
  file. The only post-`e154f5b` commits are `ba2c18c` (allowlist disposition +
  task file), `57d0be1` (affected-area map), `02a7ecb` (durable state +
  evidence), `8350db2` (terminal governance + evidence), and `9fe9b41`
  (this campaign's prompt).
- Focused measurement of the two H-03/H-04 suites added by `e154f5b`:
  - `src/__tests__/perf-probe-contract.test.ts` → **1 suite / 2 tests**
    (measured directly, this campaign).
  - `src/components/game-host/__tests__/catalog-persistence-matrix.test.tsx`
    → **1 suite / 128 tests** (measured directly, this campaign; already
    included in the 563/6,724 intermediate measurement because only the
    probe-contract suite accounts for the exact +1/+2 delta).

Therefore: the terminal commit message was correct; the four documentation
copies recorded a stale intermediate number. The terminal count is
**564 suites passed / 6,726 tests passed** (with **4 skipped suites / 5
skipped tests** — the five classified opt-in probes — and **5 snapshots**;
568 total suites, 6,731 total tests).

## Historical counts preserved (not rewritten)

Intermediate counts remain correct for their commits and are not rewritten:

| Checkpoint | Suites | Tests | Note |
| --- | --- | --- | --- |
| Campaign 042 terminal | 558 passed / 4 skipped | 6,573 passed / 5 skipped | historical |
| Campaign 050 terminal | 559 passed / 4 skipped | 6,575 passed / 5 skipped | historical |
| Campaign 053 discovery baseline | 559 / 563 | 6,575 / 6,580 | historical (pre-implementation) |
| Campaign 053 implementation `e154f5b` | 563 | 6,724 | intermediate; probe-contract suite not yet counted |
| Campaign 053 terminal `8350db2` | 564 | 6,726 | correct terminal count; docs were stale |
| Campaign 054 authoritative (current) | 564 passed / 4 skipped | 6,726 passed / 5 skipped | authoritative |

## Reconciliations applied

- `.agent/VALIDATION.md` — Campaign 053 section corrected to the terminal
  count with an explicit note on the intermediate figure.
- `.agent/KNOWN_ISSUES.md` — Campaign 053 disposition corrected.
- `.agent/STATE.md` — Campaign 053 section corrected.
- `openspec/changes/053-full-system-hardening/change.json` —
  `validationNote` corrected to the terminal count.
- `docs/redesign/evidence/campaign053/CAMPAIGN053_EVIDENCE.md` — no count
  line existed to correct; a pointer to this reconciliation was added for
  discoverability.
- Historical campaign sections (042/050/051) are left as they were; their
  counts were correct at their checkpoints.
