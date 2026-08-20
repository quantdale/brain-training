/**
 * `useWorkoutResultAdvance` — cross-feature wiring that closes the 006R
 * hardening gap: the durable daily workout was implemented and unit-tested but
 * no screen ever advanced it, so `current_index` stayed at 0 on-device.
 *
 * Given the session shown on the result screen, this hook loads today's
 * workout instance and, when the session finished the current (resume) game,
 * advances the instance exactly once via `WorkoutRepository.advance`. It returns
 * the next game id to surface a "Next Game" CTA, or a `completed` flag for the
 * "Workout complete" state. The `shouldAdvanceWorkout` guard makes the trigger
 * idempotent across re-views/relaunch; `advancingRef` guards React StrictMode's
 * double-invoked effect (advance is +1, not idempotent at the data layer).
 */
import { useEffect, useRef, useState } from 'react';
import type { GameSessionRecord, WorkoutInstance } from '@/db';
import { getDb } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { shouldAdvanceWorkout } from './advance';
import { localDateString } from './today';

export interface WorkoutResultAdvance {
  /** Today's persisted workout instance (null until loaded). */
  instance: WorkoutInstance | null;
  /** Game id to play next after this session advanced the workout, or null. */
  nextGameId: string | null;
  /** True when the workout is finished (already, or just completed by this session). */
  completed: boolean;
}

export function useWorkoutResultAdvance(session: GameSessionRecord | null): WorkoutResultAdvance {
  const today = localDateString();
  const { data: instance } = useDbData(
    (db) => db.workouts.getByDate(today),
    [today],
    null as WorkoutInstance | null,
  );

  const advancingRef = useRef(false);
  const [next, setNext] = useState<{ id: string | null; completed: boolean } | null>(null);

  useEffect(() => {
    if (advancingRef.current || !session || !instance) {
      return;
    }
    if (!shouldAdvanceWorkout(session, instance)) {
      return;
    }
    advancingRef.current = true;
    getDb()
      .workouts.advance(today)
      .then((updated) => {
        setNext({
          id: updated.gameIds[updated.currentIndex] ?? null,
          completed: updated.status === 'completed',
        });
      })
      .catch((e: unknown) => {
        console.error('[results] workout advance failed', e);
      })
      .finally(() => {
        advancingRef.current = false;
      });
  }, [session, instance, today]);

  return {
    instance,
    nextGameId: next?.id ?? null,
    completed: instance?.status === 'completed' || next?.completed === true,
  };
}
