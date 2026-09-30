# Lane L08 — build, CI, validators, scripts, dependencies, release config

> STATUS: COMPLETE. Read-only lane; no repository file was modified other than this report.

## Scope covered
- Deeply inspected (read in full or step-by-step):
  - `.github/workflows/repository-integrity.yml` (103 lines, all steps), `.github/workflows/app-ci.yml:1-170` (all 18 steps), `on:`/trigger blocks of `android-build-smoke.yml` and `ios-build-smoke.yml`.
  - `scripts/validate-secrets.mjs` (119), `scripts/validate-affected.mjs:500-551` (arg/exit contract), `scripts/validate-workflows.mjs:489-513`, `scripts/validate-offline.mjs:320-359`, `scripts/validate-repo-state.mjs:40-70 + tail`, `scripts/validate-dependency-audit.mjs` (exit-code doc + grep of all `process.exit`), `scripts/certification/validate-jest-signal.mjs:700-761`, `scripts/validate-provenance.mjs` (exit inventory).
  - `apps/mobile/package.json` (full), `apps/mobile/app.json` (full), `apps/mobile/.gitignore` (full), `.gitignore` (full), `apps/mobile/plugins/with-deterministic-version.js:1-60`, `plugins/with-android-backup-rules.js:1-45`, generated `apps/mobile/android/gradle.properties`, `android/app/build.gradle` (grep), `android/app/src/main/AndroidManifest.xml` (full).
  - `scripts/generate-game-registry.mjs` (grep of every non-determinism source).
- Structurally inspected: `scripts/*.mjs` + `scripts/*.cjs` + `scripts/{android,certification,perf,qa}/` inventory (10 validator/controller files, 4,586 lines) via exit-path grep; `openspec/` (52 change dirs + `archive/`, `config.yaml`); assistant-config dirs (`.agents .claude .cline .clinerules .commandcode .cursor .devin .kimi-code .omp .opencode .pi`).
- Diagnostics run (all read-only, no `--fix`, no install, no prebuild):
  - `cd apps/mobile && npx --no-install expo-doctor` → 20/21, 1 failed, **EXIT=1**
  - `node scripts/validate-repo-state.mjs` → EXIT 0 · `validate-secrets.mjs --check` → EXIT 0 (2722 tracked text files) · `validate-workflows.mjs` → EXIT 0 (4 files) · `validate-affected.mjs --check-sync` → EXIT 0 (19 areas, 51 patterns) · `validate-offline.mjs --check` → EXIT 0 (985 files) · `validate-dependency-audit.mjs --self-test` → EXIT 0 (41 passed) · `validate-task-ownership.cjs` → EXIT 0 · `validate-jest-signal.mjs --self-test` → EXIT 0 · `validate-runtime-qa-contract.mjs` → EXIT 0
  - `npx --no-install openspec validate --all` → 52 passed / 0 failed, EXIT 0 · `... --all --strict` → 52 passed / 0 failed, EXIT 0
  - `node scripts/generate-game-registry.mjs --check` → EXIT 0 ("up to date")
  - `git check-ignore -v` on 11 assistant dirs + `apps/mobile/android/local.properties` + `apps/mobile/android/app/debug.keystore`; `git ls-files` counts; two ad-hoc read-only `node -e` lock-file analyses over `package-lock.json`.
- Intentionally excluded: `scripts/android/*.sh` and `scripts/perf/*` (no CI gate, runtime-only, owned by the Android/QA lane), `docs/` content correctness, `apps/mobile/src` semantics, ARTEMIS/external CI account policy (accepted debt).

## Flow map
1. **Push/PR → workflow fan-out.** `main` push and every PR triggers **four** workflows: `app-ci` (18 steps, `timeout-minutes: 40`), `repository-integrity` (durable-state job, `timeout-minutes: 10`), `android-build-smoke` (clean native build + APK upload), `ios-build-smoke` (macos-latest). `repository-integrity` additionally has a weekly `cron: '23 5 * * 1'`.
2. **Claim → execution path.** `.agent/GOVERNANCE.json.greenMain.requiredLocalChecks` = `[typecheck, test]`; `.riskBasedChecks` = `[lint, registry-generated-check, provenance-drift-check, task-ownership-check, repo-state-integrity]` (7 total). Each maps to an `app-ci.yml` step: `Typecheck:102`, `Unit tests:121` + `Enforce Jest result:129`, `Lint:105`, `Registry generation check:48`, `Provenance/version drift check:62`, `Task-ownership check:77`, `Validate durable repository state:43` (also `repository-integrity.yml:37`).
3. **Validator exit-code contract → GitHub step semantics.** `node scripts/validate-*.mjs` → exit 0 pass / 1 fail / 2 BLOCKED-or-usage; the workflow step has no `continue-on-error` except `Unit tests:120`, so every non-zero exit fails the job.
4. **Soft-fail-then-enforce pattern.** `Unit tests (jest, CI mode)` (`continue-on-error: true`) writes `jest-summary.json`; `validate-jest-signal.mjs --summary …` (`if: always()`) independently asserts fingerprint/floors; `Enforce Jest result` (`if: always()`) re-fails on `steps.jest.outcome != success`. This is a *designed* two-step coupling and it fails closed (summary missing → `throw` → `process.exitCode = 1`, `validate-jest-signal.mjs:733,756`).
5. **Undeclared gates.** Nine enforced gates exist in no governance list: `expo-doctor`, `expo export --platform web`, `validate-secrets`, `validate-workflows`, `validate-affected`, `validate-offline`, `validate-runtime-qa-contract`, `validate-dependency-audit`, `openspec validate`, plus the two native build-smoke workflows.

## Findings

### L08-F01 — Expo SDK patch drift makes the `Expo doctor` CI gate red while durable state records 21/21
- Severity: P1
- Confidence: confirmed
- Category: build-ci
- Files: `.github/workflows/app-ci.yml:159-160` (step `Expo doctor`), `.github/workflows/app-ci.yml:6` (`pull_request:`), `apps/mobile/package.json` (`dependencies`), `.agent/VALIDATION.md:2241`, `.agent/STATE.md:14`, `.agent/VALIDATION.md:17,32,152,313,341,385,545,584,627,773,844,895`, `.agent/GOVERNANCE.json` (`greenMain`)
- Evidence:
  ```
  $ cd apps/mobile && npx --no-install expo-doctor
  Running 21 checks on your project...
  20/21 checks passed. 1 checks failed. Possible issues detected:
  ✖ Check that packages match versions required by installed Expo SDK
  🔧 Patch version mismatches
  package               expected  found
  expo                  ~57.0.26  57.0.24
  expo-constants        ~57.0.20  57.0.19
  expo-document-picker  ~57.0.3   57.0.2
  expo-linking          ~57.0.11  57.0.10
  expo-router           ~57.0.24  57.0.22
  expo-sharing          ~57.0.22  57.0.21
  6 packages out of date.
  1 check failed, indicating possible issues with the project.
  EXIT=1
  ```
  The CI step is the last step of the only job and has no `continue-on-error` and no `if:`, so the job (and therefore the workflow) fails on any non-zero exit:
  ```yaml
        - name: Expo doctor
          run: npx expo-doctor
  ```
  Durable state claims the opposite:
  ```
  .agent/VALIDATION.md:2241:  - **TypeScript:** PASS (0 errors). **Expo Doctor:** PASS 21/21.
  .agent/VALIDATION.md:17:    clean); typecheck; lint; Expo Doctor 21/21; repo-state PASS; OpenSpec
  .agent/STATE.md:14:  ... typecheck/lint/Expo Doctor 21/21/repo-state/OpenSpec 40/40 strict; ...
  ```
  Exact CI impact: **`App CI` (`.github/workflows/app-ci.yml`, job `app-checks` "Mobile app build/typecheck/tests") reports `failure` on `push` to `main` and on every `pull_request`**, while 17 of its 18 steps pass. `Android Build Smoke`, `iOS Build Smoke` and `Repository Integrity` are unaffected (`Repository Integrity` does not run `expo-doctor`). Because `app-ci.yml` triggers on all `pull_request`s, every PR is born red. `expo-doctor` is declared as `devDependencies.expo-doctor: "^1.20.2"` and resolves from `node_modules`, so this is the same tool in CI and locally — the result is not environment-specific. `expo-doctor` fetches the expected-version manifest from the network, so the gate is **time-dependent**: the tree was green when it was last recorded and turned red with no repository change.
