/**
 * `useWorkout` — durable daily-workout context (006R task 6.2 / 6.5 / 6.6).
 *
 * Wraps the `WorkoutRepository` (persistent instance) and the pure
 * personalization layer. On mount it loads-or-creates today's instance (seeding
 * the selection when absent) so the workout survives restart/resume. Reroll is
 * transactional: the currency debit and the workout transition commit together
 * via `paidReroll` (the free first reroll omits the debit). `advance` is called
 * by the result screen after a durably persisted session.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { SQLiteAdapter } from "@/db/adapter";
import {
  getDb,
  type AppDatabase,
  WorkoutRepository,
  type WorkoutInstance,
} from "@/db";
import { paidReroll } from "@/db/economy";
import { emitWorkoutChanged, onWorkoutChanged } from "./events";
import {
  createWorkoutMetadata,
  dailySelectionSeed,
} from "./metadata";
import { explainDailyWorkout } from "./reasons";
import { personalizedWorkout, type DomainRating } from "@/workout/personalize";
import { eligibleGameIds, eligibleGames } from "@/workout/reconcile";
import { localDateString } from "@/workout/today";
import {
  canAffordReroll,
  MAX_REROLLS_PER_DAY,
  nextWorkoutAfterReroll,
  rerollCost,
} from "@/workout/reroll";

export interface UseWorkoutResult {
  instance: WorkoutInstance | null;
  /** Game id at the current (resume) position, or null when not loaded. */
  currentGameId: string | null;
  progress: { current: number; total: number };
  status: "loading" | "active" | "completed";
  /** Coin cost of the next reroll (0 = first/free). */
  rerollCostNow: number;
  canReroll: boolean;
  rerollExhausted: boolean;
  /** Apply a reroll (persisted + currency-debited when paid). */
  reroll: () => Promise<void>;
  /** Advance to the next game after a durably persisted session. */
  advance: () => Promise<void>;
  /** Re-read the persisted instance (call when the screen regains focus). */
  refresh: () => void;
}

