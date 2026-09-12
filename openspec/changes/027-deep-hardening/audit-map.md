# Audit map — Campaign 027: Deep Hardening

Baseline `832971c` (Campaign 026 closed VALIDATED). Four read-only forensic
scouts on 2026-09-13 over: deferred findings in `KNOWN_ISSUES`/`VALIDATION`,
test coverage/quality, performance/reliability, and docs/DX/cleanliness/
security. Every item below carries file evidence; the full reports are
summarized here with priorities.

## A. Correctness / functional (W1)

| # | Finding | Evidence | Prio | Status |
|---|---|---|---|---|
| A1 | Adaptive sessions never escalate; challenge rating records the minimum | `games/spatial-coordinate-turn/reducer.ts:159-167`, `screen.tsx:195-199`, `__tests__/screen.test.tsx:356` | P2 | REAL |
| A2 | Vigilance digit stays visible after the trial resolves | `games/attention-sustained-vigilance/screen.tsx:343-344`, `reducer.ts:143,262` | P3 | REAL |
| A3 | Dead `show-stimulus`/`show-flip-cue` actions; flip-cue unguarded | `games/flexibility-color-stroop/types.ts:172,174`, `reducer.ts:135-143` | P3 | REAL |
| A4 | `fastestReactionMs: Infinity` serializes to JSON `null` behind a `number` type | `games/speed-color-match/types.ts:64,75,100`, `session.ts:85`, `db/sessions.ts:149-151` | P3 | REAL |
| A5 | Dead `roundTimeMs` budget in an untimed game (also in generatorInfo) | `games/language-word-scramble/difficulty.ts:17-29`, `session.ts:59` | P3 | REAL |
| A6 | Adaptive step fallback ignores reached values (unreachable today) | `games/spatial-coordinate-turn/difficulty.ts:193-199` | P3 | REAL |
| A7 | Late-tap SFX mismatch | resolved in Campaign 024; tests pin it | P3 | FIXED |
| A8 | Missing vigilance screen test | `games/attention-sustained-vigilance/__tests__/screen.test.tsx` exists | P3 | FIXED |
| A9 | Stale word-scramble tutorial copy | `components/tutorial.tsx:51-54` matches untimed design | P3 | FIXED |

## B. Performance / startup (W2)

- **P1 — unbounded hot-path reads.**
  `progression/sync.ts:36,79-83` passes `Number.MAX_SAFE_INTEGER`, bypassing
  the documented 5000-sample cap, and runs at startup plus **every Profile
  focus** (`app/(tabs)/profile.tsx:214-215`), followed by a second full
  `listLightweight` scan at `:243-246`. Progress loads all sessions/ratings
  (`analytics/queries.ts:32,51-52,64`). Measured probe: quest eval 71-122 ms
  @5k desktop (`scripts/perf/baselines/perf-sync-scan-before-2026-08-22.json`);
  later baseline 34.9 ms @5k / 55.2 ms @20k (`…2026-08-29…json`).
  Statement-count guard: `src/__tests__/perf-db-query-patterns.test.ts:116-172`.
- **P2 — `progress-snapshot-load` multi-second on a 1-row DB.**
  Emitter `sdk/perf.ts:222-224`; bracketed call `analytics/projections.ts:96-106`;
  the SQL is a LIMIT-1 indexed lookup, so the multi-second duration is
  event-loop/bridge latency at startup, not scan cost. Needs phase marks to
  attribute (dev-only channel: `perf.ts:119`).
- **P2 — startup blocking.** `app/_layout.tsx:156-158` awaits DB init +
  `initializeProgression`; 53 serial upserts (`progression/seeding.ts:23-28`);
  `ensureSchemaGuards` re-executes every canonical trigger DDL each boot
  (`db/migrate.ts:89-93`).
- **P2 — export double canonicalization** (`data-portability/serialize.ts`,
  4.9 s + 1.1 s @5k measured) while bytes/checksum must stay identical
  (`roundtrip.test.ts`).
- **P3 — small-table unindexed sorts** (`achievements.listUnlocks`,
  `workout.countCompleted`) — acceptable at current sizes; documented only.

## C. Reliability / testing (W3)

- Only **4/41** game screens test the save-failure path
  (`language-word-chain`, `flexibility-task-switch`, `spatial-fold-match`,
  `spatial-coordinate-turn`); owner `components/game-host/use-game-session.ts`.
