# Design — 073-workout-lifecycle-durability

## Context

See `proposal.md` — Why.

Measured at `2a765cc`:

- `components/game-host/session-provenance.ts:36` — `pendingLaunches` is an
  in-process map; `use-game-session.ts:169` populates it at session **start**;
  `db/sessions.ts` reads it during `completeSession` to attach provenance to the
  stored raw result.
- The advance is then UI-driven and one-shot per mount:
  `components/game-host/results.tsx:222-232` and
  `src/workout/use-workout-result-advance.ts:88`, both ref-guarded. No caller
  scans persisted sessions for a completed leg whose workout position never
  advanced.
- `app/(tabs)/index.tsx:841-877` maps over the workout's games and launches each
  with `legIndex: index` with no `index === workoutIndex` guard, so "Up next"
  produces a tuple that is false against the durable row;
  `components/game-host/game-host.tsx:205` prints "Game N of M" from that tuple.
- `db/workout.ts:589-598` (reroll CAS) vs `:744-750` (advance CAS): the advance
  includes `status='active'` and the stored-shape/bounds checks; the reroll does
  not.
- No abandon transition exists: `grep -rn abandon` finds only a comment at
  `game-host.tsx:179`; `MAX_REROLLS_PER_DAY = 5` and `REROLL_COST_COINS = 25`
  at `src/workout/reroll.ts:29,32`.
- Verified **clean** in the same lane, and therefore preserved by this design:
  exactly-once leg advance at the DB boundary (CAS re-check inside the
  transaction; duplicate/relaunch rejection); the campaign-056
  substitute-and-preserve rule (played prefix byte-identical, `completed` rows
  immutable, 12 reconcile cases + end-to-end coverage); reroll economy (debit +
  transition in one transaction, `operationId` ledger dedupe, CAS conflict rolls
  the debit back).

## Goals / Non-Goals

**Goals**

- A completed leg and the stored position converge, even across a process death.
- Leg ownership is derivable from persisted state.
- A player can leave a leg for free and explicitly.
- Every write to a workout position validates the same preconditions.

**Non-Goals**

- Changing workout length, game selection, scoring, XP, or currency amounts.
- Rewriting the substitute-and-preserve reconciliation, which is correct.
- Changing reroll economics beyond ensuring the write is as safe as the advance.
- Adding a paid skip; the point is that a free, explicit exit exists.

## Decisions

**D1 — Reconcile on launch rather than making the advance part of session
commit.** Folding the advance into `completeSession` would be the strongest
guarantee, but it couples the session write path to workout semantics for every
game — the exact coupling the campaign-056 layering work removed, and it would
break standalone sessions, which must never claim a leg.

- Chosen: a startup reconciliation that scans for sessions carrying persisted
  workout provenance whose leg is behind the stored position, and advances the
  position. It is bounded, idempotent, and runs where the app already
  reconciles other things at boot.
- Rejected: fold the advance into `completeSession`. Correctness gain is small
  (the window is narrow and the transaction already commits), and the layering
  cost is high and permanent.
- Rejected: rely on the UI advance with a longer timeout. The window is a
  process death, not a race; no timeout closes it.

**D2 — Make ownership durable, and keep the in-memory map as a fast path.** The
provenance is already persisted *inside the session's raw result*, which is the
durable record. The gap is that the decision to attach it depends on an
in-process map.

- Chosen: derive ownership from the persisted provenance on the session, and use
  the launch tuple only as an assertion. A session without persisted provenance
  cannot advance a leg. This makes the spec's "derivable from persisted state"
  literally true and makes the reconciliation in D1 possible.

**D3 — Fix "Up next" by removing the false tuple, not by adding a branch.**
Launching a later leg with its own index is only ambiguous because the tuple is
trusted. Two coherent options: disallow launching a non-current leg from Home, or
record the jump as an explicit advance to that leg. The first is smaller and
matches the "one leg at a time" model; the second preserves the affordance.

- Chosen: keep the affordance but make it honest — the launch records an explicit
  jump (advancing the position to the chosen leg, with the skipped prefix marked
  skipped, which D4 introduces anyway), and the "Game N of Y" indicator is
  derived from the stored position rather than from the launch tuple.
- Rejected: silently keep the current behavior. It is the source of a durable
  inconsistency.

**D4 — Introduce a skip transition, and reuse it for abandonment.** A free,
explicit skip serves two needs: a player who dislikes the leg, and a player who
wants to end the workout. It is recorded as `skipped`, distinct from `completed`,
awards no leg rewards, and is bounded — a bounded allowance prevents a workout
from being trivially completed for participation value while keeping the escape
free. The allowance must be communicated, not discovered.

**D5 — One writer, one precondition set.** The advance CAS already encodes the
correct preconditions. Making the reroll match it — `status='active'`, plus the
stored-shape and bounds validation, plus a shared helper so the two cannot drift
again — is the fix. Prefer a shared compare-and-set helper over duplicating the
conditions, because the divergence here is precisely what duplication causes.

**D6 — Skip touches the reward path, so state it explicitly.** Because a skipped
leg must not award completion rewards, and rewards are granted by the session
completion path, "skipped" must be persisted in a form the reward path can
honor. That is a data-model change, so the design records the migration and its
idempotency rather than leaving it implicit.

## Risks / Trade-offs

- **A startup reconciliation could advance a workout on evidence of a session
  that the player abandoned deliberately.**
  → Mitigation: reconcile only against sessions carrying persisted provenance,
  and only forward to the highest such leg; a leg with no completed session
  stays current.
- **Adding a `skipped` status changes the workout row's state machine.**
  → Mitigation: additive enum value with a default for existing rows; the
  existing reconcile path already handles `completed` as terminal, so `skipped`
  must be handled the same way.
- **Making ownership durable could change which sessions carry provenance**, and
  therefore which sessions can advance a leg.
  → Mitigation: this is the intended correction; run the full workout and
  session-advance suites and assert standalone sessions still never claim a leg.
- **A free skip could be used to farm participation XP.**
  → Mitigation: the skip allowance is bounded and skipped legs award no
  completion rewards; verify the participation path does not scale with skipped
  legs.
- **Fixing the reroll CAS could reject writes that previously succeeded against
  a degenerate row.**
  → Mitigation: that is intended; such a row should not be writable. Record any
  row found in the wild during validation rather than silently repairing it.

## Migration Plan

1. Add the shared compare-and-set helper; migrate advance and reroll onto it;
   prove the reroll now rejects a completed workout and a degenerate list.
2. Persist a `skipped` leg state (additive migration, idempotent) and have the
   reward path honor it.
3. Add the skip transition to the workout UI with a visible allowance.
4. Derive leg ownership from persisted provenance; keep the launch tuple as an
   assertion.
5. Make "Up next" record an explicit jump; derive the position indicator from the
   stored position.
6. Add the startup reconciliation and make it idempotent.
7. Validate on the dedicated AVD, including a forced process kill between session
   commit and advance — the exact window this change exists to close.
8. No reward or scoring change. Rollback is a clean revert per step; the additive
   status value is inert when unused.

## Open Questions

None. Each decision is settled by repository evidence; the reward-path
interaction in D6 is a design obligation, not an open question.
