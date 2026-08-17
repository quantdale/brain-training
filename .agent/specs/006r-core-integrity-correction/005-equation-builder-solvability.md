# 005 — Equation Builder Solvability and Difficulty Compatibility

**Priority:** P1 / blocking for Math rating integrity  
**Depends on:** 003  
**Primary surfaces:** `apps/mobile/src/games/math-equation-builder/**`  
**May run in parallel with:** 004

## Problem statement

Equation Builder now mixes curated templates and procedural generation. The curated fast path currently filters mainly by number count and target range, but a template may require an operator that the active difficulty does not allow. A deterministic fallback also claims to be guaranteed solvable without re-validating the exact final target/numbers/operator set.

A scored puzzle must never be emitted unless the active game rules can solve it.

## Canonical puzzle validity contract

For an emitted puzzle `P` under active difficulty parameters `D`, all of the following must hold:

1. `P.numbers.length === D.numbersCount`.
2. Every number satisfies the game bounds and integer rules.
3. The target is an integer within `[D.targetMin, D.targetMax]`.
4. Every offered operator is permitted by `D.operators`.
5. A valid expression exists using the exact player rules (including the required use of numbers, ordering/reordering policy, grouping, integer-division rule, and operator semantics).
6. The result is not a trivial/degenerate puzzle prohibited by difficulty rules.
7. The returned puzzle passes the same validator regardless of source: curated template, procedural candidate, or fallback.
8. Consecutive-round freshness/near-duplicate requirements are applied after validity, not instead of validity.

## First task: align solver with actual UI rules

Before changing templates, document the exact Equation Builder player rules from reducer/UI:

- Must every supplied number be used exactly once?
- Can the player reorder numbers?
- Are parentheses/grouping available?
- Is standard precedence used or explicit left-to-right/group semantics?
- Is division restricted to integer intermediate/final values?
- Can negative intermediate values occur?

The solver used for generation must model the same rules. If the current `evaluateAllResults` under- or over-approximates the player UI, correct the solver and tests first. Add an ADR/commented contract so future UI changes cannot silently diverge.

## Required generator changes

### A. Curated template compatibility

Before returning any curated template, validate it with the active difficulty/operator set using the canonical solver. A template that is generally solvable but not solvable with current operators is not compatible.

A compatibility predicate must check at least:

```text
numbersCount
target bounds
number bounds
operator/rule solvability
nontriviality policy
```

Do not infer compatibility only from comments describing one example solution.

### B. Procedural candidate validation

The procedural path must call the canonical validator before return, even if it generated the target from a solver result. This final check protects against later drift in target filtering or rule changes.

### C. Fallback redesign

The fallback must be genuinely guaranteed valid under the current difficulty.

Do not:

- generate a target and then clamp it to a range if clamping can break solvability;
- add filler numbers without constructing a valid expression that uses them according to player rules;
- silently reduce the allowed operator set returned to the UI if that changes the difficulty contract.

Preferred options:

1. choose from a small canonical per-difficulty fallback template set that is exhaustively validated at module initialization/tests; or
2. construct an expression first under the active rules, derive numbers/target from it, and validate the final puzzle.

If no valid puzzle can be produced after the bounded attempts and fallback set is unexpectedly invalid, fail loudly in development/tests with diagnostic seed/params rather than returning an unsolvable scored challenge.

### D. Versioning

Because the challenge-selection behavior changes, advance the appropriate generator version per Spec 003. If curated templates are split into a separately versioned pack, persist that pack identity/version as well.

## Required tests

### Exhaustive curated-template tests

For every template × every fixed difficulty:

- determine compatibility with the canonical validator;
- assert the generator never selects an incompatible template;
- for compatible templates, assert a valid solution exists under active operators/rules.

### Seed sweep

Run a deterministic sweep of at least:

- 500 seeds per fixed difficulty (`easy`, `normal`, `hard`, `expert`), and
- representative adaptive states covering minimum/mid/maximum numbers count/operator levels.

For every emitted round assert all canonical invariants.

The sweep should be large enough to cover curated and procedural paths. If curated templates dominate and hide procedural fallback, provide explicit tests for each branch.

### Fallback test

Inject/construct conditions that exhaust normal generation and force the fallback. Assert the fallback itself is fully valid and difficulty-compatible.

### Replay test

Persist a fixed provenance tuple and prove the same generator version/seed/difficulty reproduces the same puzzle sequence.

### UI/solver equivalence tests

For representative generated puzzles, construct at least one solver-found expression and feed it through the production reducer/evaluator path. It must evaluate to the target under the same rules.

## MUST acceptance criteria

- Every public generator return path invokes or is proven equivalent to the canonical final validator.
- No curated template can be selected when it requires unavailable operators/rules.
- No fallback can return a clamped-but-unsolvable target.
- Solver semantics match the actual player UI semantics and are documented.
- Seed sweeps pass across all fixed/adaptive configurations.
- Generator/content version is advanced appropriately.
- Targeted tests + full suite + typecheck pass.
- Emulator smoke completes at least Easy and Expert puzzles generated from current production path.

## Forbidden shortcuts

- Removing the failing curated template and leaving the compatibility bug in place.
- Testing only Normal difficulty.
- Treating a comment showing a solution as proof.
- Disabling division/grouping paths rather than aligning solver and UI.
- Returning a simpler operator set than the difficulty declares just to make the fallback solvable.