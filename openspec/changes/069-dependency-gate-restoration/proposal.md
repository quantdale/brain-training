# Change 069 — Dependency Gate Restoration and Durable-Claim Integrity

## Why

Two of the repository's own CI gates are **red on `main` right now**, while the
durable state asserts that the same gates are green:

1. `npx expo-doctor` exits **1** — 20 of 21 checks pass; six Expo packages are
   behind the patch family the tool requires. `app-ci.yml` runs it as the last
   step with no `continue-on-error`, so every push and every pull request reports
   the workflow as failed.
2. `node scripts/validate-dependency-audit.mjs` exits **1** — three
   unallowlisted `brace-expansion` advisories (two rated *high*, both
   uncontrolled-recursion stack exhaustion).

Both gates are correct to exist. The problems are that neither is described
honestly, and one of them is structurally incapable of being a per-push gate.

`expo-doctor` resolves its expected versions from
`https://api.expo.dev/v2/versions/latest` — a network fetch — not from the
repository. The installed SDK's own bundled manifest
(`node_modules/expo/bundledNativeModules.json`) matches the declared pins
**exactly**. So the gate turns red with zero repository changes whenever Expo
publishes a patch, and it is the same class of failure that already red-flagged
CI during campaign 015. This also violates a decision the repository already
made: Change 064 moved the network-dependent `npm audit` gate out of hermetic
App CI for exactly this reason.

The `brace-expansion` advisories are reachable **only** through build/test
tooling (`expo-router` → `@testing-library/react-native` → `jest` → `glob` →
`minimatch`, and `expo` → `@expo/fingerprint` → `minimatch`); no first-party
runtime import path exists. The allowlist policy already documents precisely
this disposition (`build-dev-toolchain`, accepted while the vulnerable code
never ships). The advisories arrived after the allowlist was last reviewed
(`reviewedAt: 2026-09-13`), so the correct action is a reviewed allowlist entry
with reachability evidence — not a version bump, and not a suppressed gate.

Meanwhile `.agent/VALIDATION.md` and `.agent/STATE.md` assert an unqualified
`Expo Doctor 21/21` in eleven-plus places, `.agent/DEPENDENCY_AUDIT.md` and
`README.md` state the audit is clean, `.agent/CURRENT_CAMPAIGN.md` declares
`Status: ACTIVE` while the registered program is `COMPLETE`, and
`docs/MASTER_PLAN.md` is roughly forty changes stale. `.agent/GOVERNANCE.json`
forbids exactly this: a failing required check may be pushed only as a
documented blocker, "never labeled green".

## What Changes

- **Restore the dependency-audit gate honestly.** Add reviewed
  `build-dev-toolchain` allowlist entries for the three `brace-expansion`
  advisories, each with the reachability evidence that the vulnerable code
  never ships, plus the tracking pointer. New advisories on those packages
  continue to fail the gate (the existing per-advisory policy is preserved — an
  entry waives one package + one advisory id, never the package).
- **Make Expo alignment hermetic and offline.** Add a validator comparing the
  declared Expo-family pins against the *installed* SDK's bundled
  native-module manifest, with a `--self-test`, and run it in App CI on every
  push. It needs no network and answers the question that actually indicates a
  repository defect.
- **Move the network-dependent doctor run out of the hermetic push path** into
  the existing weekly `Repository Integrity` schedule, where network-dependent
  gates already live, classified as upstream drift so a patch release does not
  train operators to ignore the job.
- **Distinguish BLOCKED from FAILED for the dependency audit.** Today exit 2
  (could not run) is indistinguishable from exit 1 (ran and failed) to a bare
  `run:` step, so an environment outage is silently reported as a pass.
- **Restore durable-claim integrity.** Amend the gate claims to state the
  commit and date they were observed at, correct the ACTIVE/COMPLETE
  contradiction in the governance prose, and refresh `docs/MASTER_PLAN.md`.
- **Ignore local agent tooling** so working-tree status stays a meaningful
  signal and machine-specific tool state cannot be committed.

## Capabilities

### New Capabilities

- `dependency-gate-integrity`: how dependency alignment is enforced hermetically
  in the push path, how advisory dispositions are evidenced, and how recorded
  gate results and governance status are kept truthful.

### Modified Capabilities

None. No existing capability spec exists under `openspec/specs/`.

## Impact

- `.github/workflows/app-ci.yml` — replace the network doctor step with the
  hermetic alignment validator.
- `.github/workflows/repository-integrity.yml` — scheduled doctor run with drift
  classification; distinguish audit BLOCKED from FAIL.
- `scripts/validate-dependency-audit.mjs` — distinct, machine-readable BLOCKED
  reporting for the CI step.
- `scripts/certification/dependency-audit-allowlist.json` — three reviewed
  entries with reachability rationale and tracking.
- `scripts/` (new) — hermetic Expo alignment validator + `--self-test`, wired
  into the existing validator self-test block.
- `apps/mobile/package.json` — only if a policy decision pins the six packages
  forward (optional follow-up; not required for gate correctness).
- `.agent/{GOVERNANCE.json,STATE.md,CURRENT_CAMPAIGN.md,VALIDATION.md,DEPENDENCY_AUDIT.md,BACKLOG.md}`,
  `README.md`, `docs/MASTER_PLAN.md`, `docs/hardening/post067/README.md`.
- `.gitignore` — assistant-configuration directories.
- No product code; no user-visible behavior change.
