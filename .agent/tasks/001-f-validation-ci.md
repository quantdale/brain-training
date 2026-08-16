# Task Packet 001-f — Validation/CI/Recovery Proof (WP-F)

Campaign: 001-autonomous-foundation
Status: DONE
Owner role: coder agent

## Objective

Expand repository validation and CI to cover the real app, and produce the campaign's proof-of-recovery artifacts:

- Extend `.github/workflows/repository-integrity.yml` (or add a new `app-ci.yml`) to run: repo-state validator, `npm ci` in `apps/mobile`, `npx tsc --noEmit`, `npm test` (jest, `--ci`), and `npx expo export --platform web` build smoke (or `expo-doctor` if export is impractical in CI).
- Add `scripts/validate-affected.mjs` (or extend the existing validator) — a risk-based affected-area validation entrypoint: accepts a list of changed paths and prints the required light-validation checks per `.agent/IMPACT_MAP.md`.
- Structured failure artifacts: document `qa-artifacts/` layout (screenshots, logcat, hierarchy dumps, exit codes) in `docs/QA_ARTIFACTS.md`.
- Day/night usage notes: confirm `.agent/modes/DAY.md` and `NIGHT.md` remain accurate and reference them from docs.
- Fresh-session recovery drill: write `docs/RECOVERY_DRILL.md` with the exact procedure a fresh agent follows (startup protocol) and evidence of a dry run in this repo.
- Swarm/convergence drill: document the wave-1 packet partitioning in `.agent/tasks/` (already exists) and record the convergence evidence (which files the orchestrator merged).

## Dependencies

- Orchestrator scaffold commit (app + jest infra) and wave-1 packets.

## Allowed write surfaces

- `.github/workflows/**`
- `scripts/validate-*.mjs` and any new root-level validation scripts (NOT `scripts/android/**` — owned by 001-d)
- `docs/RECOVERY_DRILL.md`, `docs/QA_ARTIFACTS.md`, and edits to existing docs for accuracy
- `.agent/` evidence sections ONLY for the drill records you produce (prefer `docs/` for full prose)

## Forbidden / shared write surfaces

- `apps/mobile/**` (report any needed app-side change to orchestrator)
- `scripts/android/**`
- Lockfiles, package manifests

## Completion criteria

- CI workflow covers the checks listed above; YAML is syntactically valid (validate locally with a YAML parser if available; GitHub will be the final gate).
- `scripts/validate-affected.mjs` runs and maps sample paths to checks.
- `docs/RECOVERY_DRILL.md` and `docs/QA_ARTIFACTS.md` exist and match repo reality.
- Local run of every new root script passes.

## Cheap validation

- `node scripts/validate-affected.mjs <sample paths>`
- `bash -n` equivalents / `node --check` on new scripts
- YAML parse check

## Integration notes for orchestrator

- CI runs on GitHub; orchestrator will verify workflow results after push.

## Result/evidence

Filled in 2026-08-16 by WP-F coder agent (status: DONE, one orchestrator-owned fix required).

Files created:
- `.github/workflows/app-ci.yml` — repo validator, `npm ci`, typecheck, `jest --ci`, `expo export --platform web`, `expo-doctor` (21/21 local)
- `scripts/validate-affected.mjs` — affected-area validation entrypoint; mirrors `.agent/IMPACT_MAP.md` (11 areas, drift-guard warning); supports `--json`, `--strict`, `--list-areas`; exit 0/1/2
- `docs/QA_ARTIFACTS.md` — `qa-artifacts/<run-id>/` layout (run.json manifest, exit-codes, screenshots, logcat, hierarchy, video, app), capture commands, exit-code conventions
- `docs/RECOVERY_DRILL.md` — fresh-session recovery procedure + dry-run evidence table (2026-08-16), day/night mode references, wave-1 swarm/convergence drill record (wave-0 merge evidence from commit cc40262; wave-1 convergence IN PROGRESS, orchestrator appends on merge)

Local validation:
- `node scripts/validate-affected.mjs` sample runs: PASS (mapping, unmatched flagging, json/strict modes)
- YAML parse of both workflows: PASS (node `yaml` parser)
- `node scripts/validate-repo-state.mjs`: PASS
- `cd apps/mobile && npm run test:ci`: PASS (1 suite / 1 test)
- `cd apps/mobile && CI=1 npx expo export --platform web`: PASS (3 bundles, 4 static routes)
- `cd apps/mobile && npx expo-doctor`: PASS (21/21)
- `cd apps/mobile && npm run typecheck`: FAIL — pre-existing; `@types/jest` missing (see dependency needs)

Dependency needs (orchestrator-owned, apps/mobile forbidden to WP-F):
- add `@types/jest@~29.5.x` to `apps/mobile` devDependencies → typecheck green; ADR-0004 note "typecheck requires an expo command first" is stale (expo-env.d.ts committed; `expo export` does not generate `.expo/types`).

Integration notes:
- 001-d harness should write artifacts per `docs/QA_ARTIFACTS.md` (`qa-artifacts/<run-id>/run.json` last, atomic); local `qa-artifacts/` skeleton created (gitignored).
- CI runs on GitHub; orchestrator verifies workflow results after push.
