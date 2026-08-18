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
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SQLiteAdapter } from '@/db/adapter';
import { getDb, WorkoutRepository, type WorkoutInstance } from '@/db';
import { paidReroll } from '@/db/economy';
import { personalizedWorkout, type DomainRating } from '@/workout/personalize';
import { getAllGameDefinitions } from '@/registry/registry';
import { localDateString } from '@/workout/today';
import {
  canAffordReroll,
  MAX_REROLLS_PER_DAY,
  nextWorkoutAfterReroll,
  rerollCost,
} from '@/workout/reroll';

/** Word Match is frozen out of workout selection until semantic correction. */
function eligibleGames() {
  return getAllGameDefinitions().filter((g) => g.id !== 'language-word-match');
}

export interface UseWorkoutResult {
  instance: WorkoutInstance | null;
  /** Game id at the current (resume) position, or null when not loaded. */
  currentGameId: string | null;
  progress: { current: number; total: number };
  status: 'loading' | 'active' | 'completed';
  /** Coin cost of the next reroll (0 = first/free). */
  rerollCostNow: number;
  canReroll: boolean;
  rerollExhausted: boolean;
  /** Apply a reroll (persisted + currency-debited when paid). */
  reroll: () => Promise<void>;
  /** Advance to the next game after a durably persisted session. */
  advance: () => Promise<void>;
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
  argsRef.current = args;

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
      const seed = personalizedWorkout(eligibleGames(), date, domainRatings, recentGameIds, 0);
      const created = await db.workouts.getOrCreate(date, {
        gameIds: seed.map((g) => g.id),
        seedVersion: 1,
      });
      if (!cancelled) setInstance(created);
    })().catch((error) => {
      console.error('[workout] load failed', error);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const rerollAttempt = instance?.rerollAttempt ?? 0;
  const rerollCostNow = rerollCost(rerollAttempt);
  const rerollExhausted = rerollAttempt >= MAX_REROLLS_PER_DAY;
  const canReroll = !rerollExhausted && canAffordReroll(args.balance, rerollAttempt);

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
      // Atomic: debit + workout transition in one transaction.
      await paidReroll(db, {
        cost,
        reason: 'workout-reroll',
        mutateWorkout: async (txn: SQLiteAdapter) => {
          await new WorkoutRepository(txn).applyReroll(date, ids, nextAttempt);
        },
      });
    } else {
      await db.workouts.applyReroll(date, ids, nextAttempt);
    }
    const updated = await db.workouts.getByDate(date);
    if (updated) setInstance(updated);
  }, [date]);

  const advance = useCallback(async () => {
    const db = getDb();
    const updated = await db.workouts.advance(date);
    setInstance(updated);
  }, [date]);

  return {
    instance,
    currentGameId: instance ? instance.gameIds[instance.currentIndex] ?? null : null,
    progress: {
      current: instance?.currentIndex ?? 0,
      total: instance?.gameIds.length ?? 0,
    },
    status: instance ? instance.status : 'loading',
    rerollCostNow,
    canReroll,
    rerollExhausted,
    reroll,
    advance,
  };
}
