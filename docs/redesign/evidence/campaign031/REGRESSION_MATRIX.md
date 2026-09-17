# Campaign 031 regression matrix

Date: 2026-09-17
The implementation/evidence results below were validated before the final
implementation push `ad15e23d386e453590aae69cb33c4c427c27e1b8`; the terminal
documentation checkpoint adds no product source changes.

## Repository and source gates

| Area | Command/evidence | Result |
| --- | --- | --- |
| TypeScript | `cd apps/mobile && npm run typecheck` | PASS |
| Lint | `cd apps/mobile && npm run lint` | PASS |
| Focused changed surfaces | GameHost, shared Results, in-game actions, `/results`, Home, visual baselines | PASS; 4 suites / 26 tests in final focused rerun; visual snapshots 5/5 |
| Workout/persistence | Existing workout, reconcile, lifecycle, session/provenance, advance and persistence suites in full Jest | PASS within full suite |
| GameHost/results | `src/components/game-host/__tests__` plus changed route suites | PASS |
| Reward/XP/rating idempotency | Clean AVD replay + existing exact-once Jest suites; SQLite invariant query | PASS; 4 sessions / 4 ledger / 7 ratings, duplicate keys 0 |
| Representative families | 8 changed-shell canary suites: visual search, memory, reaction, math, language, logic, flexibility, spatial | PASS; 8 suites / 82 tests |
| Full CI-mode Jest | `npm run test:ci -- --json --outputFile=D:\Temp\campaign031-runtime\jest-summary.json` | PASS; 553/557 suites, 6549/6554 tests, 0 failures, 5 snapshots; 5 allowlisted skips |
| Jest signal | `node scripts/certification/validate-jest-signal.mjs --summary ...` | PASS; 5 classified, 0 unclassified/ambiguous/unexpected |
| Registry | `node scripts/generate-game-registry.mjs --check` | PASS; generated registry up to date |
| Provenance | `node scripts/validate-provenance.mjs --check --base=5e9d300` and `--self-test` | PASS; no drift, self-test 5/5 |
| Offline | `node scripts/validate-offline.mjs --check` | PASS/CLEAN; 970 source files scanned |
| Secrets | `node scripts/validate-secrets.mjs --check` | PASS/CLEAN; 2112 tracked text files scanned |
| Workflow hygiene | `node scripts/validate-workflows.mjs` and `--self-test` | PASS; 4 files, self-test 44/44 |
| Dependency policy | `node scripts/validate-dependency-audit.mjs` | PASS; 5 accepted advisories, no unallowlisted moderate+ production finding |
| Ownership | `node scripts/validate-task-ownership.cjs` | PASS |
| Affected map | `node scripts/validate-affected.mjs --check-sync` | PASS; 15 areas / 43 patterns |
| Repository state | `node scripts/validate-repo-state.mjs` | PASS; terminal state reports no active campaign and last campaign 031 VALIDATED |
| OpenSpec | `npx --yes @fission-ai/openspec@1.6.0 validate --all` | PASS; Campaign 031 change valid |
| Runtime contract | `node scripts/qa/validate-runtime-qa-contract.mjs` | PASS |
| QA self-tests | `scripts/android/self-test.sh --no-boot` on final installed APK | PASS; 5 passes / 0 failures / 2 warn skips, no host input |

## Native and visual gates

| Area | Evidence | Result |
| --- | --- | --- |
| Android build | `apps/mobile/android/gradlew.bat :app:assembleDebug --no-daemon` | PASS; 353 tasks, 55 executed / 298 up-to-date |
| APK installation | `adb -s emulator-5562 install -r -d -g app-debug.apk` | PASS; exact APK SHA `80E9B291…877D6A` |
| Stateful golden path | Home → first-leg intro/tutorial → gameplay → pause/resume → relaunch → Result → Next ×3 → completion → Home | PASS in light and clean dark runs; direct ADB fallback authorized by 030B |
| Light/dark pixels | `D:\Temp\campaign031-runtime\light` and `dark`; hashes indexed in `BEFORE_AFTER_INDEX.md` | PASS; 1080×2400 nonblank rendered frames |
| Final static capture | `node scripts/qa/ui-capture.mjs ... --surfaces home,game-intro,results --theme light,dark` | PASS; 6/6 nonblank and route-verified; game-intro loading boundary explicitly excluded from dynamic state claim |
| Accessibility | Dynamic and final static `a11y-audit.mjs` | PASS; 0 violations across 70 dynamic / 6 static surfaces |
| Relaunch persistence | Byte compare `db-dark-complete.sqlite` vs `db-dark-relaunch.sqlite` | PASS; identical hash and counts unchanged |
| Crash review | Final installed-app `logcat -d` pattern scan | PASS; 46,002 lines, no fatal/RedBox/invariant pattern |
| Web | `npx expo export --platform web --output-dir ... --no-bytecode` | PASS; 47 bundles / 20 static routes |

## Explicitly not green / not in Campaign 031 scope

| Item | Classification |
| --- | --- |
| `npx expo-doctor` | NOT GREEN: 20/21; 14 SDK patch mismatches, pre-existing maintenance debt explicitly excluded |
| ARTEMIS task trace | NOT VALIDATED: MCP transport closed and CLI stopped at MissingSessionID; direct ADB fallback used under Campaign 030B authorization |
| Independent human usability | PENDING: exact handoff in `HUMAN_VALIDATION_PENDING.md` |
| TalkBack/manual screen reader, physical device, iOS runtime, SAF/system sheets | NOT VALIDATED / deferred environment evidence |
| Campaign 030B Progress Detail 43dp rows | Carried-forward, untouched, out of golden-path scope |
| Existing GitHub zero-step workflow issue | External/pre-step classification; no workflow edits mixed into Campaign 031 |

None of these classifications hides a required Campaign 031 product or
correctness failure. No test allowlist, dependency, schema, or workflow was
weakened to obtain the reported green results.

## Post-closure addendum — final ARTEMIS certification (2026-09-17)

The Campaign 031 ARTEMIS-trace limitation above was resolved after closure. A
fresh Codex to ARTEMIS MCP Flash canary
(`fd39416f-50cb-4927-8c56-47b5d5056a83`) exercised Home to Cue Keeper to a
legitimate interaction/result and back Home on the installed Campaign 031
candidate with the current Metro JS, Muse Spark 1.3 Contributor XHigh only and
no fallback. See `.agent/VALIDATION.md` "Final ARTEMIS migration
certification".
