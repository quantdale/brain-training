# Design — 074-sdk-module-contract

## Context

See `proposal.md` — Why.

Measured at `2a765cc`:

- `registry.generated.ts:598` exposes each game screen as a bare
  `ComponentType`; `app/game/[id].tsx:99` casts it to the shape needed to inject
  `tutorialStore`.
- `__tests__/catalog-contracts.test.ts:160-176,231-273` — the session-lifecycle
  gate is satisfied by the shared host sources being in the scanned set;
  `:180` carries a stale catalog-size comment.
- `use-game-session.ts:154-178` — `begin()` has no duplicate-start guard;
  `game-host.tsx:286-292` is its caller.
- `games/speed-tap-rush/versions.ts:14-29` documents packing a "major
  component" while packing major/minor/patch, and rejects `null` that
  `sdk/types/game-definition.ts:44-60` and `docs/GAME_SDK.md` permit.
- `docs/GAME_SDK.md:53-69` omits `sdk/numeric.ts` and `sdk/perf.ts` from its
  module map.

Verified **clean** in the same lane, and preserved by this design: the registry is
42 entries, id-sorted, timestamp-free, with a working `--check` wired into all
app CI workflows; `registerGameDefinitions` is invoked exactly once inside the
bootstrap's fail-fast `catalog-registry` stage; RNG is xmur3→mulberry32 with
integer-only math and zero `Math.random` across all 42 generators, reducers,
scoring, and session files; BackHandler and AppState each have a single
subscription with correct cleanup; 42/42 screens intercept back during a
session; and the error boundary contains game subtree failures with
persistence failures surfaced in-band.

## Goals / Non-Goals

**Goals**

- A non-conforming game module fails at registration, named and specific.
- The loader boundary needs no unchecked conversion.
- A live session cannot be started twice.
- The lifecycle contract is verified per game and can actually fail.
- Version conversion matches its documented contract.

**Non-Goals**

- Redesigning the SDK's architecture or adding new gameplay capabilities.
- Changing any game's mechanics, scoring, difficulty, or UI.
- Re-deriving the registry generator (it is deterministic and gated).
- Fixing the vacuous gate by weakening it; it must become meaningful.

## Decisions

**D1 — Validate the module surface where the catalog is already validated.**
`defineGame` already re-validates and freezes each definition during the
bootstrap `catalog-registry` stage, and the registry generator already mirrors
`defineGame`'s validation. Extending that existing point to cover the *module*
surface costs one validation function and gives fail-fast, named, boot-time
detection with no new lifecycle.

- Chosen: validate the screen/injection surface at registration, in the same
  place the definition is validated.
- Rejected: type-only enforcement. The cast exists precisely because the surface
  is optional or untyped; a type assertion cannot validate a value that is
  `ComponentType`.
- Rejected: validate at render. That preserves the current failure mode
  (runtime crash inside a game) and loses the module name.

**D2 — Replace the cast with a typed boundary, not a stronger cast.** The cast
exists so the host can inject the tutorial store. Rather than a second cast,
express the injected surface as a declared prop on the game's screen type, so
the generated registry carries the real type and the route passes props the type
already describes.

**D3 — Make the lifecycle gate per-game by construction.** The current gate
scans a file set that includes the shared host sources, so the host's own
primitives satisfy it. Scanning only the 42 game module directories, and
asserting each module's absence of its own lifecycle primitives, makes the
result attributable to a game. The assertion must name the module so a failure is
actionable.

**D4 — Duplicate start: refuse, do not silently replace.** Silently starting
again would orphan the previous session — the current behavior. Refusing is the
honest behavior, and it must be distinguishable so a host that double-invokes
during a remount is visible rather than silent. The partial-state case in the
spec covers the start path failing after partial initialization, which must not
leave a timer or listener behind.

**D5 — Fix the version helper to the type, not the type to the helper.** The
SDK type and the SDK documentation both declare the generator version nullable
for non-procedural games, and at least one game legitimately has none. The
helper is the thing that is wrong: it documents one component and packs three.
Align the helper to the declared contract and correct its documentation, since
the declared type is the one 42 modules and the host already depend on.

## Risks / Trade-offs

- **Registration-time validation could reveal a real non-conforming module.**
  That is the point, but it must be handled as a found defect with its own fix,
  not by weakening the validator.
  → Mitigation: run the validation across the catalog first and record the
  result; if a module is non-conforming, fix it explicitly in this change.
- **Excluding shared host sources from the lifecycle scan could produce false
  positives** for a game that legitimately references a host primitive.
  → Mitigation: assert against *constructing* lifecycle primitives, not against
  referencing the shared host's exported helpers; the scan target is the game's
  own timer/subscription creation.
- **A duplicate-start guard could break a legitimate remount** that currently
  re-begins harmlessly.
  → Mitigation: the guard refuses only while the previous session is
  non-terminal; verify the remount and fast-refresh paths on device before
  convergence.
- **Making the injection prop typed touches the generated registry and 42
  modules' screen signatures.**
  → Mitigation: the generated file is produced by the generator, so the change
  is in the generator plus a typecheck; no hand-edited generated output.
- **Correcting the version helper changes persisted values for new sessions.**
  → Mitigation: existing sessions keep their stored value; only new writes are
  affected, and the packing is documented before and after.

## Migration Plan

1. Implement module-surface validation and run it across all 42 modules; record
   any non-conforming module found and fix it explicitly.
2. Replace the loader cast with the typed injection surface; regenerate the
   registry; typecheck.
3. Rewrite the lifecycle gate to scan game modules only; confirm it fails for a
   deliberately non-conforming module, then revert that probe.
4. Add the duplicate-start guard with its partial-state cleanup; run the host
   integration suites.
5. Correct the version helper and its documentation; add tests for the
   permitted absent-version case and for pack round-tripping.
6. Update `docs/GAME_SDK.md` (module map, catalog size, version contract).
7. No data migration. Rollback is a clean revert per step.

## Open Questions

None. Each defect has a single correct resolution, and step 1's outcome is a
finding to be handled, not an open design question.
