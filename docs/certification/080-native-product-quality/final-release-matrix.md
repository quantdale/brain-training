# Final release matrix — Campaign 080

**Final integrated SHA:** `753c3afe`
**Branch:** `main` (clean, no temporary worktrees/branches)
**Campaign status:** ACTIVE — engineering VALIDATED with explicit limitations

---

## 1. Hosted CI at the final integrated SHA

All four required status checks are **SUCCESS** at `753c3afe` (externally
observed via `gh run list --branch main`, not assumed):

| Workflow | Run ID | Status |
|---|---|---|
| Repository Integrity | `39828991251` | **SUCCESS** |
| App CI | `39828991247` | **SUCCESS** |
| Android Build Smoke | `39828991224` | **SUCCESS** |
| iOS Build Smoke | `39828991217` | **SUCCESS** |

The immediately preceding checkpoint `a7226d75` also had all four green
(Repository Integrity `39824138213`, App CI `39824138172`, Android Build Smoke
`39824138246`, iOS Build Smoke `39824138168`); `753c3afe` is a docs-only commit
on top of it, and its own runs are the authoritative record.

App CI is the lane that executes the certification-engine test suite added this
campaign (205 QA contract tests including the 40 CLI process-exit tests), so the
fail-closed evidence gate is enforced on every push rather than only locally.

## 2. Local gate results at `753c3afe`

| Gate | Result |
|---|---|
| TypeScript typecheck | PASS |
| Jest (full) | 713 suites / **8024 passed**, 0 failed, 5 classified skips |
| Certification-engine tests (`node --test scripts/qa/*.test.mjs`) | **205 / 205 PASS** |
| Artifact verifier (authoritative ledger v8, `--strict`) | **PASS**, 1119 artifacts, 0 violations |
| `validate-repo-state.mjs` | PASS |
| `generate-game-registry.mjs --check` | up to date |
| `generate-spec-store.mjs --check` | OK (142 specs) |
| `validate-cli-contracts.mjs` | PASS (16 scripts) |
| `validate-workflows.mjs` | PASS |
| `validate-offline.mjs --check` | CLEAN |
| `validate-provenance.mjs --check` | no drift |
| `validate-task-ownership.cjs` | PASS |
| `validate-secrets.mjs --check` | CLEAN (4048 files) |
| `validate-runtime-qa-contract.mjs` | PASS |

## 3. Requirement status ledger

Every requirement carries an explicit status. Nothing is marked complete merely
because implementation exists.

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | F-080-NEW-001 fail-open exit fixed | **VERIFIED** (local + CI) | 40 CLI exit tests; pinned historical-expression regression |
| 2 | F-080-NEW-002 mixed-build semantics | **VERIFIED** (local + CI) | `--build-scope single\|archive`; 9 mixed-build tests |
| 3 | Original P1 findings (4) | **IMPLEMENTED + TESTED**, independent review `BLOCKED_EXTERNAL` | `review-finding-resolution.md` |
| 4 | Actionable P2 findings | **VERIFIED** (B5 closed app-side; others closed in contract) | see §4 |
| 5 | Native evidence integrity under correct mode | **VERIFIED** | ledger v8, `--mode local --strict` PASS |
| 6 | Guided-tutorial solver coverage | **VERIFIED** | 22/22 tutorial games plan; 30 solver tests |
| 7 | All 42 games reattempted under latest contract | **VERIFIED** | ledger v8 (42 runs, single build) |
| 8 | L2/L3 expansion | **VERIFIED** — 7 L3 / 13 L2 (was 4 / 6) | ledger v8 |
| 9 | Workout V3 full native lifecycle | **PARTIAL / NOT_EXECUTED this wave** | earlier partial evidence only |
| 10 | Native backup/restore round-trip | **NOT_EXECUTED this wave** | source-covered only |
| 11 | Migration/upgrade qualification | **NOT_EXECUTED this wave** | no authentic prior artifact |
| 12 | Accessibility/responsive profile matrix | **NOT_EXECUTED this wave** | prior partial only |
| 13 | Confirmed app defects fixed + regression-tested | **VERIFIED** | P2-B5 testID split + 108 game tests |
| 14 | Performance qualification | **PARTIAL** (earlier wave, emulator-only) | `performance.md` |
| 15 | Final SHA all four workflows green | **VERIFIED** | §1 |
| 16 | Certification + governance reports synchronized | **VERIFIED** | STATE/CURRENT_CAMPAIGN/this file |
| 17 | Independent reviewer accepts without blocking P1 | **BLOCKED_EXTERNAL** | §5 |

## 4. P2 dispositions

| ID | Finding | Disposition |
|---|---|---|
| B1 | Registry validation | **FIXED** — membership checked against authoritative registry, not a caller flag |
| B2 | Certified-vs-historical axis separation | **FIXED** |
| B3 | Content-bound results currency | **FIXED** — with lower-is-better exemption |
| B4 | Schema hardening / duplicate attempts / corrupt entries | **FIXED** — plus duplicate-attempt detection in the verifier |
| B5 | `trial-wrong` conflates wrong pick with miss | **FIXED app-side** — `trial-correct`/`trial-wrong`/`trial-missed`; `trial-wrong` kept ambiguous so archived evidence is never over-credited |
| B6 | Authoritative tutorial status | **FIXED** — returning players never forced to redo a tutorial |

## 5. Independent review — BLOCKED_EXTERNAL

The mandatory second independent adversarial review **did not run**. All three
routes failed for environmental reasons:

| Route | Failure |
|---|---|
| Claude Code (`claude-code-writer`) | OAuth session expired and could not be refreshed |
| Codex CLI (`codex-exec-writer`) | Sandbox rejected all process execution and repository writes — every probe NOT_PROBED |
| Built-in `reviewer` agent | Coding-plan quota exhausted (reset 2026-10-27) |

A static self-review is **not** substituted and will **not** be labelled
independent. The implementation author's own 205-test suite and the verifier's
independent re-hashing are strong internal evidence, but they are not
second-party verification of the certification engine. This is the single
largest outstanding item and the reason the campaign remains ACTIVE.

## 6. External limitations (not claimed)

- Physical Android device, ARM64, and iOS **runtime** — unavailable hardware.
  Build-only iOS CI is not runtime acceptance.
- TalkBack runtime interaction — setup not drivable automatically here.
- Owner subjective visual/aesthetic acceptance — owner decision, explicitly
  **PENDING** and not inferred.
- No L4 certification (requires verified resilience subcapabilities).
- 7 accepted dependency advisories remain under their established controls.
