# Design — 072-navigation-and-error-surfaces

## Context

See `proposal.md` — Why.

Measured at `2a765cc`:

- `hooks/use-db-data.ts:20-27` — the hook returns a zeroed fallback together with
  `loaded: true` when the read fails; it exposes no `error`.
- `app/data-management.tsx:101,152` — destructures without `error`; the
  "no backups yet" empty state is therefore rendered on failure.
- `app/(tabs)/profile.tsx:427-432` — no loading state; `grep -c Skeleton` = 0,
  while `app/(tabs)/index.tsx:689` does render a home loading state.
- `app/results.tsx:515` `router.push("/")` and `app/rewards.tsx:812`
  `router.push("/(tabs)/profile")` push to top-level destinations, while
  `app/results.tsx:180` uses `useSafeBack("/")` for the same destination.
- `app/_layout.tsx:283` sets `headerShown: false` on the root stack;
  `data-management.tsx` renders no `BackLink`, while six sibling routes do.
- `__tests__/safe-back-catalog.test.ts:21-40` scans `src/games` only.
- `app/game-detail/[id].tsx:180,206` names "Back to Games"; push sites exist in
  `components/discovery/*`, `components/mastery/*`, `components/spotlight/*`,
  `app/progress-*`.
- `app/(tabs)/progress.tsx:183-192` uses a time-only 5 s window, while
  `progression/focus-sync.ts:12-25` already implements an input-aware gate
  (newest-session fingerprint or window) with in-flight dedupe.

## Goals / Non-Goals

**Goals**

- No screen shows a zeroed or empty-looking representation of data it does not
  have.
- A failed read is visible, retryable, and diagnosable.
- The history stack does not grow across top-level destinations.
- Every reachable screen can be left, and back goes where the UI says.
- Mutations are never hidden behind a time-based refresh window.

**Non-Goals**

- Redesigning the screen hierarchy or the tab structure.
- Prefetching, caching, or background refresh beyond what the input-aware gate
  already does.
- Changing any persisted data or the persistence layer.
- Splitting the eight oversized route files (recorded separately; it is a
  maintainability change, not a state-correctness one).

## Decisions

**D1 — Fix the seam, not each consumer.** The defect is that `useDbData`
collapses failure into success. Four screens consume it, and each would
otherwise need its own error handling — which is how the same bug recurs after
the next consumer is added. Widen the seam to report the four states, then
update consumers. Consumer-level fixes alone would leave the trap in place for
the next caller.

**D2 — Keep the generation guard.** The hook's generation counter prevents a
stale read from overwriting a newer one. Widening the return shape must not
disturb that; the guard is load-bearing and already tested.

**D3 — Use the navigation operation that matches the destination's depth.**
Tabs and root destinations are `replace`; detail and nested destinations are
`push`. The inconsistency is the defect: the same destination is reached by
`push` in one flow and by the safe-back `replace` in another, so behavior
depends on where the user came from. Unify on depth.

**D4 — Widen the regression guard's scan set, and make it bypass-resistant.**
The guard exists precisely to stop the bare-back pattern returning, and it works
— but only inside `src/games`. Scanning every file that can perform navigation
means a new route module anywhere is covered the moment it is added, instead of
requiring someone to remember to extend a list.

**D5 — Reuse the input-aware gate rather than write a third throttle.** The
repository already solved this problem once, in `progression/focus-sync.ts`,
with an input-aware fingerprint plus in-flight dedupe. Progress's time-only
window is an earlier, weaker version of the same idea. Reusing the existing gate
gives Progress the mutation-visibility property the rest of the app already has,
and removes a divergent implementation.

**D6 — Announce where back actually goes.** Rather than forcing every entry
path to reach Games, the screen should name the destination its back control
actually reaches. The alternative — overriding back on four entry paths to
satisfy one label — would fight the user's actual history.

## Risks / Trade-offs

- **Adding an error state to Data Management and Profile changes what the user
  sees on a transient failure.**
  → Mitigation: this is the intended fix; a failed read currently looks
  identical to "you have nothing". Add retry, and keep the error copy
  non-alarming and non-technical.
- **Replacing instead of pushing changes back behavior in flows that relied on
  returning to a pushed screen.**
  → Mitigation: audit each push site and confirm the destination is top-level
  before converting; verify the affected journeys on the dedicated AVD.
- **A wider guard may flag pre-existing patterns in newly scanned files.**
  → Mitigation: fix what it finds; the point is that the guard now sees the
  whole surface. Record any finding that is a deliberate exception with a
  comment, so the next reader does not "fix" it back.
- **Wider hook return shape touches 12 call sites.**
  → Mitigation: additive change — existing consumers keep working; the
  correctness fix lands where it matters.
- **Removing a time window could increase refresh frequency.**
  → Mitigation: the input-aware gate already dedupes in flight and short-circuits
  on an unchanged fingerprint, so the extra work is a comparison, not a reload.

## Migration Plan

1. Widen `useDbData` to report loading/success/empty/failure; keep the
   generation guard; add seam tests including the stale-read case.
2. Update Data Management and Profile to render loading, failure, empty, and
   loaded states distinctly, with retry.
3. Widen the safe-back guard's scan set; fix what it finds.
4. Convert top-level `push` call sites to `replace`; add the back-affordance to
   Data Management; correct game detail's announced destination.
5. Replace Progress's time-only throttle with the existing input-aware gate.
6. Verify each changed journey on the dedicated AVD.
7. No data migration. Rollback is a clean revert per step.

## Open Questions

None. Each change is a correction toward behavior the rest of the app already
implements.