- Problem: an **undeclared, network-time-dependent** gate is the only thing keeping `App CI` from green, and it is not in `greenMain` at all. The `greenMain` rule in `.agent/GOVERNANCE.json` reads "coherent push to main requires local typecheck and risk-based required checks to pass; a known-failing required check may be pushed only as an explicitly documented blocker/recovery checkpoint, never labeled green." Since `expo-doctor` is not a *required* check by that definition, pushes proceeded and durable state kept asserting `Expo Doctor 21/21`.
- Why it matters: a reader of `.agent/VALIDATION.md`/`.agent/STATE.md` believes a 21/21 gate is passing when it currently exits 1, and any observer of Actions sees `main` red with no repository regression. This is not a one-off: the identical class already red-flagged CI at campaign 015 — `.agent/checkpoints/015-governance-depth-convergence-closure-20260828.md:25-26`: *"failed Expo Doctor because `expo`/`expo-constants`/`expo-font` were one patch behind (`20/21` checks)"* — and was repaired by bumping patches. `.agent/VALIDATION.md:823` also records a prior `Expo Doctor is 20/21` state. The cycle (drift → red → bump → re-green → drift) is structural, so "21/21" is a claim with an expiry date that is never recorded.
- Root cause: dependencies were aligned to a specific upstream patch family and the surface was never stabilised. `apps/mobile/package.json` has **no `expo` block at all** (`node -e "require('./app.json')"` shows `expo` key absent, and the package.json `expo` field is `null`), so there is no `expo.install.exclude` and no ownership statement. Governance declares 7 checks; CI enforces 16.
- Recommended solution: choose one policy explicitly and record it in `GOVERNANCE.json` + `.agent/VALIDATION.md`:
  1. **Drift-detection policy (preferred for a frozen certified product).** Move `npx expo-doctor` out of `app-ci.yml` into `repository-integrity.yml`, on the existing weekly `cron: '23 5 * * 1'` step group, with `continue-on-error: true` and a printed classification. This reuses the *exact* ownership pattern campaign 064 already applied to the network-dependent `npm audit` gate (see the OWNERSHIP comment at `repository-integrity.yml:88-94`: *"App CI is hermetic by design and must not gain a network-dependent audit step"*). `expo-doctor` is network-dependent for the same reason and currently breaks that stated invariant.
  2. **Alignment policy.** `cd apps/mobile && npx expo install --fix` for the six packages (lockfile + `package.json` patch-range churn only, no API change), then re-record a *dated* `21/21`.
- Implementation considerations: option 1 keeps App CI hermetic and deterministic and preserves the certified artifact; option 2 is a patch-only bump but repeats indefinitely and invalidates the recorded artifact hash (`docs/hardening/post067/HARDENING_CLOSURE.md` cites hardening build `146F63BF…`). Do **not** solve this by adding `expo.install.exclude` for the six packages — that suppresses future minor/major skew too and makes the check meaningless. Whichever is chosen, every `Expo Doctor 21/21` line in `.agent/VALIDATION.md` (11+ occurrences) and `.agent/STATE.md` needs the date it was last true, matching the `NOT VALIDATED`/`BLOCKED` discipline in `AGENTS.md` §"Validation model".
- Dependencies: L08-F04 (same "declared gate vs enforced gate" root cause), L08-F08; any lane that touches `apps/mobile/package.json`.
- Risks: bumping six patches invalidates the 056/057/067 validation evidence and the certified APK hash; moving the gate out of App CI reduces per-PR signal, so the weekly job's failure must actually reach someone (no alerting path exists today — see "Not covered").
- Validation required: `cd apps/mobile && npx expo-doctor; echo $?` must print `21/21` and `0` for policy 2. For policy 1: `grep -n "expo-doctor" .github/workflows/*.yml` must show it only in `repository-integrity.yml`, and one `workflow_dispatch` run of Repository Integrity must show the step with `continue-on-error` honoured.
- Completion criteria: (a) either `npx expo-doctor` exits 0 at HEAD, or the step is absent from the push-triggered App CI job; (b) no line in `.agent/VALIDATION.md` or `.agent/STATE.md` asserts an undated `Expo Doctor 21/21`; (c) the chosen policy appears in `.agent/GOVERNANCE.json` so claim and execution cannot diverge again.

### L08-F02 — CI validates OpenSpec non-strict with a pinned 1.6.0 CLI while all recorded evidence claims `--all --strict` from a 1.9.0 CLI
- Severity: P2
- Confidence: confirmed (the command/version/flag mismatch); `requires manual validation` for the claim that 1.6.0 cannot honour `--strict`
- Category: build-ci
- Files: `.github/workflows/repository-integrity.yml:100-103`, `.agent/VALIDATION.md:17,32,51,67,81,96,110,125,152,313,341,385`, `docs/hardening/post067/HARDENING_CLOSURE.md:34`, `.agent/skills/openspec-*/SKILL.md:10`
- Evidence:
  ```yaml
        # OpenSpec change/spec validation. The CLI is pinned to an exact
        # version so CI validation is deterministic across runners; ...
        - name: OpenSpec validate
          run: npx --yes @fission-ai/openspec@1.6.0 validate --all
  ```
  Durable state / closure evidence claims something stronger, in 11+ places:
  ```
  docs/hardening/post067/HARDENING_CLOSURE.md:34: | OpenSpec `--all --strict` | **PASS** — 51/51 (056–067) |
  .agent/VALIDATION.md:17:  clean); typecheck; lint; Expo Doctor 21/21; repo-state PASS; OpenSpec
  .agent/VALIDATION.md:18:  `--all --strict` 40/40.
  ```
  Local CLI and its flag set:
  ```
  $ npx --no-install openspec --version
  1.9.0                      # global install: @fission-ai/openspec@1.9.0
  $ npx --no-install openspec validate --help
    --all              Validate all changes and specs
    --strict           Enable strict validation mode
  $ npx --no-install openspec validate --all          # 52 passed, 0 failed (52 items)  EXIT=0
  $ npx --no-install openspec validate --all --strict # 52 passed, 0 failed (52 items)  EXIT=0
  ```
  The skills that *author* change documents were generated by the newer CLI:
  ```
  .agent/skills/openspec-apply-change/SKILL.md:10:  generatedBy: "1.9.0"   (same in all six .agent/skills/openspec-*)
  ```
