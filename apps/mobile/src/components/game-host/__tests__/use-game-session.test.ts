/**
 * Unit tests for `useGameSession` — the shared session-lifecycle owner
 * (campaign 011 W05 adversarial matrix).
 *
 * Pins the invariants the 18 migrated games now depend on:
 * - exactly-once finalization (`claimFinalize`) per session, re-armed by `begin()`;
 * - guarded pause: refuses without an active session or when `canPause()`
 *   refuses, and always uses the LATEST closures (refs, not stale captures);
 * - AppState auto-pause routes through the same guarded path (backgrounding
 *   must not bypass a `canPause` phase guard);
 * - lifecycle terminal-state idempotency (`completeIfActive`/`abandonIfActive`);
 * - guarded resume (`resumeIfPaused`) mirrors `requestPause`: only the legal
 *   paused→active transition succeeds, every other status refuses silently;
 * - elapsed time excludes paused segments.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { createElement } from 'react';
import { AppState } from 'react-native';

import { createFakeClock } from '@/sdk';

import { useGameSession } from '../use-game-session';
import type { GameSessionController, UseGameSessionOptions } from '../use-game-session';
import { WorkoutSessionLaunchProvider } from '@/workout/session-launch-context';
import {
  clearWorkoutSessionLaunch,
  peekWorkoutSessionLaunch,
} from '@/workout/session-provenance';

type ChangeHandler = (state: string) => void;

/** Capture the AppState 'change' handler so tests can simulate backgrounding. */
function captureAppStateListener() {
  const captured: { handler: ChangeHandler | null } = { handler: null };
  const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(
    (_event: any, handler: any) => {
      captured.handler = handler as ChangeHandler;
      return { remove: () => (captured.handler = null) } as any;
    },
  );
  return Object.assign(captured, { spy });
}

