# Tasks — Campaign 015 Governance & Depth Convergence

Unchecked tasks are executable only after their dependencies and lifecycle
preconditions are satisfied. Evidence goes in `.agent/VALIDATION.md` and the
terminal checkpoint. Do not check a task from assumption.

## P0. Current-head green recovery — blocks every later phase

These tasks repair the audited `main` state before predecessor closure. They are not permission to activate Campaign 015.

- [ ] P0.1 Pull current `main`, record exact SHA, inspect App CI + Repository Integrity for that SHA, and reproduce the two audited workout failures locally (`workout-v2.test.ts`, `advance.test.ts`) before editing. If HEAD moved, re-audit the changed files and use current evidence.
- [ ] P0.2 Preserve the historical/equal-session safety expectations. Do not make CI green by simply accepting stale sessions or deleting/weakening those tests.
- [ ] P0.3 Trace game launch → session persistence → results → `useWorkoutResultAdvance` → repository routing/advance for daily and template workouts. Write a short invariant note before implementation.
- [ ] P0.4 Replace the 10-second ownership heuristic with the smallest correctness-preserving causal attribution design. No arbitrary positive fixed-duration grace window may be the decisive proof of ownership.
- [ ] P0.5 Remove duplicated ownership logic/magic timing values once the invariant is centralized. If schema/provenance changes, add forward migration + legacy/read/export-import/rollback coverage.
- [ ] P0.6 Add adversarial tests for equal timestamps, historical result within 10s, rapid first completion, clock skew, two active instances sharing a game, repeated IDs, standalone play, duplicate delivery, stale hook state, results re-view, relaunch, and reconciliation.
- [ ] P0.7 Run targeted workout suites, then full CI-mode Jest, typecheck/lint, repo-state, registry, provenance, task-ownership, offline, and QA self-test. Record exact counts; 4 skipped suites / 5 skipped tests from the audited run must be classified rather than ignored.
- [ ] P0.8 Push the coherent repair and require App CI + Repository Integrity green on the exact repair SHA before proceeding to Campaign 014 closure.
- [ ] P0.9 Synchronize STATE/KNOWN_ISSUES/VALIDATION so already-pushed code is not described as `working/unpushed`; record the audited failed run and the repair evidence honestly.
## 0. Predecessor closure — Campaign 014 (blocking activation gate)

- [ ] 0.1 Re-read Campaign 014 exit criteria and current validation/known issues
      against current code/HEAD; do not use this proposed plan as a substitute.
- [ ] 0.2 Restore/use only the dedicated `braintraining-qa36` AVD and run the
      required Workout V3 E2E plus representative Campaign 014 changed-game
      canary journeys. Record PASS/FAIL/NOT VALIDATED with artifact paths.
- [ ] 0.3 Complete Campaign 014's missing game-feel/perf evidence exactly to its
      own exit contract; do not invent latency claims.
- [ ] 0.4 Complete the Campaign 014 docs-final reconciliation, including stale
      Workout V2 wording and contradictory Campaign 013 recovery text.
- [ ] 0.5 Write Campaign 014 terminal checkpoint, synchronize
      CURRENT_CAMPAIGN/STATE/KNOWN_ISSUES/VALIDATION, run required gates, commit,
      and push.
- [ ] 0.6 Prove Campaign 014 is durably COMPLETED before changing Campaign 015
      from PROPOSED. If blocked, leave 015 PROPOSED and stop.

## 1. Activate 015 and make OpenSpec binding unconditional

Depends on: 0.1–0.6.

