# ADR-0005: Memory Variant Review (tasks.md 10.6)

**Status:** Accepted
**Date:** 2026-08-18
**Applies to:** `006r-core-integrity-correction` task 10.6

## Context

The catalog contains three "Memory *" games:

- `memory` — **Memory** (base)
- `memory-sequence-memory` — **Sequence Memory**
- `memory-pattern-tap-back` — **Pattern Tap Back**

Task 10.6 required auditing these for meaningful mechanical distinction, and
fixing documentation that claims a random-walk/path mechanic the implementation
does not actually perform.

## Mechanics (ground truth, read from each game's generator)

| Game | Pattern construction | Repeats within a sequence | Notes |
|---|---|---|---|
| `memory` | Uniform distinct-tile permutation slice of the grid | never | near-duplicate (Hamming) avoidance between rounds |
| `memory-sequence-memory` | Random tile draws with adjacency-duplicate suppression | allowed at distance ≥ 2, never adjacent | Simon-style score attack; short pad, timed |
| `memory-pattern-tap-back` | Uniform distinct-tile selection seeded at the previous round's last tile | never | **NOT grid-adjacency constrained** (see below) |

## Key audit finding: the "random-walk / path" claim is FALSE

Pattern Tap Back's earlier documentation (its `generator.ts` header and
`buildRandomWalk` comments, plus `.agent/tasks/005-a-memory-pattern-tap-back.md`)
described the round sequence as an **adjacency-constrained random walk on the
grid**. The implementation does **not** do this: `buildRandomWalk` picks
uniformly from all unvisited tiles (its own comment admitted adjacency "can
deadlock on small grids"), so it never constrains a step to a grid neighbor.

Consequences:

1. The random-walk/path documentation is factually wrong and is now **fixed**
   to describe the true distinct-span mechanic (this ADR + the corrected
   comments in `generator.ts`).
2. Pattern Tap Back is mechanically a near-duplicate of the base `memory`
   game — both produce a distinct-tile permutation sequence. Their only
   difference is that Pattern Tap Back seeds the next round's start at the
   previous round's endpoint (a continuity cue).

## Deliberate variant decision

Per the task, a duplicate must either be meaningfully differentiated or
formally consolidated. We do **not** silently preserve three "distinct" games
that are not distinct. Decision:

- **Sequence Memory** remains a materially distinct variant (repetition with
  disambiguated repeats + timing/score attack). No change.
- **Memory** and **Pattern Tap Back** are documented as **consolidated
  variants of the same distinct-span mechanic**. Pattern Tap Back is
  re-described (docs/code comments) as a distinct-span game with an endpoint-
  continuity seed, not as a path game. This removes the count-inflation false
  claim while keeping both names as user-facing variants of one mechanic.
- A **true adjacent-path** differentiation for Pattern Tap Back (a generator
  that enforces grid adjacency) is a tracked improvement, not required for
  honesty here; if implemented later it must keep the deterministic seed
  contract and pass the game's generator tests.

## Files changed

- `apps/mobile/src/games/memory-pattern-tap-back/generator.ts` — corrected the
  misleading "random-walk" comments to describe the true distinct-span mechanic.
- `docs/adr/0005-memory-variant-review.md` — this review.

Note: the historical campaign-005 task record `.agent/tasks/005-a-memory-pattern-tap-back.md`
(which described a random walk) is a past-campaign record and was not rewritten;
this ADR is the authoritative correction of the current product documentation.

## Consequence for the catalog

Parity matrix Memory row already lists the three games; Pattern Tap Back is
now accurately documented as a distinct-span variant rather than a path game.
No generator output changed, so deterministic session reproducibility is
unaffected.