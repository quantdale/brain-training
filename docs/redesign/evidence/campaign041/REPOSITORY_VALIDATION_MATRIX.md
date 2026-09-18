# Repository Validation Matrix

All commands below were run against the current synchronized tree. “PASS” means the command actually completed successfully; “NOT VALIDATED/BLOCKED” is used where the tool could not provide the requested signal.

## Complete current matrix

| Check | Command / scope | Result |
|---|---|---|
| Repository state | `node scripts/validate-repo-state.mjs` | `[VERIFIED_TEST]` PASS; no active campaign, last campaign 040, status VALIDATED, concurrency 7, one emulator. |
| Ownership | `node scripts/validate-task-ownership.cjs` | `[VERIFIED_TEST]` PASS. |
| Affected map | `node scripts/validate-affected.mjs --check-sync` | `[VERIFIED_TEST]` PASS; 16 areas / 44 patterns. |
| Generated registry | `node scripts/generate-game-registry.mjs --check` | `[VERIFIED_TEST]` PASS. |
| Provenance | `node scripts/validate-provenance.mjs --check` | `[VERIFIED_TEST]` PASS; no changed product files at the starting product SHA. |
| Offline boundary | `node scripts/validate-offline.mjs --check` | `[VERIFIED_TEST]` CLEAN across 973 source files. |
| Secrets | `node scripts/validate-secrets.mjs --check` plus self-test | `[VERIFIED_TEST]` CLEAN across 2,266 tracked text files; self-test PASS. |
| Workflow hygiene | `node scripts/validate-workflows.mjs` | `[VERIFIED_TEST]` PASS across 4 workflow files. |
| Dependency policy | `node scripts/validate-dependency-audit.mjs` | `[VERIFIED_TEST]` PASS under repository policy: five accepted advisory families, no unallowlisted moderate+ production finding. Raw `npm audit` is separately recorded in the security document and is not claimed green. |
| Runtime-QA contract | `node scripts/qa/validate-runtime-qa-contract.mjs` | `[VERIFIED_TEST]` PASS. |
| OpenSpec | `npx --yes @fission-ai/openspec@1.6.0 validate --all` | `[VERIFIED_TEST]` 26 passed, 0 failed. |
| Full Jest CI | `npm run test:ci -- --silent --json --outputFile=jest-summary-campaign041.json` | `[VERIFIED_TEST]` exit 0; 557 passed / 4 skipped suites out of 561; 6,568 passed / 5 skipped tests out of 6,573; 5 snapshots passed; 0 failed. |
| Jest signal classification | `node scripts/certification/validate-jest-signal.mjs --summary ...` | `[VERIFIED_TEST]` PASS; all 5 skips classified, 0 unclassified/ambiguous warnings. |
| Typecheck | `npm run typecheck` | `[VERIFIED_TEST]` PASS. |
| Lint | `npm run lint` | `[VERIFIED_TEST]` PASS. |
| Expo Doctor | `npx expo-doctor` | `[VERIFIED_TEST]` PASS 21/21. |
| Web export | `npx expo export --platform web` | `[VERIFIED_BUILD]` PASS; 47 bundles, 20 static routes. |
| Android debug | `apps/mobile/android/.gradlew.bat assembleDebug --no-daemon` | `[VERIFIED_BUILD]` PASS; 458 actionable, 55 executed, 403 up-to-date. |
| Android release | `apps/mobile/android/.gradlew.bat assembleRelease --no-daemon` | `[VERIFIED_BUILD]` PASS; 571 actionable, 57 executed, 514 up-to-date. |

## Explicit opt-in/skipped probes

The normal Jest run intentionally skips five expensive tests. They were not accepted as “known skips”; each was executed directly using its documented opt-in flag.

| Probe | Why normal run skips it | Direct result |
|---|---|---|
| `perf-baseline-probe.test.ts` | Expensive performance timing | `[VERIFIED_TEST]` PASS, 1/1, 6.395s; 5,000/20,000 session projections completed. |
| `perf-sync-scan-probe.test.ts` | Expensive scan/evaluation timing | `[VERIFIED_TEST]` PASS, 1/1, 3.382s; 100/1,000/5,000/20,000 cases. |
| `perf-quest-eval-ab.test.ts` | Expensive quest-engine comparison | `[VERIFIED_TEST]` PASS, 1/1, 3.28s; active quests 9; all compared paths completed. |
| `projections-differential.test.ts` | Expensive legacy-vs-projection differential | `[VERIFIED_TEST]` PASS, 18/18, 8.723s; equivalence held through 20,000 records. |
| `large-backup-memory.test.ts` | Large memory/GC probe | `[VERIFIED_TEST]` PASS, 1/1, 11.655s; 20,000 sessions, 15,228,503 UTF-16/bytes-equivalent payload, heap delta 109.4 MB, RSS delta 162.5 MB, post-GC evidence present. |

No skip was classified obsolete, flaky, or currently failing. The normal skip mechanism is intentionally expensive-only, and the direct runs passed.

## Focused high-risk coverage

- `[VERIFIED_TEST]` Migration/data-portability: 13 suites / 172 tests passed in 14.169s, including v1..v11 matrix, robustness, v10 hardening, schema guards, integrity, portability rollback/round-trip/wipe/apply attacks.
- `[VERIFIED_TEST]` Catalog/lifecycle automation: 12 suites / 267 tests passed in 22.015s, including SDK/workout lifecycle, registry, content, metadata, provenance, reconcile, advance, and session advance.
- `[VERIFIED_TEST]` Targeted invariants: 27 suites / 262 tests passed in 27.49s, including rewards, economy, rating, session identity, workout, settings concurrency, quest/achievement claims, offline boundary, and GameHost guards.

The exactly-once tests use real migrations/triggers and cover double claim, interleaving, rollback/crash windows, operation-ID dedupe, append-only writes, and duplicate rating/session prevention. The `GameResults` unit test is presentational; authoritative writes are covered in DB/GameHost tests. Passing tests do contain known mock noise: one results-workout-CTA mock does not model `db.workouts.reconcile`, and a settings mock emits route warnings. These are test-quality observations, not hidden product failures.

## Test-quality conclusion

`[INFERRED]` The high-risk persistence/economy tests model the authoritative database paths better than the historical snapshot-only claims. Remaining gaps are explicit: no full physical/iOS/human accessibility test, no complete manual mechanic mastery across 42 games, no historical on-disk fixture for every migration start version, and no successful external CI step execution.