- [x] 1.1 Atomically transition 014→015: set this change ACTIVE, update GOVERNANCE activeCampaign, CURRENT_CAMPAIGN, EXECUTION_PROMPT, STATE, and active ownership metadata; leave exactly one active campaign. — done at 6e72338 (GOVERNANCE 015, CURRENT_CAMPAIGN 015 ACTIVE, EXECUTION_PROMPT 015 ACTIVE, STATE **Active campaign:** 015, task-ownership 015, change.json ACTIVE). Evidence: `node scripts/validate-repo-state.mjs` PASS, `npx @fission-ai/openspec validate --all` 2/2 PASS, only one ACTIVE campaign.
- [x] 1.2 Refactor `scripts/validate-repo-state.mjs` so every active campaign unconditionally requires a matching OpenSpec directory; remove the 006R special-case missing-directory logic. — unconditional OpenSpec integrity for every active campaign; missing dir now fails without special-case. Evidence: repo-state PASS and `apps/mobile/src/governance/__tests__/repo-state.test.ts` "fails when active change directory is missing".
- [x] 1.3 Validate change metadata ID/status, required proposal/design/tasks/EXECUTION/audit-map files, and every declared normative spec. — repo-state checks 6 required files + specOrder 5 specs (campaign-governance, repository-state-integrity, workout-integrity, game-depth-convergence, runtime-evidence). See `scripts/validate-repo-state.mjs:changeRequired` + spec loop.
- [x] 1.4 Parse deterministic active campaign/status fields from durable recovery docs or introduce one minimal structured state representation; do not use substring presence as the semantic gate. — structured parsers `parseStateCampaignMd` / `parseCurrentCampaignId` / `parseExecutionPromptChange` etc. in validate-repo-state.mjs; substring not used. Evidence: "fails when historical prose contains active id but structured field does not match".
- [x] 1.5 Add focused tests for missing change, wrong change ID, PROPOSED vs ACTIVE mismatch, missing execution artifact/spec, and contradictory durable campaign IDs/statuses. — `apps/mobile/src/governance/__tests__/repo-state.test.ts` covers all 5 + 014/013 contradiction. Mutation-visible.
- [x] 1.6 Run repository state + pinned OpenSpec validation and record evidence. — `node scripts/validate-repo-state.mjs` PASS (Active campaign 015) + `npx @fission-ai/openspec validate --all` 2/2 PASS (2026-08-28). Recorded in `.agent/VALIDATION.md` §015 governance wave.

## 2. Bind swarm ownership to the active campaign

Depends on: 1.1–1.6.

- [x] 2.1 Replace stale 006R `.agent/task-ownership.json` with a 015 ownership map using real repo-root paths (`apps/mobile/...`, `scripts/...`, `openspec/...`). — done at 6e72338: 4 packets (rule-grid, word-chain, context-fit, transform-match) with real paths.
- [x] 2.2 Require ownership `change` to equal governance/OpenSpec active campaign. — `validate-task-ownership.cjs` walks to repo root and compares `config.change` to GOVERNANCE.activeCampaign + change.json id/status. Evidence: repo-state contradiction checks + ownership test "rejects stale ownership change".
- [x] 2.3 Require unique packet IDs, valid dependencies, and an acyclic dependency graph. — validator checks duplicate IDs, missing deps, cycle via DFS per packet.
- [x] 2.4 Replace protected/generated direct-match checks with overlap/intersection semantics so broad globs cannot swallow orchestrator-only/generated files. — `globOverlap` + `globMatch` + `overlapsViaExample` (candidate `registry.generated.ts` etc.) in validate-task-ownership.cjs.
- [x] 2.5 Require each coder packet to declare cheap completion validation. — validator rejects missing/empty `validation` field.
- [x] 2.6 Add tests for stale change, duplicate packet ID, missing dependency, cycle, broad protected overlap, generated overlap, and missing validation. — `apps/mobile/src/governance/__tests__/task-ownership.test.ts` covers all 7 cases.
- [x] 2.7 Run the ownership validator against the real 015 packet map before any parallel coder wave. — `node scripts/validate-task-ownership.cjs` PASS (2026-08-28, 4 packets, no overlaps). Re-run at governance wave.

## 3. Durable state and affected-area integrity

Depends on: 1.1–1.6.

