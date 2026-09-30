# Tasks — 069-dependency-gate-restoration

## 1. Disposition the blocking dependency advisories

- [x] 1.1 Add three `build-dev-toolchain` entries to
      `scripts/certification/dependency-audit-allowlist.json`, one per advisory
      id (`ghsa-q2hr-2g5m-vwhr`, `ghsa-qhr7-859c-m2p7`, `ghsa-6j4f-fj2g-mc7p`),
      each stating the reachability evidence: every path to `brace-expansion`
      runs through `jest`/`glob`/`minimatch` under
      `@testing-library/react-native` or `@expo/fingerprint`, with no
      first-party runtime import.
- [x] 1.2 Update the allowlist's `reviewedAt` and add a `tracking` pointer to
      `.agent/DEPENDENCY_AUDIT.md` for the toolchain-only classification.
- [x] 1.3 Verify the per-advisory scoping still holds: confirm an injected
      advisory id on the same package fails the gate.
- [x] 1.4 Update `.agent/DEPENDENCY_AUDIT.md` with the review date, the
      classification reasoning, and the exit condition that retires the entries
      (toolchain upgrade that drops `glob@7`/`minimatch@3`).

## 2. Hermetic Expo alignment gate

- [x] 2.1 Add a validator that reads `apps/mobile/package.json` and the
      installed SDK's `bundledNativeModules.json` and compares every declared
      Expo-family pin against the range that manifest requires.
- [x] 2.2 Make it fail closed when the manifest is missing or unparseable.
- [x] 2.3 Add `--self-test` with an injected mismatch, following the convention
      of the existing validators, and prove the self-test fails when the
      detector cannot detect the injected fault.
- [x] 2.4 Replace the `Expo doctor` step in `.github/workflows/app-ci.yml` with
      the new validator so the push path requires no network.
- [x] 2.5 Add the validator's self-test to the existing validator self-test
      block in `.github/workflows/repository-integrity.yml`.

## 3. Scheduled upstream drift observation

- [x] 3.1 Add `npx expo-doctor` to the weekly `Repository Integrity` job with
      `continue-on-error: true` and a captured summary classified as upstream
      drift, so a new upstream patch is observed without marking the job failed.
- [x] 3.2 Record in the job comment that App CI is hermetic by design, matching
      the existing rationale used for the `npm audit` gate.

## 4. Distinguish BLOCKED from FAILED

- [x] 4.1 Make the CI step for the dependency audit branch on the exit code so
      exit 2 (could not run) is reported as its own outcome, distinct from
      exit 1 (ran and failed).
- [x] 4.2 Ensure the job summary states, in the blocked case, that the gate did
      not run and that the security posture is therefore unverified for that
      run.
- [x] 4.3 Confirm the audit still exits 0 on a clean run and 1 on a real finding.

## 5. Align OpenSpec validation with the recorded evidence

- [x] 5.1 Change the Repository Integrity step to strict validation and pin the
      CLI to the version the repository's planning artifacts were authored
      against, so CI and local validation cannot disagree.
- [x] 5.2 Re-record the OpenSpec gate result in the durable evidence with the
      CLI version and the strict flag actually used.
- [x] 5.3 Run `openspec validate --all --strict` and record the exact totals.

## 6. Reconcile durable state and governance prose

- [x] 6.1 Amend every `Expo Doctor 21/21` and dependency-audit claim in
      `.agent/VALIDATION.md` and `.agent/STATE.md` with the commit and date at
      which it was observed; add a current-state correction block rather than
      editing history.
- [x] 6.2 Resolve the ACTIVE/COMPLETE contradiction: `.agent/CURRENT_CAMPAIGN.md`
      must not present the completed 056–067 program or its post-067 phase as
      in progress; align `.agent/STATE.md` lines that say "066 open" and
      "COMPLETE" simultaneously.
- [x] 6.3 Update `.agent/GOVERNANCE.json` so the declared gate set covers the
      gates CI actually enforces, so an undeclared red gate is detectable.
- [x] 6.4 Refresh `docs/MASTER_PLAN.md`: correct the current-state banner, extend
      the change index to the present, and mark closure numbers as
      recorded-at-closure.
- [x] 6.5 Fix `docs/hardening/post067/README.md`, which lists a
      `RESIDUAL_CENSUS.md` that does not exist in that directory.
- [x] 6.6 Correct stale counts where they appear in operator-facing docs (for
      example the scanned-file count in `docs/PARITY_MATRIX.md`).

## 7. Repository hygiene

- [x] 7.1 Add `.gitignore` coverage for the assistant-configuration directory
      trees, keeping the existing explicit credential-bearing path exclusions.
- [x] 7.2 Confirm `git status --porcelain` reports no tooling noise and that
      `git check-ignore` reports each tree as ignored.

## 8. Verification

- [x] 8.1 `node scripts/validate-dependency-audit.mjs` exits 0; still exits 1 on
      an injected advisory.
- [x] 8.2 `node scripts/validate-repo-state.mjs` passes after the durable-state
      amendments.
- [x] 8.3 `node scripts/validate-secrets.mjs --check`,
      `node scripts/validate-workflows.mjs`, and
      `node scripts/validate-offline.mjs --check` all pass.
- [x] 8.4 `node scripts/validate-dependency-audit.mjs --self-test` and the new
      alignment validator's `--self-test` both pass.
- [x] 8.5 Confirm no step in `app-ci.yml` requires network access, and state the
      evidence in the change closure.
- [x] 8.6 `npm run typecheck` and `npm run lint` clean (no product code changed,
      so this is a guard against accidental edits).
