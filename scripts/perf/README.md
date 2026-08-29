# Performance probes (campaign 009, W13)

Evidence-based measurement tooling for the performance audit. These are
**measurements, not gates** — absolute numbers vary by machine, so compare
baselines from the same machine only.

## Run

```bash
node scripts/perf/run-probes.mjs
# equivalent from the app boundary:
cd apps/mobile && npm run perf:probe
```

This executes `apps/mobile/src/__tests__/perf-baseline-probe.test.ts` under
jest with `PERF_PROBE=1` (the spec is skipped in normal CI), seeds an in-memory
SQLite DB with 5k and 20k realistic session rows, and writes a timestamped
JSON baseline into `scripts/perf/baselines/`.

## What is measured and why

| Scenario | Audit finding it quantifies |
| --- | --- |
| `listRecent_N_full_rows_ms` | F1/F2: `rewards.tsx:85` and `profile.tsx:170` call `sessions.listRecent(5000)`, materializing full rows incl. 2× `JSON.parse` per row, only to derive activity dates / quest samples. |
| `listLightweight_N_projection_ms` | The cheap alternative that already exists (`SessionRepository.listLightweight`). |
| `getDistinctActivityDates_N_ms` | One-row-per-day aggregate — the fix for the streak input in rewards/profile. |
| `loadProgressSnapshot_N_ms` | F3: Progress tab loads EVERY session with parsed JSON blobs on every focus (`analytics/queries.ts:12` uses limit 1,000,000). |
| `exportLocalData_5000_incl_checksum_canonical_ms` + `serializeBackup_5000_second_canonical_ms` | F4: backup export canonicalizes the whole envelope twice on the JS thread (`serialize.ts:344` checksum pass + `data-management.tsx:82` serialize pass). |

## Regression guards (always-on, deterministic)

The non-timing contracts behind these findings are pinned by jest guards that
run in normal CI:

- `src/__tests__/perf-db-query-patterns.test.ts` — statement-count N+1 guards,
  projection-only reads for quest/achievement evaluation, LIMIT enforcement.
- `src/__tests__/perf-audio-haptics-lifecycle.test.ts` — preload-once /
  reuse / release lifecycle of the audio engine.
- `src/__tests__/perf-use-db-data.test.tsx` — load-once-per-deps and
  stale-response cancellation for the shared data hook.

## Campaign 011 W10 addition: old-vs-new snapshot read measurement

`apps/mobile/src/analytics/__tests__/projections-differential.test.ts` contains
an opt-in describe (`perf: projection vs legacy read cost`, enabled via
`PERF_PROBE=1`) that measures, on one seeded fixture per size (1k/5k/20k):

- legacy full-row `listRecent` vs `listProgressProjection` (+ JS mapping) vs
  end-to-end `loadProgressSnapshot`, each a median of 3 in-process runs;
- results print as `PERF_W10_JSON:{...}` lines for capture.

Unlike the scenarios above it compares old-vs-new inside ONE process, so it is
meaningful even on a loaded machine; absolute values remain machine-relative.
