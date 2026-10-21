# Governance report — Campaign 079 release certification

**Date:** 2026-10-21 · **Source revision:** `0e1c8784` (settings configured and
verified after this commit; they are repository settings, not tracked files)
**Verification method:** GitHub REST API read-back after configuration.

## Workflow enforcement audit (G1)

| Workflow | Triggers | Jobs / check names | Network needs | Skip/hide risk |
|---|---|---|---|---|
| App CI | `push: main`, `pull_request`, `workflow_dispatch` | `Mobile app build/typecheck/tests` | npm registry (`npm ci`) | None found; steps are fail-closed |
| Android Build Smoke | `push: main`, `pull_request`, `workflow_dispatch` | `Android clean native build` | npm registry + Android SDK | None found |
| iOS Build Smoke | `push: main`, `pull_request`, `workflow_dispatch` | `iOS Simulator compile smoke` | npm registry + CocoaPods | None found |
| Repository Integrity | `push: main`, `pull_request`, `workflow_dispatch`, weekly schedule | `durable-state`, `coverage-floors` (scheduled-only, reports `skipped` on push) | npm advisory service (dependency-audit; exit 2 = BLOCKED, never a pass) | Shell-hygiene gate (`validate-workflows.mjs`) prohibits `yes \|` / `\|\| true` masking constructs |

All four workflows run on pull requests, so required checks can never create a
circular merge requirement. Check-run names were confirmed against the checks
API for `0e1c8784` before being used as required contexts (job `durable-state`
is the Repository Integrity job; `coverage-floors` is intentionally not
required because it is scheduled-only).

## Branch protection (G2) — ACTIVE, API-verified

`GET /repos/quantdale/brain-training/branches/main/protection` (2026-10-21):

- Required status checks: `Mobile app build/typecheck/tests`,
  `Android clean native build`, `iOS Simulator compile smoke`, `durable-state`
- `strict: true` — a PR branch must be up to date with `main` before merge
  (stale-check invalidation: new pushes to a PR re-run all checks; a stale base
  forces re-merge and re-validation)
- `enforce_admins: false` — administrator bypass is explicit (see policy below)
- `allow_force_pushes: false`, `allow_deletions: false`
- No PR-review requirement (single-owner repository; direct-push model kept)

`GET /repos/quantdale/brain-training/rulesets/25523614` (2026-10-21):

- Ruleset **"protect main"**, `enforcement: active`, target `~DEFAULT_BRANCH`
- Rules: `non_fast_forward`, `deletion`
- `bypass_actors: []` — `current_user_can_bypass: never`; force-push and branch
  deletion are blocked **even for administrators**

### Administrator bypass authority — explicit handling

Administrators bypass the *classic* rule only (direct pushes without pre-push
check status), which preserves this repository's documented autonomous
direct-push integration model. The bypass never authorizes force-push (the
ruleset blocks it for everyone), never excuses skipping the `greenMain`
local-check rule in `.agent/GOVERNANCE.json`, and must not land changes whose
required local checks failed. Emergency history recovery requires explicit
owner authorization plus a temporary ruleset change that is restored
immediately afterward.

### Integration procedure

- Human/normal changes: branch + pull request; all four required checks green
  and branch up to date with `main` before merge.
- Autonomous waves: local `greenMain` checks first, then commit + direct push.
- A rejected direct push indicates a changed protection profile: investigate
  before any workaround.

## Known platform limits

- Protection was verified through the REST API and an actual direct push (the
  governance-alignment commit following `0e1c8784`). A negative force-push test
  was deliberately NOT executed: repository policy forbids force-pushing `main`
  even to test, and the ruleset reports `current_user_can_bypass: never`.
- `coverage-floors` remains scheduled-only by decision (see GOVERNANCE
  `enforcedGateSet.scheduledOnlyGates`); its `skipped` conclusion satisfies
  neither more nor less than its declared status.
