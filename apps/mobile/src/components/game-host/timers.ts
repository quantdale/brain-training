/**
 * Pause-aware timer helpers for GameHost-based games (campaign 010, debt D1).
 *
 * Every game screen duplicated the same effect shape: run an interval/timeout
 * only while the relevant phase is live, and cancel it while paused so pause
 * freezes timing. These helpers centralize that invariant:
 *
 * - the timer exists only while `active` is true (games pass
 *   `phase === '…' && !state.paused`);
 * - the callback is kept in a ref, so changing handler identity does not
 *   restart the timer mid-interval;
 * - cleanup clears the timer on deactivation/unmount.
 *
 * Gameplay time must always come from the session lifecycle / monotonic clock
 * carried through dispatched actions — these helpers only pace the ticks.
 */
import { useEffect, useRef } from 'react';

import type { Clock } from '@/sdk';

/** Run `onTick` every `ms` while `active`; cancel otherwise. */
export function useGameInterval(active: boolean, onTick: () => void, ms: number): void {
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  });
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(() => onTickRef.current(), ms);
    return () => clearInterval(timer);
  }, [active, ms]);
}

/** Fire `onFire` once after `ms` while `active`; cancel otherwise. */
export function useGameTimeout(active: boolean, onFire: () => void, ms: number): void {
  const onFireRef = useRef(onFire);
  useEffect(() => {
    onFireRef.current = onFire;
  });
  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setTimeout(() => onFireRef.current(), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
}

/**
 * Fire once after a pause-safe deadline.
 *
 * Unlike `useGameTimeout`, this helper preserves the remaining budget when
 * `active` is temporarily disabled for a pause. `resetKey` identifies a new
 * gameplay window; changing it starts a fresh duration even when the phase
 * happens to reuse the same timeout value. The injected monotonic clock keeps
 * fake-clock tests and production timing on the same contract.
 */
export function useGameDeadlineTimeout(
  active: boolean,
  onFire: () => void,
  durationMs: number,
  clock: Clock,
  resetKey: string | number,
): void {
  const onFireRef = useRef(onFire);
  const deadlineRef = useRef<{
    key: string | number;
    remainingMs: number;
    activeSinceMs: number | null;
  } | null>(null);

  useEffect(() => {
    onFireRef.current = onFire;
  });

  useEffect(() => {
    const duration = Math.max(0, durationMs);
    const previous = deadlineRef.current;
    const deadline =
      previous === null || previous.key !== resetKey
        ? { key: resetKey, remainingMs: duration, activeSinceMs: null }
        : previous;
    deadlineRef.current = deadline;

    if (!active) {
      if (deadline.activeSinceMs !== null) {
        deadline.remainingMs = Math.max(
          0,
          deadline.remainingMs - Math.max(0, clock.now() - deadline.activeSinceMs),
        );
        deadline.activeSinceMs = null;
      }
      return;
    }

    deadline.activeSinceMs = clock.now();
    const timer = setTimeout(() => {
      // Mark the window terminal before invoking user code. A synchronous
      // state transition can otherwise trigger cleanup that subtracts the
      // same window a second time.
      deadline.activeSinceMs = null;
      deadline.remainingMs = 0;
      onFireRef.current();
    }, deadline.remainingMs);

    return () => {
      clearTimeout(timer);
      if (deadline.activeSinceMs !== null) {
        deadline.remainingMs = Math.max(
          0,
          deadline.remainingMs - Math.max(0, clock.now() - deadline.activeSinceMs),
        );
        deadline.activeSinceMs = null;
      }
    };
  }, [active, clock, durationMs, resetKey]);
}
