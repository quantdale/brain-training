# Tasks — Campaign 015 Governance & Depth Convergence

Unchecked tasks are executable only after their dependencies and lifecycle
preconditions are satisfied. Evidence goes in `.agent/VALIDATION.md` and the
terminal checkpoint. Do not check a task from assumption.

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

- [ ] 1.1 Atomically transition 014→015: set this change ACTIVE, update
      GOVERNANCE activeCampaign, CURRENT_CAMPAIGN, EXECUTION_PROMPT, STATE, and
      active ownership metadata; leave exactly one active campaign.
- [ ] 1.2 Refactor `scripts/validate-repo-state.mjs` so every active campaign
      unconditionally requires a matching OpenSpec directory; remove the 006R
      special-case missing-directory logic.
- [ ] 1.3 Validate change metadata ID/status, required proposal/design/tasks/
      EXECUTION/audit-map files, and every declared normative spec.
- [ ] 1.4 Parse deterministic active campaign/status fields from durable recovery
      docs or introduce one minimal structured state representation; do not use
      substring presence as the semantic gate.
- [ ] 1.5 Add focused tests for missing change, wrong change ID, PROPOSED vs
      ACTIVE mismatch, missing execution artifact/spec, and contradictory
      durable campaign IDs/statuses.
- [ ] 1.6 Run repository state + pinned OpenSpec validation and record evidence.

## 2. Bind swarm ownership to the active campaign

Depends on: 1.1–1.6.

- [ ] 2.1 Replace stale 006R `.agent/task-ownership.json` with a 015 ownership
      map using real repo-root paths (`apps/mobile/...`, `scripts/...`,
      `openspec/...`).
- [ ] 2.2 Require ownership `change` to equal governance/OpenSpec active campaign.
- [ ] 2.3 Require unique packet IDs, valid dependencies, and an acyclic
      dependency graph.
- [ ] 2.4 Replace protected/generated direct-match checks with overlap/intersection
      semantics so broad globs cannot swallow orchestrator-only/generated files.
- [ ] 2.5 Require each coder packet to declare cheap completion validation.
- [ ] 2.6 Add tests for stale change, duplicate packet ID, missing dependency,
      cycle, broad protected overlap, generated overlap, and missing validation.
- [ ] 2.7 Run the ownership validator against the real 015 packet map before any
      parallel coder wave.

## 3. Durable state and affected-area integrity

Depends on: 1.1–1.6.

- [ ] 3.1 Define the authoritative machine-readable campaign fields and document
      their relation to human Markdown recovery files.
- [ ] 3.2 Make repo-state validation detect contradictions across GOVERNANCE,
      CURRENT_CAMPAIGN, STATE, EXECUTION_PROMPT, OpenSpec, and ownership.
- [ ] 3.3 Add regression fixture(s) reproducing the 014/013 contradiction found
      at the audited baseline.
- [ ] 3.4 Extend `validate-affected.mjs` area rules for workout,
      personalization/mastery/spotlight, sync/data-portability,
      content/registry/provenance, and OpenSpec/governance.
- [ ] 3.5 Add tests/fixture coverage proving representative modern paths map to
      risk-based checks under `--strict`.
- [ ] 3.6 Decide whether active task packets should carry expected affected-area
      checks; if implemented, validate the declaration without forcing full
      hardening for localized work.
- [ ] 3.7 Keep `.agent/IMPACT_MAP.md` synchronized with executable rules.
- [ ] 3.8 Run affected-area planning over all files changed by workstreams 1–3.
- [ ] 3.9 Record exact gates owed by each downstream packet.

## 4. Repository hygiene and legacy state reconciliation

Depends on: 1.1–1.6.

- [ ] 4.1 Delete the two audited zero-byte root artifacts: `'` and
      `i.startsWith('home')`.
- [ ] 4.2 Add a narrowly-scoped root entry/hygiene validator with an explicit,
      documented allowlist/extension policy; do not ban empty fixtures
      repository-wide.
- [ ] 4.3 Add a regression test proving unexpected zero-byte root residue fails.
- [ ] 4.4 Reconcile 006R `change.json`/task lifecycle against the intended
      historical final SHA and evidence policy. Do not use unrelated current CI
      to close a historical final-SHA requirement without documentation.
- [ ] 4.5 Run repository/OpenSpec integrity after cleanup.

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

## 9. Performance and game-feel evidence

Depends on: 5.9, 6.7, 7.8, 8.9.

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

Depends on: 4.5, 5.9, 6.7, 7.8, 8.9, 9.1–9.6, 10.1–10.5.

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
