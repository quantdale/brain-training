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