- Route failure-path gaps: `app/rewards.tsx` (no UI test at all),
  `app/(tabs)/profile.tsx:449-476` purchases, `app/storage-unavailable.tsx`
  retry-success, `app/results.tsx` advance failure, `app/data-management.tsx`
  mid-wipe failure, export write rejection (no ENOSPC/EACCES coverage).
- `math-value-ordering` is the only registered game without a screen test.
- Weak patterns: trivial `toBeTruthy()` (197), snapshot-only behavior
  (`visual-baselines.test.tsx`), real-timer sleeps in
  `rewards/__tests__/celebration.test.tsx`. No `.skip/.only/todo` abuse;
  5 opt-in perf probes gated by `PERF_PROBE`.
- Reusable infrastructure: `db/__tests__/helpers.ts` (migrated in-memory DB),
  `test-utils/**` (clock, seeded RNG, fixtures, game-screen factories — currently
  under-used), `data-portability/__tests__/helpers.ts`, router normalizer.

## D. Tooling / CI (W4)

- `validate-workflows.mjs:26-46` covers only 3 shell rules; cannot catch
  unpinned `uses:`, unenforced `continue-on-error`, or missing `fetch-depth`.
- Unpinned actions in all four workflows (e.g. `app-ci.yml:27,34,106,133,147`).
- No dependency-audit gate in CI despite `DEPENDENCY_AUDIT.md:55`.
- `validate-affected.mjs:126-130` duplicate object keys (harmless, cleanup).

## E. Documentation truth (W5)

- ADR-0005 says adjacency differentiation is future/FALSE; code enforces it
  (`games/memory-pattern-tap-back/generator.ts:4,90,121,129`, `difficulty.ts:116`,
  `__tests__/generator.test.ts:111`).
- `MASTER_PLAN.md:3,9,20` still frames bootstrap/Phase-1 as current.
- `GAME_SDK.md:3,48,67,108` still frames rating/XP as Phase 2.
- `apps/mobile/README.md` is the untouched Expo template (wrong `app` dir).
- `ANDROID_AUTOMATION.md:41,268` says default AVD `braintraining35`;
  `scripts/android/common.sh:17` defaults `braintraining-qa36`.
- `PROJECT_CONSTITUTION.md:4` stale bootstrap status line.
- `docs/adr/0004` version pins stale after the campaign-020 lift.
- `.agent/GOAL.md:25-27` “current owner directive” is long executed.
- KNOWN_ISSUES stale: late-tap (fixed), vigilance test (exists), HUD progress
  (41/42 wired; only the time-boxed `memory-sequence-memory` omits it),
  tab labels (forced labeled), xp_awards (misclassified — CAS-gated writers),
  sync cap (bypassed in production; stale timing figure).

## F. Cleanup (W6)

- High-confidence zero-reference exports: `MasteryCard`,
  `analytics/format.ts formatCompact`, `achievements/evaluate.ts accuracyThreshold`,
  `data-portability/checksum.ts canonicalSha256Hex`,
  `serialize.ts serializeBackupChunks`, `workout/reasons.ts explainDailyWorkout`,
  `logic-rule-grid/solver.ts isUniquelySolvableBoard`/`targetDepthForLevel`,
  plus unused version/alias exports.
- Unreferenced scripts: `scripts/generate-word-match-pack.mjs`,
  `scripts/qa/pause-probe.mjs`; stray tracked log `scripts/qa/certify-run.log`.
- Provenance allowlist has 22 permanently-inert entries (no `expires`).
- Stale `offline-boundary.test.ts:26` campaign-003 TODO.

## G. Security posture (no P0/P1)

- No secrets/console leakage; QA hooks strictly dev-gated and contract-tested;
  import/export validates discriminator + checksum; file transport rejects
  traversal names. Secrets scanner has no allowlist (no dead entries).
- Accepted: 16 build/dev-toolchain advisories (KNOWN_ISSUES classification);
  no production-reachable advisory found.

## Explicit NOT-in-scope

Feature work, redesign, new native dependencies, cloud/sync/AI/monetization,
dependency-major upgrades, external evidence classes (store signing, manual
TalkBack, SAF sheets, physical device, iOS runtime).
