# Task Packet 001-f — Validation/CI/Recovery Proof (WP-F)

Campaign: 001-autonomous-foundation
Status: READY
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

(agent fills in)
