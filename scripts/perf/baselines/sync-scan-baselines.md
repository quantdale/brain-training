# Sync-scan baselines — campaign 012 W13 (2026-08-22)

Evidence record for the progression sync scan surfaces (`progression/sync.ts`,
quest/achievement evaluation). Probes: `perf-sync-scan-probe.test.ts` +
`perf-quest-eval-ab.test.ts` (both opt-in via `PERF_PROBE=1`; the first is also
captured by `node scripts/perf/run-probes.mjs`).

Environment: Windows host, node v22.23.2, in-memory `node:sqlite` via
`createMigratedDb`, realistic blob sizes (~150B difficulty / ~450B raw result),
sessions one minute apart ending at a fixed evaluation clock
(`2026-08-21T12:00`). Methodology: **min-of-3** per scenario (every scenario is
idempotent, so repeats are safe); quest-eval A/B additionally uses both run
orders + interleaved sampling to defeat JIT/GC ordering bias.

Caveats: desktop node numbers; on-device Hermes JS is typically several times
slower per JS op. Cross-process absolute numbers vary ±25% on this machine —
only same-process deltas are used for decisions below.

## Before numbers (ms) — perf-sync-scan-before-2026-08-22.json

| Scenario                       |   100 |   1k  |    5k |   20k |
| ------------------------------ | ----: | -----: | -----: | -----: |
| buildQuestSamples (db read)    |  0.24 |  1.43 |  5.13 |  5.44 |
| evaluateQuests (in-mem engine) |  2.18 | 19.09 | 77.90 | 71.49 |
| syncQuestProgress (total)      |  6.18 | 20.03 | 80.24 | 82.22 |
| buildAchievementSnapshot       |  0.91 |  2.16 | 12.61 | 41.94 |
| syncAchievements (total)       |  1.97 |  4.87 |  8.91 | 41.94 |
| getDistinctActivityDates       |  0.12 |  0.55 |  1.59 | 11.57 |

Notes:

- `evaluateQuests` at 5k/20k sees only the capped 5000-sample window
  (`SYNC_SESSION_SCAN_LIMIT`), hence the flat 5k→20k column.
- DB-side reads stay cheap everywhere (≤12 ms even @20k). The sync cost is
  dominated by in-JS quest evaluation near/above the cap.

## Decision log — what changed and what did NOT

### 1. Quest evaluation partitioning — EXPLORED AND REJECTED on evidence

Hypothesis: `evaluateQuests` re-filters all samples per daily/weekly definition
(≈6 full rescans with fresh `new Date(...)` + period keys each), so ONE
pre-partitioning pass should win ~3×.

Measured (plain-node micro-replica): engine scan 26 ms vs single-pass
partition 8 ms @5000 — hypothesis looked right.
Measured (**real code under the project's babel/jest toolchain**,
`perf-quest-eval-ab-2026-08-22.json`, interleaved min-of-9): engine **49.4 ms**
vs partitioned **56.5 ms**; both orders confirm (partitioned slower after
either warm-up path). Keys-only floor for any single pass: 32.7 ms.

Conclusion: under the actual toolchain the transform/dispatch overhead of the
extra pass erases the theoretical win and then some. **No change applied to
`progression/sync.ts`.** A genuinely faster fix must live inside the quests
engine (e.g., compute day/week keys once per sample inside `evaluateQuests`, or
switch predicates to numeric day/week indices instead of string compares) —
that module is outside this packet's write surface → NEEDS_PARENT.

### 2. Achievement snapshot @20k ≈ 42–62 ms — NOT improved

`buildAchievementSnapshot` runs ~11 aggregate statements that each scan
`game_sessions` (COUNT / AVG-class aggregates over `normalized_result` cannot
use an index without schema support). At realistic sizes (≤1k sessions) it is
2–3 ms; the cost only appears at stress sizes. Any real fix = indexed or
materialized aggregates → **schema migration territory, parent-owned**
(SCHEMA_VERSION bump forbidden to this worker). Documented, not acted on.

### 3. loadProgressSnapshot — unchanged (per packet guidance)

Prior measurement 102.7 ms @20k fast-path was declared acceptable; this wave's
probes did not target it further.

### 4. buildQuestSamples / getDistinctActivityDates — no change justified

5.4 ms / 11.6 ms @20k respectively; projection reads already avoid JSON blobs.
Nothing structural warranted at these numbers.

## After numbers

**N/A — no production code change survived evidence review**, so before ==
after by construction (same binary paths). The baseline JSON above is the
current reference point for future waves. Re-run after landing any parent-owned
quests-engine or schema fix to quantify the delta against these numbers.

Cross-check: an independent `run-probes.mjs` capture of the identical reverted
binary (`perf-sync-scan-2026-08-22T19-41-45-630Z.json`) measured
`evaluateQuests_5000` at 122.0 ms vs the 77.9 ms reference above — same code,
cross-process spread ≈ ±50% on this machine. This is why every decision in this
document rests on same-process interleaved deltas only.

## How to re-run

```bash
# from repo root:
node scripts/perf/run-probes.mjs          # captures BOTH probe suites
# targeted (from apps/mobile):
PERF_PROBE=1 npx jest src/__tests__/perf-sync-scan-probe.test.ts --runInBand
PERF_PROBE=1 npx jest src/__tests__/perf-quest-eval-ab.test.ts --runInBand
```
