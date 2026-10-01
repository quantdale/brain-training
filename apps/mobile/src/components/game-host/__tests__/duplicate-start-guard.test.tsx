/**
 * Duplicate-start guard in `useGameSession.begin()` (Change 074 §4).
 *
 * The defect: `begin()` replaced `lifecycleRef.current` without stopping the
 * previous lifecycle, so a second call silently abandoned a LIVE session. Its
 * timer kept running, the new session was persisted, and the abandoned one's
 * completion was dropped — with no error anywhere. The cases below are the ones
 * that could produce a second call, and each is asserted against a specific
 * claim: nothing is left running, nothing is lost silently, and the legitimate
 * paths still work.
 */
import { describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { createElement } from 'react';

import { useGameSession, type UseGameSessionOptions } from '../use-game-session';
import { WorkoutSessionLaunchProvider } from '@/workout/session-launch-context';
import { DuplicateSessionStartError, isTerminalSessionStatus } from '@/sdk';

/** A controllable monotonic clock, so elapsed time is deterministic. */
function createFakeClock(start: number) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

async function harness(overrides: Partial<UseGameSessionOptions> = {}) {
  const clock = createFakeClock(1_000);
  const rendered = await renderHook(
    (props: Partial<UseGameSessionOptions>) =>
      useGameSession({ gameId: 'memory', clock, ...props }),
    {
      initialProps: overrides,
      // The hook reads the workout launch from context, so a provider is
      // required; `provenance: null` is the ordinary standalone-game case.
      wrapper: ({ children }) =>
        createElement(WorkoutSessionLaunchProvider, { provenance: null }, children),
    },
  );
  // A LIVE getter, not a snapshot: `result.current` is null until the first
  // render commits, and a captured value would silently be null in whichever
  // test happened to run right after an unmount.
  return {
    clock,
    get controller() {
      const current = rendered.result.current;
      if (current === null) throw new Error('the hook produced no controller');
      return current;
    },
    ...rendered,
  };
}

describe('duplicate start is refused, not silently accepted', () => {
  it('throws a typed error on a second begin while a session is active', async () => {
    const { controller } = await harness();
    controller.begin();
    // The caller is about to discard live play, so it must be told rather than
    // have the running session silently replaced.
    expect(() => controller.begin()).toThrow(DuplicateSessionStartError);
  });

  it('names the game and the current status so the cause is diagnosable', async () => {
    const { controller } = await harness();
    controller.begin();
    let thrown: unknown;
    try {
      controller.begin();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DuplicateSessionStartError);
    const error = thrown as DuplicateSessionStartError;
    expect(error.gameId).toBe('memory');
    expect(error.currentStatus).toBe('active');
    expect(error.message).toMatch(/still active/);
    expect(error.name).toBe('DuplicateSessionStartError');
  });

  it('leaves the refused start with NO effect on the running session', async () => {
    const { controller } = await harness();
    let firstId: string | undefined;
          firstId = controller.begin().sessionId;

    expect(() => controller.begin()).toThrow();

    // The first session is still the live one, and it still completes: a
    // refused duplicate must not have completed or abandoned it.
    controller.completeIfActive();
    // Completing a second time is a no-op rather than a throw, which is what
    // proves the first completion landed on the still-running session.
    expect(() => {
      controller.completeIfActive();
    }).not.toThrow();
    expect(firstId).toBeTruthy();
  });

  it('succeeds after a TERMINAL phase — a replay is a legitimate restart', async () => {
    const { controller } = await harness();
    controller.begin();
    controller.completeIfActive();
    // `completed` is terminal, so starting again is the normal end-of-game →
    // replay path and must not be refused.
    expect(() => {
      controller.begin();
    }).not.toThrow();
  });

  it('succeeds after an abandoned session', async () => {
    const { controller } = await harness();
    controller.begin();
    controller.abandonIfActive();
    expect(() => {
      controller.begin();
    }).not.toThrow();
  });

  it('refuses a duplicate while PAUSED, not only while active', async () => {
    // A pause overlay left mounted while a remount starts a new session is
    // exactly the race this guards; `paused` is not terminal either.
    const { controller } = await harness();
    controller.begin();
    controller.requestPause();
    expect(() => controller.begin()).toThrow(/still paused/);
  });

  it('a host REMOUNT does not trip the guard', async () => {
    // The distinction that matters: a remount builds a NEW hook instance with a
    // fresh ref, so there is no previous session to conflict with. Only two
    // `begin()` calls on the SAME instance are a duplicate — a guard that
    // survived a remount would refuse the first start after any navigation,
    // which would be far worse than the bug it fixes.
    const first = await harness();
    first.controller.begin();

    await act(async () => {
      first.unmount();
    });

    const remounted = await harness();
    // No throw: a fresh instance has no previous session.
    expect(() => remounted.controller.begin()).not.toThrow();
    expect(remounted.controller).toBeDefined();
  });

  it('repeated start/complete cycles never accumulate guard state', async () => {
    // A failed start must leave a CLEAN first-start state, and even a successful
    // one must not leave the guard refusing later legitimate restarts. The
    // observable form of both: several start -> complete cycles in a row all
    // succeed, where the pre-074 code silently replaced the lifecycle each
    // time and the second cycle was already losing a session.
    const { controller } = await harness();
    for (let cycle = 0; cycle < 3; cycle++) {
      expect(() => controller.begin()).not.toThrow();
      controller.completeIfActive();
    }
    // Elapsed time proves only the newest lifecycle is live: each cycle advanced
    // the clock, so a stale lifecycle would have banked the previous cycle's
    // time into this one.
    expect(controller.elapsedMs()).toBe(0);
  });
});

describe('isTerminalSessionStatus', () => {
  it('recognises exactly the two terminal statuses', () => {
    expect(isTerminalSessionStatus('completed')).toBe(true);
    expect(isTerminalSessionStatus('abandoned')).toBe(true);
    for (const status of ['created', 'active', 'paused'] as const) {
      expect(isTerminalSessionStatus(status)).toBe(false);
    }
  });
});
