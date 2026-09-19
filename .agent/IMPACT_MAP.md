# Affected-Area Validation Map

Executable rules live in `scripts/validate-affected.mjs` (`RULES`). This table is the human-readable mirror; `node scripts/validate-affected.mjs --check-sync` fails when the backticked path patterns here and `RULES` diverge (counts alone are not sufficient), and CI runs that check.

| Changed area (patterns) | Minimum light validation |
|---|---|
| `scripts/android/**` — Android setup/diagnostics | ARTEMIS runtime-QA contract; no-host-input proof; screenshot/log artifact check |
| `.github/**`, `scripts/**`, `apps/mobile/scripts/**` — CI/scripts | run script locally where possible; validate workflow syntax/behavior through GitHub Actions |
| `apps/mobile/src/app/**`, `apps/mobile/src/components/app-tabs*.tsx`, `apps/mobile/src/components/game-host/**`, `apps/mobile/src/bootstrap/**`, `apps/mobile/src/routing/**` — app navigation/shell | typecheck; affected unit tests; app launch + navigation smoke |
| `apps/mobile/src/components/discovery/**` — Games discovery and identity surfaces | typecheck; focused Games/GameCard/Game Detail tests; light/dark runtime capture and accessibility audit |
| `apps/mobile/src/workout/**`, `apps/mobile/src/db/workout*.ts`, `apps/mobile/src/db/__tests__/workout*.ts` — workout | `npm run test:ci -- src/workout src/db/__tests__/workout`; typecheck; attribution/adversarial matrix if routing/ownership touched |
| `apps/mobile/src/personalization/**`, `apps/mobile/src/mastery/**`, `apps/mobile/src/spotlight/**` — personalization/mastery/spotlight | `npm run test:ci -- src/personalization src/mastery src/spotlight`; typecheck; determinism checks |
| `apps/mobile/src/sync/**`, `apps/mobile/src/data-portability/**`, `apps/mobile/src/persistence/**` — sync/data-portability | `npm run test:ci -- src/sync src/data-portability`; typecheck; export/wipe/import round-trip if envelope changed |
| `apps/mobile/src/content/**`, `apps/mobile/src/registry/**`, `apps/mobile/src/games/**/content/**`, `apps/mobile/src/games/**/registry/**`, `scripts/generate-game-registry.mjs`, `scripts/validate-provenance.mjs` — content/registry/provenance | `npm run test:ci -- src/content`; registry `--check`; provenance check; content validation |
| `openspec/**`, `.agent/**`, `AGENTS.md`, `docs/**`, `apps/mobile/src/governance/**` — OpenSpec/governance | `node scripts/validate-repo-state.mjs`; `node scripts/validate-task-ownership.cjs`; OpenSpec validate; doc/reference consistency |
| `apps/mobile/src/db/**`, `apps/mobile/src/persistence/**`, `apps/mobile/src/storage/**` — SQLite/schema/migrations | migration tests; persistence tests; launch; representative read/write smoke |
| `apps/mobile/src/sdk/**`, `apps/mobile/src/game-sdk/**` — Game SDK shared contracts | typecheck; SDK unit/contract tests; representative canary games; app launch |
| `apps/mobile/src/games/**` — individual game module | typecheck; game unit/contract tests; targeted emulator smoke for that game |
| `apps/mobile/src/scoring/**`, `apps/mobile/src/rating/**` — scoring/rating | normalization/rating unit tests; representative fixed-seed fixtures; regression samples |
| `apps/mobile/src/currency/**`, `apps/mobile/src/progression/**`, `apps/mobile/src/ledger/**` — currency/progression | transaction-ledger/progression tests; persistence reload smoke |
| `apps/mobile/src/components/ui/**`, `apps/mobile/src/constants/theme.ts`, `apps/mobile/src/design/**` — visual/design-system shared layer | typecheck; affected screenshots + representative canary screens |
| `apps/mobile/package.json`, `apps/mobile/package-lock.json` — package manifest/lockfile | clean dependency install; repository validator; available typecheck/build |

Full catalog, stress, broad visual regression, failure injection, and deep performance profiling belong to explicit hardening campaigns unless a Critical/High issue requires targeted repair.