- Problem: three separate gaps.
  1. **`--strict` is never enforced in CI.** Every recorded gate result is `--all --strict`; CI runs `--all`. Strict-only rules are therefore unverified by the only automated validator that runs on push. Today nothing is hidden by this (`--all --strict` also passes 52/52 at 1.9.0), so it is a **latent** gap, not a live failure — but no future strict-only regression can be caught.
  2. **Two-validator split.** CI pins `@fission-ai/openspec@1.6.0`; the change documents are authored and locally validated by `1.9.0` (evidenced by `generatedBy: "1.9.0"` in the generated skills, and by the `.openspec.yaml` marker files written into `openspec/changes/*` — see L08-F03). A change that satisfies 1.9.0 semantics may fail 1.6.0, or (more likely) pass 1.6.0 *because* 1.6.0 does not know a newer required field. The CI comment claims the pin "so CI validation is deterministic across runners"; the actual effect is determinism between CI and CI, at the cost of CI↔authoring divergence.
  3. **Approval boundary.** `npx --yes` resolves a transitive network fetch of a third-party CLI on every CI run of a repository that otherwise vendors nothing (`npx --yes` is not in any lockfile). `.github/workflows/repository-integrity.yml` has `permissions: contents: read`, which bounds the damage, but the pin is a version string, not a hash.
- Why it matters: the durable-state OpenSpec counts (`40/40`, `41/41`, `45/45`, `47/47`, `51/51`) are the repository's primary structural-integrity evidence for 52 change documents, and the automated equivalent of that evidence is a *different, weaker* command run by a *different, older* tool. The 51/51 claim in the post-067 closure table cannot be reproduced by the CI command.
- Root cause: the CI command was written when the strict claim was introduced but was never updated to match the recorded gate string; the CLI pin was chosen for hermeticity without a parallel "authoring CLI version" declaration anywhere in the repository.
- Recommended solution: (a) change the CI command to `npx --yes @fission-ai/openspec@<pinned> validate --all --strict` so CI reproduces the recorded gate string; (b) make the pin match the authoring CLI (bump to `1.9.0`, or downgrade the generated skills — the former is correct); (c) record the pinned version in `.agent/GOVERNANCE.json` and in the workflow comment as the single declared authoring+validation version.
- Implementation considerations: `--strict` may surface pre-existing warnings across the 52 documents; expect a bounded repair wave (the local 1.9.0 `--all --strict` run is already clean, so a 1.9.0 pin should be immediately green). Adding `--strict` to the existing step keeps the Repository Integrity job's "no dependency install" property. Do not download-and-run `1.6.0` to compare — `openspec` writes `.openspec.yaml` marker files into the tree (see L08-F03), so a comparison run mutates the working tree.
- Dependencies: L08-F03 (the marker files are the visible artefact of the version split); change `068` (L08-F03) is validated only by the local 1.9.0 CLI.
- Risks: bumping the CI CLI may change validation output for 52 existing documents at once; `--strict` adoption may fail the gate on documents that were only ever non-strict-valid.
- Validation required: `npx --yes @fission-ai/openspec@<newpin> validate --all --strict; echo $?` from the repository root must exit 0, and the same command must be the literal string in `repository-integrity.yml`. A negative control: temporarily breaking one `specs/*/spec.md` requirement header must make the CI step fail.
- Completion criteria: the CI step's command string is byte-identical to the gate string recorded in durable state, and CI and local CLIs are the same declared version.

### L08-F03 — An untracked, unacknowledged OpenSpec change (`068`) lives in the working tree; OpenSpec 1.9.0 marker files have already been swept into unrelated commits
- Severity: P2
- Confidence: confirmed
- Category: config
- Files: `openspec/changes/068-storage-adapter-runtime-parity/` (5 files, all untracked), `openspec/changes/068-storage-adapter-runtime-parity/.openspec.yaml`, `.agent/GOVERNANCE.json` (`activeCampaign: null`, `activeProgram.state: "COMPLETE"`), `openspec/changes/067-terminal-whole-product-certification/.openspec.yaml` (touched by commit `6700578`, which is the 066 commit)
- Evidence:
  ```
  $ git status --porcelain --untracked-files=all | grep changes
  ?? openspec/changes/068-storage-adapter-runtime-parity/.openspec.yaml
  ?? openspec/changes/068-storage-adapter-runtime-parity/design.md
  ?? openspec/changes/068-storage-adapter-runtime-parity/proposal.md
  ?? openspec/changes/068-storage-adapter-runtime-parity/specs/storage-adapter-concurrency/spec.md
  ?? openspec/changes/068-storage-adapter-runtime-parity/tasks.md
  $ git ls-files "openspec/changes/068*"      # (empty)
  $ ls -la openspec/changes/068-storage-adapter-runtime-parity/
  .openspec.yaml  design.md  proposal.md  specs  tasks.md   (created 2026-09-30 20:11-20:16)
  $ cat openspec/changes/068-storage-adapter-runtime-parity/.openspec.yaml
  schema: spec-driven
  created: 2026-09-30
  $ git log --oneline -1 -- "openspec/changes/067-terminal-whole-product-certification/.openspec.yaml"
  6700578 066-adversarial-convergence-static-governance: ... (CHANGE_066_COMPLETE)
  ```
  Divergence this creates between the two validators:
  ```
  local:  openspec validate --all  →  "Totals: 52 passed, 0 failed (52 items)"
  CI:     validates the checked-out tree → 51 items (068 is not in git)
  ```
  Meanwhile durable state is terminal: `.agent/GOVERNANCE.json` has `"activeCampaign": null` and `"activeProgram": { ... "state": "COMPLETE" }`; `docs/hardening/post067/HARDENING_CLOSURE.md:34` asserts `OpenSpec --all --strict | PASS — 51/51`.
- Problem: a change document created *after* the terminal 067 closure and the post-067 hardening is sitting in the repository, invisible in CI, unacknowledged by governance, and counted by every local `openspec validate` run. Separately, the OpenSpec 1.9.0 CLI writes a `.openspec.yaml` marker (`schema`, `created`, sometimes `goal`) into each change directory; **23 of those markers are tracked** and at least one (`067-…/.openspec.yaml`) was committed by an unrelated 066 commit, i.e. CLI-generated working-tree residue is being absorbed into commits as a side effect of `git add`. The `068` marker carries a `created:` date, which is exactly the kind of artifact that must not be silently committed.
- Why it matters: (a) the "51/51" closure claim is not reproducible from a clean checkout-plus-`git add -A` flow, and the count will silently become 52 the moment someone commits the directory; (b) an in-flight design (`storage-adapter-concurrency`) that nobody reviewed is one `git add -A` from landing in `main` and being treated as an approved change; (c) any tool that enumerates `openspec/changes/*` for "current state" (repo-state, session-start reconciliation in `AGENTS.md`) reads a filesystem that the canonical source (git) does not agree with — a permanent false-positive source for the next agent session.
- Root cause: the OpenSpec CLI's write surface (`<change>/.openspec.yaml` markers plus the whole new change directory) is not covered by `.gitignore`, and there is no validator that asserts "every directory in `openspec/changes/` is tracked by git".
- Recommended solution: decide `068`'s disposition explicitly — either land it as a real change (rebind `GOVERNANCE.activeCampaign`/`activeProgram.state`, add it to the closure ledger) or delete it as an abandoned exploration. Then add a small tracked-set check: in `scripts/validate-repo-state.mjs`, assert that every `<dir>` under `openspec/changes/` (excluding `archive/`) is represented in `git ls-files`, and add `openspec/changes/*/.openspec.yaml` to git's ignore list only if the team deliberately wants markers untracked — otherwise remove the markers that were never intentional and keep them tracked for the ones that were.
- Implementation considerations: do not blanket-ignore `openspec/changes/*/.openspec.yaml` while 23 are already tracked — gitignore does not affect tracked files, so the result would be an inconsistent policy that silently keeps the tracked ones. The check must run in CI without network, so `git ls-files` (available because `repository-integrity.yml` checks out the repo) is the right primitive, not an `openspec` call.
- Dependencies: L08-F02 (which CLI version performs validation and writes these markers); `.agent/GOVERNANCE.json` terminal-state semantics in `scripts/validate-repo-state.mjs:210-247`.
- Risks: deleting `068` loses unreviewed design content; landing it creates a 53rd change validated by a CLI whose version CI does not use.
- Validation required: `git status --porcelain --untracked-files=all | grep '^?? openspec/changes/'` must be empty after the decision; `openspec validate --all` locally and in CI must report the same item count.
- Completion criteria: local and CI OpenSpec item counts agree; no untracked file exists under `openspec/changes/`; any newly tracked marker file is either intentional or absent.

