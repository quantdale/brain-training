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
import { personalizedWorkout, type DomainRating } from "@/workout/personalize";
import { getAllGameDefinitions } from "@/registry/registry";
import { localDateString } from "@/workout/today";
import {
  canAffordReroll,
  MAX_REROLLS_PER_DAY,
  nextWorkoutAfterReroll,
  rerollCost,
} from "@/workout/reroll";

/** Word Match is frozen out of workout selection until semantic correction. */
function eligibleGames() {
  return getAllGameDefinitions().filter((g) => g.id !== "language-word-match");
}

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
      const existing = await db.workouts.getByDate(date);
      if (existing) {
        if (!cancelled) setInstance(existing);
        return;
      }
      const seed = personalizedWorkout(
        eligibleGames(),
        date,
        domainRatings,
        recentGameIds,
        0,
      );
      const created = await db.workouts.getOrCreate(date, {
        gameIds: seed.map((g) => g.id),
        seedVersion: 1,
      });
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
    if (!current || current.rerollAttempt >= MAX_REROLLS_PER_DAY) {
      return;
    }
    const nextAttempt = current.rerollAttempt + 1;
    const selection = nextWorkoutAfterReroll(
      eligibleGames(),
      date,
      domainRatings,
      recentGameIds,
      current.rerollAttempt,
    );
    const ids = selection.map((g) => g.id);
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