export function useWorkout(args: {
  domainRatings: DomainRating[];
  recentGameIds: string[];
  balance: number;
}): UseWorkoutResult {
  const [instance, setInstance] = useState<WorkoutInstance | null>(null);
  const date = localDateString();

  // Latest args without retriggering the load effect on every render (the caller
  // may pass fresh array literals each render, which would otherwise loop).
  const argsRef = useRef(args);
  useEffect(() => {
    argsRef.current = args;
  }, [args]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = getDb();
      const { domainRatings, recentGameIds } = argsRef.current;
      // Reconcile against the current eligible catalog so a stored instance
      // that references retired/renamed game ids (catalog drift between
      // sessions, other workers' catalog expansion) is repaired in place
      // instead of crashing or launching a dead game (Queue A).
      const reconciled = await db.workouts.reconcile(date, eligibleGameIds());
      if (reconciled) {
        if (!cancelled) setInstance(reconciled);
        return;
      }
      // Inject the wall clock ONCE at creation time and share it between the
      // selection and its recorded reasons, so stale domains
      // (constitution §15) surface after weak ones and both computations
      // agree on staleness classification. The pure layer never reads the
      // clock itself; the value is captured here so the selection stays
      // stable for the rest of the day.
      const nowMs = Date.now();
      const seed = personalizedWorkout(
        eligibleGames(),
        date,
        domainRatings,
        recentGameIds,
        0,
        [],
        { nowMs },
      );
      // Explainability companion (constitution §14): record WHY each game was
      // chosen at creation time. Same inputs + same clock as the selection
      // above, so the recorded reasons describe exactly this instance's
      // ordered list; they ride inside metadata (dropped silently on legacy
      // schemas) and are surfaced back through history summaries.
      const reasons = explainDailyWorkout(
        eligibleGames(),
        date,
        domainRatings,
        recentGameIds,
        0,
        [],
        // Same creation clock as the selection call above.
        { nowMs },
      );
      const created = await db.workouts.getOrCreate(
        date,
        {
          gameIds: seed.map((g) => g.id),
          seedVersion: 1,
        },
        // V2 metadata (versioned; see metadata.ts). Persisted when the schema
        // carries the optional metadata_json column, dropped silently on
        // legacy schemas — the daily selection itself is unchanged.
        createWorkoutMetadata({
          kind: "daily",
          templateId: "daily-mix",
          length: "standard",
          focus: null,
          inputs: {
            domainRatings: Object.fromEntries(
              domainRatings.map((entry) => [entry.domain, entry.rating]),
            ),
            recentGameIds: [...recentGameIds],
            seed: dailySelectionSeed(date, 0),
          },
          reasons,
        }),
      );
      if (!cancelled) setInstance(created);
    })().catch((error) => {
      console.error("[workout] load failed", error);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  // Re-read the instance on demand (e.g. when the owning screen regains focus)
  // so an advance made on another screen (the result screen) is reflected
  // without a remount. The caller wires this to focus; kept router-free here so
  // the hook stays usable outside navigation (006R hardening).
  const refresh = useCallback(() => {
    let db: AppDatabase;
    try {
      db = getDb();
    } catch {
      return;
    }
    db.workouts
      .getByDate(date)
      .then((inst) => {
        if (inst) {
          setInstance(inst);
        }
      })
      .catch(() => {
        /* db unavailable: keep the last known instance */
      });
  }, [date]);

  const rerollAttempt = instance?.rerollAttempt ?? 0;
  const rerollCostNow = rerollCost(rerollAttempt);
  const rerollExhausted = rerollAttempt >= MAX_REROLLS_PER_DAY;
  const canReroll =
    !rerollExhausted && canAffordReroll(args.balance, rerollAttempt);

  const reroll = useCallback(async () => {
    const db = getDb();
    const { domainRatings, recentGameIds } = argsRef.current;
    const current = await db.workouts.getByDate(date);
    // Refuse when the day is exhausted (cap) or the workout is already
    // completed: rerolling a completed instance would replace nothing (the
    // whole list is the completed prefix) yet still debit coins — defense in
    // depth beyond the Home screen's disabled button.
    if (
      !current ||
      current.status !== "active" ||
      current.rerollAttempt >= MAX_REROLLS_PER_DAY
    ) {
      return;
    }
    const nextAttempt = current.rerollAttempt + 1;
    // Exclude the already-completed prefix so a reroll after partial
    // completion never reintroduces a game the player has already finished
    // (Queue A: reroll replacing already-played games).
    const completedPrefix = current.gameIds.slice(0, current.currentIndex);
    const selection = nextWorkoutAfterReroll(
      eligibleGames(),
      date,
      domainRatings,
      recentGameIds,
      current.rerollAttempt,
      completedPrefix,
      { nowMs: Date.now() },
    );
    // `applyReroll` is POSITION-based: it keeps game_ids [0, currentIndex)
    // verbatim and replaces [currentIndex, len) with
    // `newGameIds.slice(currentIndex)` (006R task 6.6). The reroll selector
    // returns FRESH games only (the played prefix went in as `exclude`), so
    // feed it the positional form — the played prefix as placeholders plus the
    // fresh selection truncated to the remaining slots. Passing the bare
    // fresh list would slice off its first `currentIndex` games on every
    // post-completion reroll (campaign 011 W07 regression).
    const playedSet = new Set(completedPrefix);
    const remainingSlots = Math.max(
      0,
      current.gameIds.length - current.currentIndex,
    );
    const freshIds = selection
      .map((game) => game.id)
      .filter((id) => !playedSet.has(id))
      .slice(0, remainingSlots);
    const ids = [...current.gameIds.slice(0, current.currentIndex), ...freshIds];
    const cost = rerollCost(current.rerollAttempt);

    if (cost > 0) {
      // Atomic: debit + workout transition in one transaction, deduplicated by
      // a stable per-(date,attempt) operationId so a "committed-but-unconfirmed"
      // retry at the same attempt cannot re-debit (F1, task 7.5). After a
      // successful reroll nextAttempt advances, so a later attempt gets a
      // different id — this is intentional; a post-advance lost-confirmation
      // is a known small edge (advance already durable).
      await paidReroll(db, {
        cost,
        reason: "workout-reroll",
        operationId: `workout-reroll:${date}:${nextAttempt}`,
        mutateWorkout: async (txn: SQLiteAdapter) => {
          await new WorkoutRepository(txn).applyReroll(date, ids, nextAttempt);
        },
      });
    } else {
      await db.workouts.applyReroll(date, ids, nextAttempt);
    }
    const updated = await db.workouts.getByDate(date);
    if (updated) setInstance(updated);
    emitWorkoutChanged();
  }, [date]);

  // Re-read the instance when another screen changes it (e.g. the result screen
  // advances the workout after a completed session). Router-free + synchronous so
  // it is safe under unit tests; keeps Home's completed/current markers accurate.
  useEffect(() => onWorkoutChanged(refresh), [refresh]);

  const advance = useCallback(async () => {
    const db = getDb();
    const updated = await db.workouts.advance(date);
    setInstance(updated);
    emitWorkoutChanged();
  }, [date]);

  return {
    instance,
    currentGameId: instance
      ? (instance.gameIds[instance.currentIndex] ?? null)
      : null,
    progress: {
      current: instance?.currentIndex ?? 0,
      total: instance?.gameIds.length ?? 0,
    },
    status: instance ? instance.status : "loading",
    rerollCostNow,
    canReroll,
    rerollExhausted,
    reroll,
    advance,
    refresh,
  };
}