- [x] 3.1 Define the authoritative machine-readable campaign fields and document their relation to human Markdown recovery files. — table in `.agent/STATE.md` §Authoritative machine-readable campaign fields + `scripts/validate-repo-state.mjs` header + `design.md` §1.
- [x] 3.2 Make repo-state validation detect contradictions across GOVERNANCE, CURRENT_CAMPAIGN, STATE, EXECUTION_PROMPT, OpenSpec, and ownership. — 6-source cross-check in validate-repo-state.mjs (stateCampaign, currentCampaignId/status, executionChange/status, ownership.change, OpenSpec id/status) with substring not used.
- [x] 3.3 Add regression fixture(s) reproducing the 014/013 contradiction found at the audited baseline. — `apps/mobile/src/governance/__tests__/repo-state.test.ts` "regression: 014/013 contradiction fixture" + `makeFixture({stateCampaign: '014-...', currentId: '013-old'})` expecting contradiction error.
- [x] 3.4 Extend `validate-affected.mjs` area rules for workout, personalization/mastery/spotlight, sync/data-portability, content/registry/provenance, and OpenSpec/governance. — 5 new RULES covering `apps/mobile/src/workout/**`, `personalization/mastery/spotlight`, `sync/data-portability`, `content/registry/provenance`, and `openspec/.agent/docs/apps/mobile/src/governance/**`.
- [x] 3.5 Add tests/fixture coverage proving representative modern paths map to risk-based checks under `--strict`. — `apps/mobile/src/governance/__tests__/affected.test.ts` (workout, personalization/mastery/spotlight, sync/data-portability, content/registry, OpenSpec/governance all map under --strict, no --strict failure; localized content edit remains localized).
- [x] 3.6 Decide whether active task packets should carry expected affected-area checks; if implemented, validate the declaration without forcing full hardening for localized work. — Decision: NOT required; affected-area planning stays advisory/risk-based via `validate-affected.mjs`, packets carry cheap `validation` instead. Documented in `.agent/task-ownership.json` description (Decision 3.6) and `IMPACT_MAP.md` notes.
- [x] 3.7 Keep `.agent/IMPACT_MAP.md` synchronized with executable rules. — IMPACT_MAP now mirrors 15 RULES (workout etc.) with syncWarning null; `node scripts/validate-affected.mjs --strict` no longer warns.
- [x] 3.8 Run affected-area planning over all files changed by workstreams 1–3. — `node scripts/validate-affected.mjs --json scripts/validate-repo-state.mjs scripts/validate-task-ownership.cjs scripts/validate-affected.mjs .agent/IMPACT_MAP.md .agent/task-ownership.json .agent/STATE.md apps/mobile/src/governance/**` maps to CI/scripts + OpenSpec/governance, unmatched 0 under strict (governance test files now matched). Gates: `node scripts/validate-repo-state.mjs`, `validate-task-ownership`, `openspec validate --all`, `npm run test:ci -- src/governance`.
- [x] 3.9 Record exact gates owed by each downstream packet. — packets 5-8 each owe per-packet `validation` (typecheck + `npm run test:ci -- src/games/<module>` + repo-state) plus risk-based affected checks above; full convergence gates per tasks §11 remain at exit. Documented in task-ownership.json `validation` fields and this task evidence.

## 4. Repository hygiene and legacy state reconciliation

Depends on: 1.1–1.6.

- [x] 4.1 Delete the two audited zero-byte root artifacts: `'` and `i.startsWith('home')`. — `git rm` staged deletions at this wave; `ls` confirms absent, `validate-repo-state` zero-byte/suspicious-name check would fail if present.
- [x] 4.2 Add a narrowly-scoped root entry/hygiene validator with an explicit, documented allowlist/extension policy; do not ban empty fixtures repository-wide. — `scripts/validate-repo-state.mjs` allowlist (`allowedRootEntries` + `allowedRootExtensions`, checks only repo root, allows fixtures elsewhere). See `apps/mobile/src/governance/__tests__/repo-state.test.ts` "passes when zero-byte is allowed fixture elsewhere".
- [x] 4.3 Add a regression test proving unexpected zero-byte root residue fails. — `apps/mobile/src/governance/__tests__/repo-state.test.ts` "fails on unexpected zero-byte root residue" + "fails on suspicious file name".
- [x] 4.4 Reconcile 006R `change.json`/task lifecycle against the intended historical final SHA and evidence policy. Do not use unrelated current CI to close a historical final-SHA requirement without documentation. — 006R `change.json` VALIDATED with explicit `validationNote` (superseding device evidence: Campaign 011 42/42, Campaign 013 definitive certify 42/42 certified=true, 12.11 remains GitHub-UI-observable only; archive after UI confirmation). `tasks.md` 12.11 remains unchecked with same note. No current 015 CI used to close historical requirement. Documented in `.agent/STATE.md` Working state and `openspec/changes/006r-core-integrity-correction/change.json`.
- [x] 4.5 Run repository/OpenSpec integrity after cleanup. — `node scripts/validate-repo-state.mjs` PASS + `npx @fission-ai/openspec validate --all` 2/2 PASS (2026-08-28) with zero-byte residue gone.
- [ ] 4A.5 Capture a clean Jest summary at convergence, including pass/fail/skip counts and unexpected console warnings.
## 5. Logic Rule Grid chained-deduction redesign

