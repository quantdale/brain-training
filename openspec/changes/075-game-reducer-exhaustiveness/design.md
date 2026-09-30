# Design — 075-game-reducer-exhaustiveness

## Context

See `proposal.md` — Why.

Measured at `2a765cc` across all 42 reducers: each has exactly one `default:`
branch, each returns the current state, none uses a true exhaustiveness
assertion, and 27 carry the comment `// Exhaustiveness guard: every action is
handled above.` The comment is present at `speed-tap-rush/reducer.ts:422-425`
and its 26 verbatim siblings; the remaining 15 have the same
`default: return state` shape without the claim.

## Goals / Non-Goals

**Goals**

- An unhandled action in any game is a compile-time error naming the member.
- No code comments claim a guarantee the code does not provide.
- The requirement is enforced catalog-wide, including future games.

**Non-Goals**

- Changing any game's state machine logic, transitions, phases, or timing.
- Restructuring reducers or adopting a different state-management pattern.
- Generating reducers.

## Decisions

**D1 — Use the exhaustiveness pattern the type system already supports.** A
discriminated-union switch that assigns the residual action to `never` is the
standard way to make an unhandled member a compile error. It needs no new
dependency and no new abstraction, and the failure message names the member.

- Chosen: after the switch, an assertion that the residual action is `never`,
  placed where the compiler can narrow to it, so removing a handler becomes a
  type error.
- Rejected: a runtime `throw` in `default`. It converts a silent no-op into a
  crash at the worst moment (mid-gameplay), when a compile error is available.
- Rejected: generating reducers or adopting a reducer library — disproportionate
  for a one-branch change with no behavioral effect.

**D2 — Make the fallback honest about what it is.** A well-typed caller cannot
produce an out-of-union action, so the branch exists only as a runtime safety
net. It must fail loudly rather than silently no-op (a value that reaches it
indicates a bug), but it must not be reachable for a *declared* action, or D1
would be defeated. Ordering the branches is what distinguishes the two cases.

**D3 — Express the pattern once.** 42 copies of the same three lines recreates
the duplication that produced this problem. A small shared helper in the SDK —
where the RNG and numeric helpers already live, and which the reducers already
import from — makes the pattern one named concept with one docstring, and lets
the catalog test assert a uniform shape.

**D4 — Enforce catalog-wide, and make the test able to fail.** A source-shape
test proves presence rather than correctness, but it is what stops a *new* game
from reintroducing the silent fallback. Pair it with the compile-time assertion,
which is what actually proves correctness, and have the test also fail if it
finds the misleading comment, so a future edit cannot reintroduce a claim the
code does not keep.

**D5 — Fix the comments as part of the change.** The 27 misleading comments are
the visible artifact of the problem; leaving them would leave the next reviewer
skipping a check that does not exist.

## Risks / Trade-offs

- **The exhaustiveness assertion may reveal a genuinely unhandled action in an
  existing game.** That is a found defect and must be fixed, not silenced by
  widening the union.
  → Mitigation: typecheck first and treat any hit as a real finding; the 42
  reducers were written to the same template, so the expected result is zero.
- **Making the runtime fallback throw changes behavior for out-of-union input.**
  Today it is silently ignored.
  → Mitigation: no well-typed caller can produce it, so the path is currently
  unreachable; add a test asserting the fallback is not reached for declared
  actions.
- **A shared helper adds an SDK import to 42 reducers.**
  → Mitigation: the reducers already import from the SDK, so this adds no new
  dependency edge. Keep the helper dependency-free.
- **A source-shape test can be satisfied by a comment.**
  → Mitigation: the test asserts the assertion's presence and the misleading
  comment's absence; correctness comes from the compiler, and the test's only job
  is to keep new games honest.

## Migration Plan

1. Add the shared exhaustiveness helper to the SDK.
2. Convert one reducer, typecheck, and run its suite to prove the pattern and
   the no-behavior-change claim.
3. Convert the remaining 41; remove the 27 misleading comments.
4. Add the catalog-wide verification; prove it fails against a deliberately
   silent fallback, then revert the probe.
5. Full matrix, typecheck, lint, and a device smoke across several games to
   confirm no behavioral change.
6. No data migration, no schema change. Rollback is a clean revert; the pattern
   is behavior-preserving by construction.

## Open Questions

None.
