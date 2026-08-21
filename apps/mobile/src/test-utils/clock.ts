/**
 * Deterministic time control for game-screen tests.
 *
 * Game screens take an injected SDK `Clock` seam while their internal
 * timeouts run on jest fake timers. Advancing a phase therefore requires
 * moving BOTH clocks in lockstep inside `act()` — the pattern previously
 * copy-pasted into every game screen test (see e.g.
 * `src/games/memory-grid-recall/__tests__/screen.test.tsx`). New tests should
 * import this helper instead of re-declaring it.
 *
 * Requires `jest.useFakeTimers()` to be active; advancing real timers is a
 * no-op hazard we deliberately do not paper over (the jest call throws when
 * fake timers are off, which surfaces the misuse immediately).
 */
import { act } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import type { FakeClock } from '@/sdk';

/**
 * Advance the injected clock and jest's fake timers by `ms`, in lockstep,
 * inside `act()` so state updates flush before assertions.
 */
export async function advanceTime(
  clock: FakeClock,
  ms: number,
): Promise<void> {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}