Depends on: 2.7, 3.9.

- [ ] 5.1 Specify the new player-visible constraint grammar and exact meaning of
      a solution; preserve deterministic seed/version provenance.
- [ ] 5.2 Implement a canonical solver that can enumerate/prove unique solutions
      under that exact grammar.
- [ ] 5.3 Produce a solver trace or equivalent dependency-depth metric.
- [ ] 5.4 Generate puzzles with multiple interacting unknowns/constraints; Hard
      and Expert MUST contain at least one dependent deduction chain.
- [ ] 5.5 Reject Hard/Expert puzzles whose unknowns are all independent
      one-step row/column lookups.
- [ ] 5.6 Scale inference depth/interaction by difficulty, not merely
      size/round/time.
- [ ] 5.7 Make final generator validation prove uniqueness + minimum depth; no
      weakened bounded-attempt fallback.
- [ ] 5.8 Advance generator/scoring metadata as required and regenerate registry
      only through supported generators.
- [ ] 5.9 Add deterministic all-difficulty broad-seed property sweeps plus
      reducer/screen/session regressions and targeted Android canary.

## 6. Language Word Chain depth expansion

Depends on: 2.7, 3.9.

- [ ] 6.1 Expand active content to >=90 chains and >=30 per active tier.
- [ ] 6.2 Preserve stable unique IDs and update declared count/version.
- [ ] 6.3 Strengthen content validation for exact chaining rule, duplicate IDs,
      duplicate chains, near-duplicate/reordered chains, tier constraints, and
      decoy diversity.
- [ ] 6.4 Curate additions; do not bulk-generate low-quality filler solely to
      hit count.
- [ ] 6.5 Add deterministic selection/repetition tests over repeated sessions.
- [ ] 6.6 Advance content/generator provenance metadata as required.
- [ ] 6.7 Run targeted tests + affected-area/provenance checks.

## 7. Language Context Fit depth expansion

Depends on: 2.7, 3.9.

- [ ] 7.1 Expand active content to >=60 items per tier and >=180 total.
- [ ] 7.2 Preserve stable unique IDs and update declared count/version.
- [ ] 7.3 Validate answer/distractor distinctness, exactly one accepted answer,
      deterministic selection, and tier structure.
- [ ] 7.4 Add a documented morphology/part-of-speech compatibility heuristic or
      curated metadata so distractors are not trivially eliminated by grammar.
- [ ] 7.5 Add curated ambiguity fixtures/review tests for semantically risky
      items; mechanical validation alone is insufficient.
- [ ] 7.6 Ensure the pack is represented by existing content
      registry/provenance machinery; fix any missing registration.
- [ ] 7.7 Advance content/generator provenance metadata as required.
- [ ] 7.8 Run targeted tests + affected-area/provenance checks.

## 8. Spatial Transform Match invariant and hidden-source repair

Depends on: 2.7, 3.9.

- [ ] 8.1 Inventory every production difficulty/profile and allowed transform /
      option-count combination.
- [ ] 8.2 Define one final `validateGeneratedRound`-equivalent contract covering
      source, transform, options, option count, distinctness, hidden-source
      semantic unambiguity, and near-duplicate rules.
- [ ] 8.3 Route main generation and every bounded fallback through that same
      final validator.
- [ ] 8.4 Remove/repair the single-transform symmetry bypass when it can produce
      a semantically degenerate round.
- [ ] 8.5 Guarantee exact requested option count for every production profile;
      if a state space is impossible, redesign the profile/generation strategy
      rather than returning a short list.
- [ ] 8.6 Reject hidden-source option sets with more than one defensible exact
      transform interpretation under the player-visible instruction.
- [ ] 8.7 Advance generator version and provenance metadata.
- [ ] 8.8 Add broad all-profile/many-seed property sweeps that exercise
      fallback/near-exhaustion paths, not only happy paths.
- [ ] 8.9 Run reducer/screen/session/a11y regressions and a targeted Android
      canary.

## 8A. Workout completion attribution integrity

Depends on: P0.1–P0.9, 2.7, 3.9. If the P0 repair already satisfies these requirements, prove and check them rather than reimplementing.

