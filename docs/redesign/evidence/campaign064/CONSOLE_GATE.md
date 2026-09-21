# Campaign 064 — console gate coverage

**Change:** `064-dependency-security-validation-gates`
**Files:** `apps/mobile/src/test-utils/console-signal.ts`,
`apps/mobile/src/test-utils/__tests__/console-signal.test.ts`,
`apps/mobile/jest/setup.js`, `apps/mobile/src/sdk/perf.ts`, seven
deliberate emitters.

## Coverage

| Level | Before 064 | After 064 |
|---|---|---|
| `console.error` | guarded (Campaign 053) | guarded |
| `console.warn` | guarded (Campaign 053) | guarded |
| `console.log` | unguarded | guarded |
| `console.info` | unguarded | guarded |
| `console.debug` | unguarded | guarded |

`GUARDED_CONSOLE_LEVELS` is exported so the contract test pins the list;
the reviewed `CONSOLE_BASELINE` remains empty (no broad allowlist was
introduced).

## Semantics (unchanged from 053 except forwarding)

- **Unexpected output** is recorded against the producing test and fails
  that test in `afterEach`; the message is still printed.
- **Expected output** (`expectConsoleNoise(pattern, fn)`) is counted,
  must actually occur, and — new in 064 — is **forwarded to the real
  console** instead of being swallowed. Forwarding is what keeps the
  probe marker lines (`PERF_BASELINE_JSON:`, …) on stdout for
  `scripts/perf/run-probes.mjs`.
- **Per-test isolation**: `resetConsoleSignal()` runs in `afterEach`;
  late unawaited emissions cannot be attributed to their origin test and
  are documented as such in the module header.

## Deliberate emitters (scoped, never muted)

| Emitter | Marker/message |
|---|---|
| `src/__tests__/perf-baseline-probe.test.ts` | `PERF_BASELINE_JSON:` |
| `src/__tests__/perf-sync-scan-probe.test.ts` | `PERF_SYNC_JSON:` |
| `src/__tests__/perf-quest-eval-ab.test.ts` | `PERF_QUEST_AB_JSON:` |
| `src/analytics/__tests__/projections-differential.test.ts` | `PERF_W10_JSON:` |
| `src/data-portability/__tests__/large-backup-memory.test.ts` | `LARGE_BACKUP_MEMORY_JSON:` |
| `src/analytics/__tests__/analytics-v2-references.test.ts` | `[W09] 20k-session aggregate pass took …` |
| `src/content/__tests__/catalog-integrity-sweep.test.ts` | `catalog-integrity sweep: …` |

Deleted: the dead `DUP` debug print in
`src/games/language-sentence-builder/__tests__/generator.test.ts` (it
could only run when an assertion was already failing).

## Source emitter

`sdk/perf.ts` `emitPerfRecord()` fires under jest because `__DEV__` is
true in jest-expo; the resulting `[perf]` lines are device-QA logcat
artifacts, not test signal. The emitter now returns early when
`process.env.JEST_WORKER_ID` is set — test-runner-only suppression.
Device/dev-build logging and the in-process ring buffer
(`getRecentPerfRecords`, the seam tests read) are unchanged.

## Evidence

- `console-signal.test.ts`: all-level guard list, unscoped log failure,
  scoped non-occurrence failure, per-test reset.
- Full matrix: zero unexpected console output (see
  `VALIDATOR_OUTPUT.md`).
- Probe runner: all five markers captured from stdout after forwarding
  (see `VALIDATOR_OUTPUT.md`).
