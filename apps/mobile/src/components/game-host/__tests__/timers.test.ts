/**
 * Unit tests for the pause-aware timer helpers (campaign 011 W05).
 *
 * Pins the invariants every migrated game's pacing depends on:
 * - timers exist ONLY while `active` and are cleared on deactivation/unmount
 *   (fake-timer leak checks — no orphan timers after results);
 * - handler identity changes do NOT restart a running timer (callback kept in
 *   a ref) — re-renders mid-round must not extend or truncate the window;
 * - changing `ms` or `active` reschedules exactly once.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';

import { createFakeClock } from '@/sdk';

import { useGameDeadlineTimeout, useGameInterval, useGameTimeout } from '../timers';

describe('useGameInterval', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ticks only while active and stops when deactivated', async () => {
    const onTick = jest.fn<() => void>();
    const rendered = await renderHook(
      ({ active }: { active: boolean }) => useGameInterval(active, onTick, 250),
      { initialProps: { active: false } },
    );

    jest.advanceTimersByTime(1_000);
    expect(onTick).not.toHaveBeenCalled();

    await rendered.rerender({ active: true });
    jest.advanceTimersByTime(1_000);
    expect(onTick).toHaveBeenCalledTimes(4);

    await rendered.rerender({ active: false });
    const callsAtDeactivation = onTick.mock.calls.length;
    jest.advanceTimersByTime(1_000);
    expect(onTick).toHaveBeenCalledTimes(callsAtDeactivation);
  });

  it('keeps the cadence across handler-identity changes (no restart, latest callback wins)', async () => {
    const first = jest.fn<() => void>();
    const second = jest.fn<() => void>();
    const rendered = await renderHook(
      ({ handler }: { handler: () => void }) => useGameInterval(true, handler, 250),
      { initialProps: { handler: first as () => void } },
    );

    jest.advanceTimersByTime(500);
    expect(first).toHaveBeenCalledTimes(2);

    // New closure identity mid-interval: cadence must not reset.
    await rendered.rerender({ handler: second });
    jest.advanceTimersByTime(250);
    // Exactly one further tick since the last one — an interval restart would
    // have delayed this tick to t=1000.
    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('restarts when ms changes and leaves no timer behind on unmount', async () => {
    const onTick = jest.fn<() => void>();
    const rendered = await renderHook(({ ms }: { ms: number }) => useGameInterval(true, onTick, ms), {
      initialProps: { ms: 250 },
    });
    jest.advanceTimersByTime(250);
    expect(onTick).toHaveBeenCalledTimes(1);

    await rendered.rerender({ ms: 100 });
    jest.advanceTimersByTime(100);
    expect(onTick).toHaveBeenCalledTimes(2);

    // Leak check: after unmount no further ticks can ever fire (jest's timer
    // count is polluted by the React scheduler here, so assert behavior).
    const callsAtUnmount = onTick.mock.calls.length;
    await rendered.unmount();
    jest.advanceTimersByTime(10_000);
    expect(onTick).toHaveBeenCalledTimes(callsAtUnmount);
  });

  it('never schedules anything while inactive (leak check)', async () => {
    const onTick = jest.fn<() => void>();
    await renderHook(() => useGameInterval(false, onTick, 250));
    jest.advanceTimersByTime(10_000);
    expect(onTick).not.toHaveBeenCalled();
  });
});

describe('useGameTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires once after ms while active; pause cancellation prevents the fire', async () => {
    const onFire = jest.fn<() => void>();
    await renderHook(
      ({ active }: { active: boolean }) => useGameTimeout(active, onFire, 1_000),
      { initialProps: { active: true } },
    );

    jest.advanceTimersByTime(999);
    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(5_000);
    expect(onFire).toHaveBeenCalledTimes(1); // once-only

    // Pause before expiry cancels the pending fire (pause freezes the round).
    const second = jest.fn<() => void>();
    const paused = await renderHook(
      ({ active }: { active: boolean }) => useGameTimeout(active, second, 500),
      { initialProps: { active: true } },
    );
    await paused.rerender({ active: false });
    jest.advanceTimersByTime(10_000);
    expect(second).not.toHaveBeenCalled();
  });

  it('reschedules from the NEW remaining time when ms changes (resume path)', async () => {
    const onFire = jest.fn<() => void>();
    const rendered = await renderHook(({ ms }: { ms: number }) => useGameTimeout(true, onFire, ms), {
      initialProps: { ms: 5_000 },
    });

    // Resume semantics: games pass `deadlineMs - now` as ms. Shortening the
    // window must move the fire earlier, not append to the old schedule.
    await rendered.rerender({ ms: 300 });
    jest.advanceTimersByTime(299);
    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('uses the latest callback without rescheduling (ref stability)', async () => {
    const first = jest.fn<() => void>();
    const second = jest.fn<() => void>();
    const rendered = await renderHook(
      ({ handler }: { handler: () => void }) => useGameTimeout(true, handler, 500),
      { initialProps: { handler: first as () => void } },
    );
    await rendered.rerender({ handler: second });
    jest.advanceTimersByTime(500);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('a 0 ms timeout still fires on the next macrotask (0-remaining expiry edge)', async () => {
    const onFire = jest.fn<() => void>();
    // Games compute remaining = max(0, deadline - now); if the deadline has
    // already passed at schedule time the helper must still deliver the fire
    // (not synchronously during render, but on the next timer turn).
    await renderHook(() => useGameTimeout(true, onFire, Math.max(0, 1_000 - 1_000)));
    expect(onFire).not.toHaveBeenCalled();
    jest.advanceTimersByTime(0);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('leaves no timer behind on deactivation or unmount (orphan-timer leak check)', async () => {
    const onFire = jest.fn<() => void>();
    const rendered = await renderHook(
      ({ active }: { active: boolean }) => useGameTimeout(active, onFire, 2_000),
      { initialProps: { active: true } },
    );
    await rendered.rerender({ active: false });
    jest.advanceTimersByTime(60_000);
    expect(onFire).not.toHaveBeenCalled();

    await rendered.rerender({ active: true });
    const callsAtUnmount = onFire.mock.calls.length;
    await rendered.unmount();
    jest.advanceTimersByTime(60_000);
    expect(onFire).toHaveBeenCalledTimes(callsAtUnmount);
  });

  it('preserves the active remainder while paused and resets only for a new key', async () => {
    const clock = createFakeClock(0);
    const onFire = jest.fn<() => void>();
    const rendered = await renderHook(
      ({ active, keyName }: { active: boolean; keyName: string }) =>
        useGameDeadlineTimeout(active, onFire, 1_000, clock, keyName),
      { initialProps: { active: true, keyName: 'round-1' } },
    );

    clock.advance(400);
    jest.advanceTimersByTime(400);
    await rendered.rerender({ active: false, keyName: 'round-1' });
    clock.advance(5_000);
    jest.advanceTimersByTime(5_000);
    expect(onFire).not.toHaveBeenCalled();

    await rendered.rerender({ active: true, keyName: 'round-1' });
    clock.advance(599);
    jest.advanceTimersByTime(599);
    expect(onFire).not.toHaveBeenCalled();
    clock.advance(1);
    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);

    await rendered.rerender({ active: false, keyName: 'round-1' });
    await rendered.rerender({ active: true, keyName: 'round-2' });
    jest.advanceTimersByTime(999);
    expect(onFire).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(2);
  });
});