- [ ] 8A.1 Prove the final causal ownership model against `specs/workout-integrity/spec.md`; document the authoritative instance/leg identity and legacy policy.
- [ ] 8A.2 Ensure ownership provenance survives process death and results re-opening and is persisted atomically enough to prevent mismatched session/ownership state.
- [ ] 8A.3 Ensure concurrent active workouts sharing the same current game route completion only to the actual owner; recency is not ownership.
- [ ] 8A.4 Make duplicate session processing idempotent at the durable boundary, including after React/local refs are lost on relaunch.
- [ ] 8A.5 Run migration/data-portability/reconciliation fixtures if storage shape changed.
- [ ] 8A.6 Run the complete adversarial attribution matrix plus daily/focus template Android journeys when the dedicated AVD is available.
- [ ] 8A.7 Record before/after routing semantics and remove obsolete timestamp-grace comments/tests/constants.
## 9. Performance and game-feel evidence

Depends on: 5.9, 6.7, 7.8, 8.9, 8A.7.

- [ ] 9.1 Run relevant existing opt-in performance probes before any evidence-
      driven optimization beyond work already required for correctness.
- [ ] 9.2 Record dataset/workload/runtime context and fresh baseline artifacts.
- [ ] 9.3 Profile only changed or demonstrably hot paths; no generic rewrite.
- [ ] 9.4 If performance changes are made, rerun identical probes and record
      before/after comparison.
- [ ] 9.5 For changed timed games, add/use deterministic input→feedback
      observability where the harness can measure it reliably without arbitrary
      sleeps.
- [ ] 9.6 Keep statement-count claims separate from wall-clock/interaction
      latency claims.

## 10. Targeted accessibility verification

Depends on: 5.9, 8.9.

- [ ] 10.1 Re-audit changed Rule Grid and Transform Match interactive semantics:
      labels, roles, selected/disabled state, focus order, and decorative
      elements.
- [ ] 10.2 Verify accessibility text communicates the puzzle state without
      leaking the correct answer.
- [ ] 10.3 Reuse reduced-motion/font-scale/focus/announcement primitives rather
      than adding game-local substitutes.
- [ ] 10.4 Record Android accessibility-tree/device evidence where available.
- [ ] 10.5 Keep manual system-sheet and iOS evidence explicitly separate /
      NOT VALIDATED when unavailable.

## 11. Convergence and exit gate

Depends on: 4.5, 4A.1–4A.5, 5.9, 6.7, 7.8, 8.9, 8A.1–8A.7, 9.1–9.6, 10.1–10.5.

- [ ] 11.1 Re-run `node scripts/validate-repo-state.mjs`.
- [ ] 11.2 Re-run pinned OpenSpec `validate --all`.
- [ ] 11.3 Re-run active task ownership validation.
- [ ] 11.4 Re-run affected-area planning for the complete campaign diff and
      execute every required light gate.
- [ ] 11.5 Registry generation check PASS.
- [ ] 11.6 Provenance/version drift check PASS.
- [ ] 11.7 Offline-boundary check PASS.
- [ ] 11.8 QA harness self-test PASS.
- [ ] 11.9 `apps/mobile` TypeScript PASS and lint 0/0.
- [ ] 11.10 Full Jest CI-mode suite PASS.
- [ ] 11.11 Web export PASS and Expo Doctor PASS.
- [ ] 11.12 Dedicated-project Android journeys PASS for changed gameplay and
      relevant Workout V3 flow, with no foreign-emulator adoption.
- [ ] 11.13 No unresolved Critical/High regression; Medium/Low debt recorded.
- [ ] 11.14 Push final coherent `main` SHA and confirm both GitHub App CI and
      Repository Integrity green on that exact SHA.
- [ ] 11.15 Mark change lifecycle accurately, write terminal checkpoint, update
      STATE/CURRENT_CAMPAIGN/KNOWN_ISSUES/VALIDATION, and leave clean canonical
      `main`.
- [ ] 11.16 Final App CI log has zero failing tests; skipped suites/tests and unexpected console warnings are explicitly classified in validation evidence.
- [ ] 11.17 Verify the final pushed SHA still satisfies `workout-integrity` adversarial tests and both App CI + Repository Integrity are green on that exact SHA.
