# Affected-Area Validation Map

Executable rules live in `scripts/validate-affected.mjs` (`RULES`). This table is the human-readable mirror — keep rows and `RULES` in sync (validator warns when counts diverge).

| Changed area | Minimum light validation |
|---|---|
| `AGENTS.md`, `.agent/**`, `docs/**`, `openspec/**` (OpenSpec/governance) | `node scripts/validate-repo-state.mjs`; `node scripts/validate-task-ownership.cjs`; `npx @fission-ai/openspec validate --all`; doc/reference consistency |
| `apps/mobile/src/workout/**` (workout) | `npm run test:ci -- src/workout src/db/__tests__/workout`; typecheck; attribution/adversarial matrix if routing/ownership touched |
| `apps/mobile/src/personalization/**`, `apps/mobile/src/mastery/**`, `apps/mobile/src/spotlight/**` | `npm run test:ci -- src/personalization src/mastery src/spotlight`; typecheck; determinism checks |
| `apps/mobile/src/sync/**`, `apps/mobile/src/data-portability/**` | `npm run test:ci -- src/sync src/data-portability`; typecheck; export/wipe/import round-trip if envelope changed |
| `apps/mobile/src/content/**`, `apps/mobile/src/registry/**`, `scripts/generate-game-registry.mjs` (content/registry/provenance) | `npm run test:ci -- src/content`; `node scripts/generate-game-registry.mjs --check`; provenance check; content validation |
| package manifest/lockfile | clean dependency install; repository validator; available typecheck/build |
| app navigation/shell | typecheck; affected unit tests; app launch + navigation smoke |
| SQLite/schema/migrations | migration tests; persistence tests; launch; representative read/write smoke |
| Game SDK shared contracts | typecheck; SDK unit/contract tests; representative canary games; app launch |
| individual game module | typecheck; game unit/contract tests; targeted emulator smoke for that game |
| scoring/rating | normalization/rating unit tests; representative fixed-seed fixtures; regression samples |
| currency/progression | transaction-ledger/progression tests; persistence reload smoke |
| Android QA harness | harness self-test; no-host-input proof; screenshot/log artifact check |
| visual/design-system shared layer | affected screenshots + representative canary screens |
| CI/scripts | run script locally where possible; validate workflow syntax/behavior through GitHub Actions |

Full catalog, stress, broad visual regression, failure injection, and deep performance profiling belong to explicit hardening campaigns unless a Critical/High issue requires targeted repair.
