# Audit map — 080-native-product-quality

Maps each planned work area to its write surfaces, required validation, and
evidence destination. Orchestrator-owned unless noted; no parallel writer
shares a surface.

| Area | Write surfaces | Required validation | Evidence |
|---|---|---|---|
| Campaign activation | `openspec/changes/080-*/**`, `.agent/**` | `validate-repo-state.mjs`, strict OpenSpec, spec-store `--check` | repo-state PASS |
| Native game QA matrix + sweep | `scripts/qa/native-game-sweep.mjs` (new), `scripts/qa/native-coverage-ledger.json` (generated), `qa-artifacts/080/**` (gitignored) | harness self-test + negative control, ledger matches registry | `native-coverage-matrix.md` |
| Critical journeys (B) | none (runtime execution) + focused regression tests under `apps/mobile/src/**/__tests__/**` | focused + full Jest, native journey evidence | `gameplay-regression.md` |
| Performance (C) | `apps/mobile/src/components/**`, `apps/mobile/src/hooks/**` (named hot paths) | `npm run perf:probe`, before/after measurement, full Jest | `performance.md` |
| Visual/UX (D) | self-contained `apps/mobile/src/games/<id>/**` modules | focused Jest, native screenshots | `visual-accessibility.md` |
| Accessibility/responsive (E) | `apps/mobile/src/components/ui/**` primitives (orchestrator-converged) | a11y audit, native profile captures | `visual-accessibility.md` |
| Persistence/offline (F) | focused tests under `apps/mobile/src/db/**`, `apps/mobile/src/data-portability/**` | focused Jest, native offline journey | `persistence-offline.md` |
| Platform/governance (H) | `docs/certification/**`, `.agent/GOVERNANCE.json`, `.github/**` | API read-back, dependency gate | `platform-readiness.md`, `governance.md` |
| Certification + close (I) | `docs/certification/080-*/**`, `.agent/**` | independent review, all four workflows green at final SHA | `release-matrix.md`, `handoff.md`, `executive-report.md` |