### L08-F04 — `validate-dependency-audit` exit 2 (BLOCKED) is indistinguishable from exit 1 (advisory FAIL) at the CI step level
- Severity: P2
- Confidence: confirmed
- Category: observability
- Files: `.github/workflows/repository-integrity.yml:88-96`, `scripts/validate-dependency-audit.mjs:21-25,72,344,429-449,469`
- Evidence:
  ```yaml
        # ... Fails closed:
        # exit 1 on an unallowlisted moderate+ advisory reachable from the
        # production tree; exit 2 (BLOCKED, never a silent pass) when npm
        # audit cannot run. ...
        # its BLOCKED status (exit 2) is an honest environment result, not
        # a product failure.
        - name: Validate production dependency audit
          run: node scripts/validate-dependency-audit.mjs
  ```
  ```js
  // scripts/validate-dependency-audit.mjs:21-25
  //   - exit 2  BLOCKED — audit or allowlist cannot be read/parsed, or an
  ...
  429:  console.error('Dependency audit BLOCKED: --offline requested; npm audit was not run (never a silent pass)');
  430:  process.exit(2);
  444:    process.exit(2);
  469:  process.exit(1);
  ```
  No `continue-on-error`, no `if:`, and no step that inspects the exit code: the step is a bare `run:`.
- Problem: the design intent is a three-valued outcome (PASS / BLOCKED-environmental / FAIL-advisory), but the workflow collapses BLOCKED and FAIL into the same signal — a red step in a red workflow. Nothing in the workflow, the job summary, or an artifact distinguishes them.
- Why it matters: `repository-integrity` is the *only* place the network-dependent production dependency audit runs (by explicit design, per the campaign-064 OWNERSHIP comment, so App CI can stay hermetic). On an npm-registry hiccup, a proxy failure, or an `npm audit` payload-shape change, `main` goes red with output that looks to an operator exactly like "we shipped a vulnerable dependency". The rational response to a flaky red gate is to ignore it — which is precisely how a real advisory gets missed. Because the gate also runs on `pull_request`, this affects every PR.
- Root cause: an exit-code-only contract at a boundary whose consumer (GitHub Actions) has only one failure representation. The three-valued intent is encoded in JS comments and exit codes but never surfaced to the operator.
- Recommended solution: keep the strict exit codes (they are good) and split the CI recognition: capture the exit code in the step and branch on it, e.g.
  ```yaml
        - name: Validate production dependency audit
          run: |
            set +e
            node scripts/validate-dependency-audit.mjs
            code=$?
            case "$code" in
              0) echo "dependency audit: PASS"; exit 0 ;;
              2) echo "::warning title=dependency audit BLOCKED::npm audit could not run (environment), not a product failure"; exit 1 ;;
              *) echo "::error title=dependency audit FAILED::unallowlisted moderate+ advisory reachable from the production tree"; exit 1 ;;
            esac
  ```
  so the job stays red (fail-closed) but the *reason class* is machine-readable in the log/annotation and grep-able.
- Implementation considerations: emits the pattern `validate-workflows.mjs` already guards against (`|| true` masking / SIGPIPE) — the `case` above deliberately re-raises the failure rather than swallowing it, and `set +e` is scoped to one command. Keep exit 1 the product-failure code and 2 the environment code; do not renumber (`scripts/certification/*` self-tests assert them). Consider writing the classification into the existing artifact-upload pattern used elsewhere in the workflow set so a scheduled-run failure is diagnosable after the fact.
- Dependencies: L08-F01 (same "declared gate vs enforced gate" family); `scripts/validate-workflows.mjs` shell-hygiene rules (a `case`-based branch must not trip them).
- Risks: a careless rewrite with `|| true` would mask a real advisory — the negative control below is mandatory.
- Validation required: `node scripts/validate-dependency-audit.mjs; echo $?` in all three modes (green, `--offline` → 2, and a deliberately tampered allowlist → 2/1), plus `node scripts/validate-workflows.mjs` still exiting 0 after the workflow edit.
- Completion criteria: the BLOCKED case and the advisory-FAIL case produce visibly different log lines/annotations while both leave the job red; `validate-workflows.mjs` self-test and check still pass.