describe('useGameSession', () => {
  let appState: ReturnType<typeof captureAppStateListener>;

  beforeEach(() => {
    appState = captureAppStateListener();
  });

  afterEach(() => {
    appState.spy.mockRestore();
    jest.restoreAllMocks();
  });

  async function makeHook(overrides: Partial<UseGameSessionOptions> = {}) {
    const clock = createFakeClock(1_000);
    const onPause = jest.fn<() => void>();
    const canPause = jest.fn<() => boolean>(() => true);
    const rendered = await renderHook(
      (props: Partial<UseGameSessionOptions>) =>
        useGameSession({ gameId: 'host-test-game', clock, canPause, onPause, ...props }),
      { initialProps: overrides },
    );
    return { clock, onPause, canPause, controller: rendered.result.current, ...rendered };
  }

  it('begin() starts an active lifecycle and returns namespaced identity', async () => {
    const { clock, controller } = await makeHook();

    expect(controller.status()).toBeNull();
    expect(controller.elapsedMs()).toBe(0);

    const identity = controller.begin();
    expect(controller.status()).toBe('active');
    expect(identity.sessionId).toMatch(/^host-test-game-/);
    expect(identity.startedAtMs).toBeGreaterThanOrEqual(0);

    clock.advance(500);
    expect(controller.elapsedMs()).toBe(500);
  });

  it('registers exact workout launch ownership under the generated session id', async () => {
    const clock = createFakeClock(1_000);
    const provenance = {
      instanceKey: '2026-08-28',
      legIndex: 1,
      gameId: 'host-test-game',
    } as const;
    const rendered = await renderHook(
      () => useGameSession({ gameId: 'host-test-game', clock }),
      {
        wrapper: ({ children }) =>
          createElement(
            WorkoutSessionLaunchProvider,
            { provenance },
            children,
          ),
      },
    );

    const identity = rendered.result.current.begin();
    expect(peekWorkoutSessionLaunch(identity.sessionId)).toEqual(provenance);
    clearWorkoutSessionLaunch(identity.sessionId);
  });

  it('claimFinalize returns true exactly once per session; begin() re-arms it', async () => {
    const { controller } = await makeHook();

    // The guard is per-session; claiming before begin() also wins once.
    expect(controller.claimFinalize()).toBe(true);
    expect(controller.claimFinalize()).toBe(false);

    controller.begin();
    expect(controller.claimFinalize()).toBe(true);
    // Double-submission within the same session is refused.
    expect(controller.claimFinalize()).toBe(false);

    // A new session re-arms the guard exactly once.
    controller.begin();
    expect(controller.claimFinalize()).toBe(true);
    expect(controller.claimFinalize()).toBe(false);
  });

  it('requestPause refuses before begin(), after pause, and when canPause refuses', async () => {
    const { onPause, clock, controller } = await makeHook();

    // No session yet.
    expect(controller.requestPause()).toBe(false);
    expect(onPause).not.toHaveBeenCalled();

    controller.begin();
    clock.advance(200);

    // Happy path first: active + canPause → pauses and fires the dispatch hook.
    expect(controller.requestPause()).toBe(true);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(controller.status()).toBe('paused');

    // Already paused → refuse (no double dispatch).
    expect(controller.requestPause()).toBe(false);
    expect(onPause).toHaveBeenCalledTimes(1);

    // Phase guard refuses: no dispatch, lifecycle stays active.
    const refused = await renderHook((props: Partial<UseGameSessionOptions>) =>
      useGameSession({
        gameId: 'host-test-game',
        clock,
        canPause: () => false,
        onPause,
        ...props,
      }),
    );
    refused.result.current.begin();
    expect(refused.result.current.requestPause()).toBe(false);
    expect(refused.result.current.status()).toBe('active');
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('requestPause uses the latest closures across re-renders (no stale capture)', async () => {
    const clock = createFakeClock(0);
    const calls: string[] = [];
    const rendered = await renderHook(
      ({ flag }: { flag: boolean }) =>
        useGameSession({
          gameId: 'host-test-game',
          clock,
          canPause: () => flag,
          onPause: () => calls.push(flag ? 'new' : 'old'),
        }),
      { initialProps: { flag: false } },
    );
    const mountedController: GameSessionController = rendered.result.current;
    mountedController.begin();

    // Re-render with a NEW closure set; the pause decision must see it.
    // (The controller object is rebuilt per render; the invariant is that its
    // stable `requestPause` reads the LATEST options through the ref.)
    await rendered.rerender({ flag: true });
    expect(rendered.result.current.requestPause()).toBe(true);
    expect(calls).toEqual(['new']);
  });

  it('resume unfreezes timing; elapsed excludes paused segments; resume w/o session is safe', async () => {
    const { clock, controller } = await makeHook();

    expect(() => controller.resume()).not.toThrow();

    controller.begin();
    clock.advance(100);
    expect(controller.requestPause()).toBe(true);
    clock.advance(400); // paused wall-time — must NOT count
    controller.resume();
    clock.advance(50);
    expect(controller.elapsedMs()).toBe(150);
    expect(controller.pausedDurationMs()).toBe(400);
  });

  it('resumeIfPaused only resumes from paused; refuses everywhere else without throwing', async () => {
    const { clock, controller } = await makeHook();

    // No session yet: refuse (never throw), timing untouched.
    expect(controller.resumeIfPaused()).toBe(false);

    controller.begin();
    clock.advance(100);

    // Active → refuse: a resume racing completion/double-tap is dropped.
    expect(controller.resumeIfPaused()).toBe(false);
    expect(controller.status()).toBe('active');
    clock.advance(50);
    expect(controller.elapsedMs()).toBe(150);

    // Paused → the one legal path: resumes and unfreezes exactly like resume().
    expect(controller.requestPause()).toBe(true);
    clock.advance(400); // paused wall-time — must NOT count
    expect(controller.resumeIfPaused()).toBe(true);
    expect(controller.status()).toBe('active');
    clock.advance(50);
    expect(controller.elapsedMs()).toBe(200);
    expect(controller.pausedDurationMs()).toBe(400);

    // Already resumed: an immediate second invocation loses the race cleanly.
    expect(controller.resumeIfPaused()).toBe(false);

    // Terminal states refuse too (no resurrect, no throw).
    controller.completeIfActive();
    expect(controller.resumeIfPaused()).toBe(false);
    expect(controller.status()).toBe('completed');
    controller.begin();
    controller.abandonIfActive();
    expect(controller.resumeIfPaused()).toBe(false);
    expect(controller.status()).toBe('abandoned');
  });

  it('completeIfActive/abandonIfActive are idempotent and never leave a dangling session', async () => {
    const { controller } = await makeHook();

    // Safe with no session.
    expect(() => {
      controller.completeIfActive();
      controller.abandonIfActive();
    }).not.toThrow();

    controller.begin();
    controller.completeIfActive();
    expect(controller.status()).toBe('completed');
    // Terminal: neither call may resurrect/re-transition (would throw).
    expect(() => {
      controller.completeIfActive();
      controller.abandonIfActive();
    }).not.toThrow();
    expect(controller.status()).toBe('completed');

    // Abandon wins only from non-terminal states.
    controller.begin();
    controller.abandonIfActive();
    expect(controller.status()).toBe('abandoned');
    expect(() => controller.completeIfActive()).not.toThrow();
    expect(controller.status()).toBe('abandoned');
  });

  it('auto-pauses on AppState background through the guarded path, ignores foreground', async () => {
    const { clock, controller, onPause, canPause } = await makeHook();

    controller.begin();
    clock.advance(100);

    await act(async () => {
      appState.handler?.('background');
    });
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(canPause).toHaveBeenCalled();
    expect(controller.status()).toBe('paused');

    // Returning to foreground must NOT auto-resume (explicit user action only).
    await act(async () => {
      appState.handler?.('active');
    });
    expect(controller.status()).toBe('paused');
  });

  it('backgrounding respects the canPause phase guard (no forced pause)', async () => {
    const rendered = await renderHook((props: Partial<UseGameSessionOptions>) =>
      useGameSession({
        gameId: 'host-test-game',
        clock: createFakeClock(0),
        canPause: () => false,
        ...props,
      }),
    );
    rendered.result.current.begin();
    const statusBefore = rendered.result.current.status();

    await act(async () => {
      appState.handler?.('background');
    });
    expect(rendered.result.current.status()).toBe(statusBefore);
  });

  it('removes its AppState subscription on unmount (no orphan listener)', async () => {
    const { unmount } = await makeHook();
    expect(appState.handler).not.toBeNull();
    await unmount();
    expect(appState.handler).toBeNull();
  });
});
