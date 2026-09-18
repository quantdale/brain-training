# Campaign 050 Repository Gates

Run date: 2026-09-19. Working source before closure docs: `d67aba5`; no
runtime source or dependency manifest changed during Campaign 050.

| Check | Result | Evidence |
| --- | --- | --- |
| Full Jest | PASS | 559 suites passed, 4 skipped; 6,575 tests passed, 5 skipped; 5 snapshots passed |
| TypeScript | PASS | `npm run typecheck` |
| Lint | PASS | `npm run lint` |
| Expo Doctor | PASS | `npx expo-doctor`, 21/21 checks |
| Dependency policy | PASS | 5 accepted advisories; no unallowlisted moderate+ production finding |
| Web export | PASS | `npx expo export --platform web`, 20 static routes |
| Offline scan | PASS | `node scripts/validate-offline.mjs`, 973 files |
| Secrets scan | PASS | `node scripts/validate-secrets.mjs`, 2,402 tracked text files |
| Workflow validator | PASS | `node scripts/validate-workflows.mjs`, 4 workflow files |
| Runtime-QA contract | PASS | `node scripts/qa/validate-runtime-qa-contract.mjs` |
| Registry generation | PASS | `node scripts/generate-game-registry.mjs --check` |
| Affected-map sync | PASS | `node scripts/validate-affected.mjs --check-sync`, 16 areas / 44 patterns |
| Provenance | PASS | `node scripts/validate-provenance.mjs`, no drift |
| Task ownership | PASS | `node scripts/validate-task-ownership.cjs` |
| OpenSpec | PASS | `npx openspec validate --all`, 35/35 |
| Repository state | PASS | `node scripts/validate-repo-state.mjs` before terminalization; rerun after closure |

The visual baseline snapshot changed only to record the Campaign 049 native
tab label-size repair. The two timestamped performance JSON files are the
current Campaign 050 probe outputs and are intentionally tracked evidence.