### L08-F05 — Repository-root residue: an undetected `nul` file and a tracked UTF-16 `git log` dump (`campaign-log.txt`)
- Severity: P3
- Confidence: confirmed
- Category: config
- Files: `nul` (repo root, untracked, 46 bytes), `campaign-log.txt` (repo root, tracked, 38,622 bytes / 186 lines, UTF-16LE), `scripts/validate-repo-state.mjs:40-68` (root-hygiene detector, `:67` `catch {}`)
- Evidence:
  ```
  $ git status --porcelain | grep '^??'
  ... ?? nul
  $ node -e "console.log(require('fs').statSync('D:/Documents/tryPython/brain-training/nul').isFile(), require('fs').statSync('D:/Documents/tryPython/brain-training/nul').size)"
  true 46
  $ git ls-files | grep -Ei 'campaign-log\.txt|qa-canaries\.log'
  campaign-log.txt
  $ wc -lc campaign-log.txt
    186 38622 campaign-log.txt
  $ head -3 campaign-log.txt | cat -v | head -2
  M-oM-;M-?2   3   8   1   0   8   f     d   o   c   s   (   a   g   e   n   t   )
  ```
  (`campaign-log.txt` begins with a UTF-16LE BOM `\xff\xfe` and interleaved NUL bytes — it is a redirected `git log --oneline` dump, not UTF-8 text.)
  The dedicated detector, whose stated purpose is exactly this residue class (`scripts/validate-repo-state.mjs:40-42`: *"unexpected zero-byte or suspicious shell-residue files (e.g. `'`, `i.startsWith('home')`)"*), does not fire:
  ```js
  57:    const stat = fs.statSync(fullPath);
  58:    if (stat.isFile() && stat.size === 0) { ... errors.push(`Unexpected zero-byte file ...`) }
  62:    if (/['`$;|&<>]/.test(name) || /^i\./.test(name) || name.includes('=>') || name.includes('startsWith')) { ... }
  67:  } catch {}
  ```
  `validate-repo-state.mjs` exits 0 with `nul` present.
- Problem: two independent hygiene defects. (a) A real 46-byte file named `nul` at the repository root — the classic Windows `command > nul` residue — is invisible to the validator because the detector requires `size === 0` and `nul` is neither zero-sized nor name-suspicious; the `catch {}` at line 67 additionally swallows any `statSync` error such that an entry whose stat fails is silently exempted from both checks (exit 0 on an error path). (b) `campaign-log.txt` is committed at the repository root: an unencoded dump of `git log --oneline`, 38.6 KB, in UTF-16LE. It is not referenced by any validator, script, or document (`grep -rn campaign-log.txt` finds no consumer), it duplicates information available from `git log`, and being UTF-16 it will be skipped or mis-rendered by any tool that scans tracked files as UTF-8 text — including `scripts/validate-secrets.mjs`, which reports scanning "2722 tracked text files".
- Why it matters: the repository depends on `validate-repo-state.mjs` as its structural-integrity gate (it runs first in *both* `app-ci.yml:43` and `repository-integrity.yml:37`), and the root-hygiene detector is a demonstrated no-op against a live instance of the exact residue it was written for. The security implication of a UTF-16 tracked file is bounded today (no secret patterns were found in it; `validate-secrets.mjs --check` is CLEAN), but a scanner that cannot read a file cannot certify it.
- Root cause: the detector was written and tuned against one observed residue shape (`'`, a stray `i.startsWith(...)` file) and validated by `--self-test` only for that shape; `campaign-log.txt` predates the hygiene detector and was allowlisted implicitly by the "extension is known-good" path (`allowedRootExtensions` includes `.txt` and `.log`).
- Recommended solution: (a) delete `nul` and `campaign-log.txt`; (b) widen the detector to a **deny-list plus size/encoding check** rather than a zero-byte-only check — flag any root entry whose name is a Windows reserved device name (`CON PRN AUX NUL COM1-9 LPT1-9`, case-insensitive, including with extensions) or whose name is not in `allowedRootEntries`/`allowedRootExtensions`, and (c) replace `catch {}` with `errors.push(...)` so a failed `statSync` fails the gate instead of silently exempting the entry. Add `campaign-log.txt` to the "no tracked root-level dumps" assertion or simply keep the root allowlist closed (see L08-F06's general point about the allowlist being a partial policy).
- Implementation considerations: `validate-repo-state.mjs --self-test` does not currently cover the root-hygiene path; any tightening must be accompanied by self-test fixtures (a reserved device name, a stat failure via a dangling symlink). `allowedRootEntries` already permits `qa-artifacts` and `.quarantine` (both currently 0 tracked files, `.quarantine/` is an empty directory) — that is coherent with them being gitignored, so leave those. Keep the check narrowly scoped to the repository root as the comment already states.
- Dependencies: L08-F06 (gitignore coverage), L08-F03 (untracked-artifact policy).
- Risks: a tightened root allowlist is the kind of check that fails on the next legitimate new root file (`CHANGELOG.md`, `SECURITY.md`, a `justfile`). Add new entries explicitly rather than loosening the rule.
- Validation required: `git rm --cached campaign-log.txt && rm campaign-log.txt nul`, then `node scripts/validate-repo-state.mjs` exits 0; then a negative control — creating a root file named `con` must make it exit 1 with a "shell/editor residue" message, and removing it must return to 0.
- Completion criteria: `git status --porcelain | grep nul` is empty; `campaign-log.txt` is untracked and absent; `validate-repo-state.mjs` fails on a synthetic reserved-device-name file and on a stat error, and its `--self-test` covers both.

### L08-F06 — `.gitignore` covers none of the eleven assistant-tool config directories, whose contents are already half-tracked
- Severity: P3
- Confidence: confirmed
- Category: config
- Files: `.gitignore:1-44`, `apps/mobile/.gitignore`, and the 11 directories `.agents/ .claude/ .cline/ .clinerules/ .commandcode/ .cursor/ .devin/ .kimi-code/ .omp/ .opencode/ .pi/`
- Evidence:
  ```
  $ for d in .claude .cursor .cline .clinerules .devin .kimi-code .opencode .pi .omp .commandcode .agents; do
      printf '%-14s ' "$d"; git check-ignore -q "$d" && echo IGNORED || echo NOT-IGNORED; done
  .claude        NOT-IGNORED
  .cursor        NOT-IGNORED
  .cline         NOT-IGNORED
  .clinerules    NOT-IGNORED
  .devin         NOT-IGNORED
  .kimi-code     NOT-IGNORED
  .opencode      NOT-IGNORED
  .pi            NOT-IGNORED
  .omp           NOT-IGNORED
  .commandcode   NOT-IGNORED
  .agents        NOT-IGNORED

  $ git status --porcelain | grep '^??'   # 25 untracked top-level entries incl. all 11 above
  $ git ls-files .kimi-code .agents .claude .opencode
  .agents/skills/continue-development/SKILL.md
  .agents/skills/goal/SKILL.md
  .agents/skills/harden/SKILL.md
  .claude/commands/goal.md
  .kimi-code/AGENTS.md
  .opencode/commands/goal.md
  ```
  `.gitignore` mentions exactly three assistant paths, and only for one tool's local state:
  ```
  .gitignore:19: # Kimi local/session state
  .gitignore:20: .kimi-code/local.toml
  .gitignore:21: .kimi-code/sessions/
  .gitignore:22: .kimi-code/logs/
  ```
  Volume and content: ~13 files / 128 KB (`.claude`), 12 / 127 KB (`.devin`), 12 / 127 KB (`.cursor`), 6 / 66 KB (`.cline`), 6 / 61 KB (`.clinerules`), 8 / 68 KB (`.kimi-code`), plus `.opencode`, `.pi`, `.omp`, `.commandcode`, `.agents`. All are vendored copies of the same OpenSpec skill/command set (`opsx-apply`, `opsx-archive`, `opsx-explore`, `opsx-propose`, `opsx-sync`, `opsx-update`) generated by OpenSpec 1.9.0 (see L08-F02), i.e. large duplicated boilerplate.
- Problem: the repository has no expressed policy for assistant-tool configuration. Six paths are tracked (functioning as de-facto policy), 25 top-level entries are untracked-but-not-ignored, and one tool's local state is explicitly ignored. Because they are not ignored, every one of them appears in `git status` output for every agent session — which is exactly the signal `AGENTS.md`'s mandatory startup protocol (`Inspect git status, current branch, recent history, and remote state`) tells agents to read, so 25 lines of noise are prepended to the first thing every session evaluates. The realistic harm is a `git add -A` / `git add .` (a natural move for an agent that has been told to "commit coherent progress") sweeping in machine-local tool state.
- Secret/machine-specific content check: no high-confidence secret pattern was matched across all 11 directories (`grep -rIl -E 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|npm_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|sk_live_[A-Za-z0-9]{10,}|BEGIN [A-Z ]*PRIVATE KEY' .claude .cursor .cline .clinerules .devin .kimi-code .opencode .pi .omp .commandcode .agents` → no files). `.kimi-code/local.toml` (`local.toml` is already ignored) and `.agents/skills/.openspec-target` (content: `codex`) are host-tool selection state, not secrets. So this is a hygiene/consistency finding, not a security one. Note the `git status` line `?? nul` (L08-F05) sits in the same untracked bucket and is a *real* defect.
- Root cause: no owner. Each assistant tool created its own config directory on first use, the paths were never added to `.gitignore`, and the OpenSpec-generated skill copies were added to a subset of them so they are tracked in some tools and floating in others.
- Recommended solution: add one explicit, commented block to `.gitignore` covering all assistant-tool directories (`.agents/ .claude/ .cline/ .clinerules/ .commandcode/ .cursor/ .devin/ .omp/ .opencode/ .pi/` and the remainder of `.kimi-code/`), then decide per directory whether the OpenSpec skill copies should be a single tracked canonical set (one directory) or untracked/reproducible from the OpenSpec CLI. Because gitignore does not affect already-tracked files, the six tracked paths must be `git rm --cached`-ed if the policy is "untracked", or left tracked and the ignore block written to not cover them.
- Implementation considerations: `scripts/validate-repo-state.mjs:42-47` already allowlists `.agents`, `.claude`, `.kimi-code`, `.opencode` as permitted root entries and explicitly scans for "suspicious" names, so no validator change is required to add the missing six (`allowedRootEntries` currently lists `.agent, .agents, .claude, .git, .github, .kimi-code, .opencode, .quarantine` — `.cline`, `.clinerules`, `.commandcode`, `.cursor`, `.devin`, `.omp`, `.pi` fall through to the extension check and pass because they are dot-prefixed *directories* with no extension, which is why they do not trip the zero-byte/suspicious-name path). Adding them to `allowedRootEntries` would make the allowlist honest. Prefer a single canonical tracked skill location over eleven copies to avoid the version drift already demonstrated in L08-F02.
- Dependencies: L08-F02 (`generatedBy: 1.9.0` skill copies), L08-F03 (untracked-artifact policy), L08-F05 (root hygiene).
- Risks: `git rm --cached` on tool config could break a contributor's local setup if they rely on the tracked copies; if the OpenSpec skills are intentionally shared, that intent should be stated in a doc rather than inferred from six directories.
- Validation required: `git check-ignore -q .claude .cursor .cline .clinerules .devin .kimi-code .opencode .pi .omp .commandcode .agents` exits 0 for each; `git status --short` shows only genuine work items; `node scripts/validate-repo-state.mjs` still exits 0.
- Completion criteria: every assistant-tool config path is either explicitly ignored or explicitly tracked-and-documented; the untracked top-level entry count drops to the audit's own directory plus genuine in-flight work; `git status` in a fresh clone shows no assistant-tool noise.

### L08-F07 — Release builds ship unminified: R8/`minifyEnabled` and resource shrinking are off, and the setting lives only in the gitignored `android/` tree
- Severity: P3
- Confidence: confirmed
- Category: build-ci
- Files: `apps/mobile/android/app/build.gradle:69,110-121,177` (generated), `apps/mobile/android/gradle.properties` (generated, no `android.enableMinifyInReleaseBuilds`), `apps/mobile/.gitignore:42` (`/android`), `apps/mobile/app.json` (no plugin pins it), `apps/mobile/plugins/*.js` (no minify plugin)
- Evidence:
  ```
  apps/mobile/android/app/build.gradle:69:
    def enableMinifyInReleaseBuilds = (findProperty('android.enableMinifyInReleaseBuilds') ?: false).toBoolean()
  apps/mobile/android/app/build.gradle:116-119:
              def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
              shrinkResources enableShrinkResources.toBoolean()
              minifyEnabled enableMinifyInReleaseBuilds
              proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
  $ grep -n "enableMinifyInReleaseBuilds\|enableShrinkResources" apps/mobile/android/gradle.properties
  (no output)
  $ git ls-files apps/mobile/android/ | wc -l
  0
  $ git check-ignore -v apps/mobile/android/app/build.gradle
  apps/mobile/.gitignore:42:/android	apps/mobile/android/app/build.gradle
  ```
  `apps/mobile/android/app/proguard-rules.pro` exists and is wired into the release block, but `minifyEnabled` is `false`, so the file is inert.
- Problem: the release variant compiles with code shrinking, obfuscation and resource shrinking all disabled (both flags default to `false` and neither is ever set). The Expo-template defaults are being inherited silently. Because `apps/mobile/android/` is gitignored and regenerated by `expo prebuild --clean` (the same mechanism the local config plugins were created to survive — see `plugins/with-android-backup-rules.js`: *"Before this plugin these settings existed only as hand edits inside the gitignored `android/` directory and silently vanished on every clean prebuild"*), there is no in-repo place where this is visible or reviewable, and no config plugin `withMinifyInReleaseBuilds` exists. No document anywhere claims R8 is enabled (grep for `minifyEnabled|R8|shrinkResources|obfuscat|proguard` across `docs/`, `.agent/`, `apps/mobile/plugins/` returns only an unrelated `R5–R8` test label in a campaign task file), so this is an unmade decision rather than a contradicted claim.
- Why it matters: for a shipping offline product this is a real release-configuration gap — a materially larger download, no obfuscation of source identifiers, and a `proguard-rules.pro` that is present but validated by nothing (so if it becomes enabled later it will fail at release time with no prior coverage). It also means the *certified* artifact (`docs/hardening/post067` hardening build `146F63BF…`, 109,602,821 B) is an unminified debug-shaped build, so any size or startup-time evidence recorded against it does not describe a store-shaped release.
- Root cause: the repository's convention is "native config that must survive `expo prebuild --clean` belongs in a local config plugin" (documented in `plugins/with-android-backup-rules.js` and `plugins/with-android-ndk-pin.js`), but no such plugin exists for release build flags, and Android-specific release hardening was never in scope for the closed campaigns (`android.enableMinifyInReleaseBuilds` appears nowhere in `docs/DEFERRED_DECISIONS.md`).
- Recommended solution: add `plugins/with-android-minify.js` following the existing pattern (`createRunOncePlugin` + `withGradleProperties`), setting `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true` for the release variant, with a matching `plugins/__tests__/with-android-*-test.ts` in the style of `with-android-backup-rules.test.ts`. Alternatively, if release hardening is deliberately deferred, write the deferral down explicitly in `docs/DEFERRED_DECISIONS.md` next to the existing store-signing deferral so the current state is a decision rather than an omission.
- Implementation considerations: enabling R8 requires a real release build plus a runtime smoke to prove Reanimated/worklets, `expo-sqlite`, and the SQLite native binding survive shrinking; `proguard-rules.pro` will need the Expo/RN keep rules (Expo's `expo-modules-core` consumer rules generally cover this, but that must be verified, not assumed). Keep the plugin idempotent and `runOnce` like the two existing ones, and pin the exact gradle property names (a typo here fails silently back to `false`). This must not be combined with a `prebuild --clean` commit of `android/` — the directory stays gitignored by design.
- Dependencies: release/store-signing accepted debt; any lane touching `apps/mobile/plugins/`; the artifact-hash evidence in `docs/hardening/post067/`.
- Risks: turning on minification is the classic source of release-only crashes that never appear in debug or in unit tests; it must land with an actual release-variant build and on-device smoke, not with the debug APK path used by the existing smoke scripts.
- Validation required: `npx expo prebuild --platform android --clean --no-install` followed by a release-variant assemble (`./gradlew app:assembleRelease`) and `aapt2 dump badging`/APK size comparison against the recorded 109,602,821 B; plus one device smoke of the release build (`scripts/android/smoke-app.sh` path) covering game start, session completion, and SQLite write. Static-only proof is insufficient.
- Completion criteria: either (a) a config plugin pins both flags and a release-variant build has been smoke-tested on a device with the findings recorded in `.agent/VALIDATION.md`, or (b) the deferral is explicitly recorded in `docs/DEFERRED_DECISIONS.md` with a rationale, and `docs/hardening/post067` evidence is annotated to say the certified artifact is unminified.

### L08-F08 — `greenMain` declares 7 checks; CI enforces 16, and 9 of them are undeclared
- Severity: P3
- Confidence: confirmed
- Category: docs-dx
- Files: `.agent/GOVERNANCE.json` (`greenMain.requiredLocalChecks`, `greenMain.riskBasedChecks`), `.github/workflows/app-ci.yml`, `.github/workflows/repository-integrity.yml:44-103`
- Evidence — claimed (7) vs enforced:
  ```
  GOVERNANCE.greenMain.requiredLocalChecks = ["typecheck", "test"]
  GOVERNANCE.greenMain.riskBasedChecks     = ["lint","registry-generated-check",
                                              "provenance-drift-check",
                                              "task-ownership-check","repo-state-integrity"]

  → all 7 ARE run:
     typecheck        app-ci.yml:102  npm run typecheck
     test             app-ci.yml:121  npm run test:ci   (+ :129 Enforce Jest result)
     lint             app-ci.yml:105  npm run lint
     registry         app-ci.yml:48   generate-game-registry.mjs --check
     provenance       app-ci.yml:62   validate-provenance.mjs --check
     task-ownership   app-ci.yml:77   validate-task-ownership.cjs
     repo-state       app-ci.yml:43 + repository-integrity.yml:37

  → run but NEVER claimed (9 + 2 workflows):
     expo-doctor            app-ci.yml:159
     web export             app-ci.yml:146
     secrets                repository-integrity.yml:46-48
     workflows               repository-integrity.yml:53-55
     affected                repository-integrity.yml:60-62
     offline                 app-ci.yml:86 + repository-integrity.yml self-test
     runtime-qa contract     app-ci.yml:92
     dependency-audit        repository-integrity.yml:96
     openspec validate       repository-integrity.yml:103
     (+ android-build-smoke, ios-build-smoke whole workflows)
  ```
- Problem: there are **no** claimed-but-never-run checks — the claim side is honest. The defect is the inverse: the governance contract enumerates fewer than half of the gates that can actually turn `main` red, so an agent or human following `greenMain` can satisfy every declared check and still leave the repository red (which is exactly the state today, via `expo-doctor` — L08-F01). `GOVERNANCE.json` is also the file `scripts/validate-repo-state.mjs` structurally validates, so it is read as authoritative.
- Why it matters: `AGENTS.md` states "Normal post-wave validation is risk-based" and drives that from `greenMain` + `.agent/IMPACT_MAP.md`. With 9 undeclared gates, the risk model has no entry for them: nothing says who owns `expo-doctor`, `npm audit`, or OpenSpec validity, whether their failure is blocking, or whether an environmental failure is acceptable. `L08-F04` (BLOCKED vs FAIL) is a direct consequence of that missing ownership statement.
- Root cause: `greenMain` was written when the gate set was smaller and was extended by adding workflow steps rather than by updating the contract. The campaign-064 comment in `repository-integrity.yml:88-94` shows the team *does* reason about gate ownership — it is just recorded in a YAML comment rather than in `GOVERNANCE.json`.
- Recommended solution: extend `greenMain` with the actual gate inventory and a per-gate disposition, e.g. `requiredCiChecks` (blocking, must be green: typecheck, lint, test+signal, repo-state, registry, provenance, task-ownership, offline, secrets, workflows, affected, runtime-qa, openspec, jest-signal), `advisoryCiChecks` (non-blocking, classified: expo-doctor, dependency-audit BLOCKED class, web export size), and `environmentDependentChecks` (dependency-audit). Then have `scripts/validate-repo-state.mjs` assert that every `name:` of a `run:` step starting with `node scripts/validate-` across `.github/workflows/` is represented in one of those lists — a cheap, offline, drift-proof check.
- Implementation considerations: that new assertion is the mirror of `validate-affected.mjs --check-sync` (which already keeps `IMPACT_MAP.md` in sync with `RULES` at the pattern level) — reuse that idiom rather than inventing a new one. Adding workflow-step introspection to `validate-repo-state.mjs` means that file gains a dependency on `.github/workflows/` parsing; `scripts/validate-workflows.mjs` already parses those files, so the assertion arguably belongs there instead. Prefer `validate-workflows.mjs` for parsing and `validate-repo-state.mjs` only for the `GOVERNANCE.json` schema.
- Dependencies: L08-F01, L08-F02, L08-F04.
- Risks: an over-strict "every step must be declared" rule will fail on every legitimate new workflow step; make the failure message name the exact JSON field to add so the fix is mechanical.
- Validation required: add a step to `app-ci.yml` (temporarily, on a scratch branch) that is not in `GOVERNANCE.json` and confirm the new assertion fails with an actionable message; confirm it passes at HEAD once the contract is complete.
- Completion criteria: every gate that can fail `main` is named in `.agent/GOVERNANCE.json` with a blocking/advisory/environmental disposition, and an offline validator fails when a workflow gate and the contract disagree.

## Checked and found clean
- **All 7 `greenMain` checks are genuinely executed in CI** — there is no claimed-but-never-run check (see L08-F08 for the inverse).
- **`apps/mobile/package.json` ↔ `apps/mobile/package-lock.json` drift: none.** 23 `dependencies` / 11 `devDependencies` in `package.json`; identical key sets in `lock.packages[""]`; zero range mismatches; `lockfileVersion: 3`. All Expo SDK packages are `~`-pinned and the two floating caret families (`@testing-library/react-native ^14.0.1`, `better-sqlite3 ^13.0.3`, `eslint ^9.0.0`, `typescript ~6.0.3`) are locked by the lockfile and installed with `npm ci` in CI, so floating ranges are not a reproducibility hazard here.
- **No duplicate resolved versions of any direct dependency** in the lockfile (checked 34 direct names against 1,135 lock entries). 9 deprecated transitive entries exist and are all dev-toolchain only: `glob@7.2.3` ×4 vendored under `@jest/reporters`, `jest-config`, `jest-runtime`, `test-exclude`; `abab@2.0.6`; `domexception@4.0.0`; `inflight@1.0.6`; `uuid@7.0.3`; `whatwg-encoding@2.0.0`. None is reachable from the production tree, and the production reachability question is already owned by `validate-dependency-audit.mjs` + `scripts/certification/dependency-audit-allowlist.json`.
- **Expo SDK alignment holds for every package except the six in L08-F01.** `expo-font ~57.0.2`, `expo-asset ~57.0.18`, `expo-audio ~57.0.5`, `expo-file-system ~57.0.6`, `expo-haptics ~57.0.3`, `expo-splash-screen ~57.0.9`, `expo-sqlite ~57.0.3`, `expo-symbols ~57.0.3` are all at the version `expo-doctor` expects (the failing check lists exactly and only the six packages in F01).
- **`scripts/generate-game-registry.mjs` is deterministic.** No `Date.now`, `new Date`, `toISOString`, `Math.random`, or `process.cwd` in the generator; it `readdirSync`s the games directory and `.sort()`s before emitting (`:119,:130`); `--check` compares generated output against the on-disk file by content (`:273-278`) and `node scripts/generate-game-registry.mjs --check` exits 0 ("generated registry is up to date"). The output carries no timestamp or machine path.
- **All nine `--self-test` paths and all nine validator `--check` paths exit 0 at `2a765cc`** (exact results in "Diagnostics run"). No validator hardcodes a drifting item count: the only numeric constants in the validator set are policy windows (`validate-provenance.mjs:30 ALLOWLIST_WARN_WINDOW_DAYS = 45`, `validate-jest-signal.mjs:37 EXPIRY_WARNING_WINDOW_DAYS = 60`, `qa/a11y-audit.mjs:37 MIN_TARGET_DP = 44`). `validate-workflows.mjs` discovers workflow files dynamically (prints "4 files scanned") rather than asserting a count.
- **The Jest soft-fail pattern fails closed.** `validate-jest-signal.mjs:733` throws on a missing summary (`if (!existsSync(summaryFile)) throw new Error(...)`) and `:756` converts it to `process.exitCode = 1`; floors come from `scripts/certification/jest-skip-allowlist.json` (`minTotalSuites`/`minTotalTests`, schema v4 with `reviewedAt`/`expires`) rather than hardcoded numbers; the sibling `Enforce Jest result` step (`app-ci.yml:129-134`) independently fails on `steps.jest.outcome != success`. A Jest crash cannot pass either path.
- **`validate-secrets.mjs` fail-closed on its own flag handling.** `--help` and `--self-test` take explicit exit-0 paths (`:95-103`) and any other invocation (including `--check` and a typo'd flag) falls through to the real `scanTrackedFiles()` scan inside a `try/catch` that sets `exitCode = 1` on thrown errors (`:105-118`). There is no argv combination that returns 0 without scanning.
- **`validate-affected.mjs` exit contract is correct.** `--check-sync` prints issues and `exit(1)`; a missing path list prints usage and `exit(2)`; `--self-test` and `--list-areas` exit 0 by design; the default path list gates on `strictFailure(plan, opts.strict)`.
- **`validate-offline.mjs`, `validate-workflows.mjs`, `validate-dependency-audit.mjs` all fail closed on a missing input**: `exitCode = 2` when `SRC_ROOT` is absent, `exit(1)` when `.github/workflows` is absent, `exit(2)` BLOCKED when no package/lock is found or the audit cannot be parsed (`validate-dependency-audit.mjs:344` comment: *"Malformed / absent / error audits are BLOCKED, never silently passed"*).
- **Android release identity is coherent.** `app.json` → `android.package: "com.braintraining.app"`, `expo.version: "0.1.0"`; `plugins/with-deterministic-version.js` derives `versionCode = 1000` (verified in the generated `AndroidManifest.xml`: `android:versionCode="1000" android:versionName="0.1.0"`) with an explicit range guard (`major<1000, minor<1000, patch<=999999`) and a hard throw on a non-semver version — a good determinism pattern.
- **Permission posture matches the documented intent.** Generated manifest removes `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW` via both `blockedPermissions` in `app.json` and `tools:node="remove"`; `READ/WRITE_EXTERNAL_STORAGE` are clamped to `maxSdkVersion="32"`; `expo.modules.updates.ENABLED=false`; NDK pinned (`ndkVersion=27.0.12077973` via `with-android-ndk-pin`); `newArchEnabled=true`; Hermes enabled. `allowBackup="true"` with the database domain excluded by `with-android-backup-rules` is the recorded accepted-debt decision, and the plugin's own docblock states the reasoning.
- **No Android native file is tracked.** `git ls-files apps/mobile/android/` = 0 files; `apps/mobile/.gitignore:42 /android` ignores the whole generated tree, including `local.properties` (which contains the machine path `sdk.dir=C:/Users/palac/AppData/Local/Android/Sdk`) and `app/debug.keystore` — both verified ignored via `git check-ignore -v`. `apps/mobile/.gitignore` also ignores `*.jks/*.p8/*.p12/*.key/*.mobileprovision`, and the root `.gitignore` ignores `*.pem/*.key/*.jks/*.keystore`. Note `.gitignore:16 android/local.properties` is anchored to the repository root and therefore does **not** cover `apps/mobile/android/local.properties`; that path is saved only by the app-level `/android` rule.
- **No secrets found in the untracked assistant-config directories** (9-pattern high-confidence grep over all 11 directories → zero files).
- **`qa-artifacts/` is not committed** (0 tracked files; ignored by the root `.gitignore`), `.quarantine/` exists but is an empty directory, and `scripts/qa/certify-run.log` is the only tracked `.log` under `scripts/` (`git ls-files | grep -E '\.log$'` → `campaign-log.txt` only at root, see L08-F05).
- **Android/iOS build-smoke workflows are consistent with each other** (`on: push[main] / pull_request / workflow_dispatch`, commit-pinned actions, `if: failure()` artifact uploads with short retention) and neither contains a `continue-on-error` masking step.

## Not covered / could not verify
- **`@fission-ai/openspec@1.6.0` behaviour was deliberately not executed.** `openspec` writes `.openspec.yaml` marker files into `openspec/changes/*` (evidenced by 16 marker files on disk, 23 tracked, one committed by an unrelated 066 commit), so running the 1.6.0 CLI would mutate the working tree, which this lane forbids. **What would confirm it:** `npx --yes @fission-ai/openspec@1.6.0 validate --all --strict` in a throwaway `git worktree` of `2a765cc`, checking (a) whether `--strict` is even accepted and (b) the pass/fail count versus 1.9.0's 52/52.
- **Which of the 23 tracked `.openspec.yaml` markers were intentional.** I confirmed they exist and that `067-…/.openspec.yaml` was added by the 066 commit (`6700578`), but did not diff all 23 against the commits that added them.
- **Whether `campaign-log.txt` is read by anything.** `grep -rn 'campaign-log'` across the repository returned no consumer, but I did not exhaustively exclude it from every shell script under `scripts/android/`.
- **Whether `validate-repo-state.mjs`'s root-hygiene `catch {}` is reachable in practice.** I could not construct a stat failure without creating a file (forbidden). **What would confirm it:** a dangling symlink at the repository root on a POSIX checkout, then `node scripts/validate-repo-state.mjs` — a symlink whose target is missing makes `statSync` throw `ENOENT` and the entry is silently skipped.
- **No alerting/notification path was found for the weekly `cron: '23 5 * * 1'` schedule.** I confirmed the schedule and the three freshness gates it exists for, but did not find any operator notification mechanism (no issue-creation step, no webhook). If a scheduled run fails, nothing but a red Actions run records it.
- **Release-variant build behaviour (`assembleRelease`, R8, signing) is unverified.** I inspected only the generated `android/app/build.gradle`; I did not run Gradle (build cost + host-interaction rules) and `apps/mobile/android/` is regenerated by `expo prebuild`, so the file inspected is a local artifact rather than a committed source of truth. L08-F07 is therefore static-only.
- **`scripts/android/*.sh` and `scripts/perf/`: not reviewed** (no CI gate, runtime/device-owned; assigned to the Android/lane-QA lane).
- **iOS workflow correctness beyond its trigger/step inventory: not reviewed** (macOS runner, `pod install`, `xcodebuild`; iOS is accepted debt/boundary).
- **`.agent/task-ownership.json` ↔ actual swarm-packet correspondence: not verified** (only that `validate-task-ownership.cjs` exits 0).

## Contradictions with existing documentation
1. **`.agent/VALIDATION.md` (11 lines) and `.agent/STATE.md:14` assert `Expo Doctor 21/21`; the real result at `2a765cc` is 20/21 with exit 1.** `docs/hardening/post067/HARDENING_CLOSURE.md`'s terminal-verification table does **not** list Expo Doctor, so the post-067 closure document is self-consistent; the false claim lives in the durable state files. (Full detail: L08-F01.)
2. **`docs/hardening/post067/HARDENING_CLOSURE.md:34` asserts `OpenSpec --all --strict | PASS — 51/51`; the CI gate that is supposed to enforce it runs `@fission-ai/openspec@1.6.0 validate --all` — no `--strict`, and a CLI version older than the authoring CLI.** Additionally the local count is 52 items, not 51, because of the untracked change `068`. (L08-F02, L08-F03.)
3. **`.github/workflows/repository-integrity.yml:88-94` claims "its BLOCKED status (exit 2) is an honest environment result, not a product failure"; in GitHub Actions an exit-2 step fails the job identically to an exit-1 step, so the documented distinction does not exist at the point where an operator observes it.** (L08-F04.)
4. **`AGENTS.md` "Validation model" says "Never fake green. If a required check cannot run, record `NOT VALIDATED` or `BLOCKED`, not `PASS`", and `GOVERNANCE.json.greenMain` says a known-failing required check may be pushed "only as an explicitly documented blocker/recovery checkpoint, never labeled green".** `App CI` is currently failing on a gate that `greenMain` does not list, while durable state records `PASS` — the contract has no rule that catches an *undeclared* gate, which is the structural gap behind contradictions 1–3. (L08-F08.)
5. **`.github/workflows/repository-integrity.yml:88-94` states the ownership invariant "App CI is hermetic by design and must not gain a network-dependent audit step".** `app-ci.yml:159-160` runs `npx expo-doctor`, which is network-dependent (it fetches the expected-version manifest) and is therefore a counter-example to the stated invariant already present in the same workflow set. (L08-F01.)
