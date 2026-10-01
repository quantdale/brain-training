/**
 * `useGameSession` — shared session-lifecycle owner for GameHost-based games
 * (campaign 010, architecture-debt D1).
 *
 * Owns the plumbing every game screen previously duplicated (~36 copies):
 *
 * - construction + starting of the SDK `SessionLifecycle` on session begin
 *   (injectable monotonic clock, so pause freezes timing exactly — the
 *   lifecycle excludes paused segments from `elapsedMs()`);
 * - collision-safe session id creation (`session-identity.ts`);
 * - AppState auto-pause: backgrounding the app pauses the session through
 *   the same guarded path as the manual pause button (constitution §11);
 * - the once-per-session finalization guard (the old per-screen
 *   `finalizedRef`), so the results effect can never double-submit.
 *
 * The game keeps everything mechanic-specific: its reducer state, the pause
 * phase guard (`canPause`), and the dispatch of its own `pause` action
 * (`onPause`). Pause/resume/quit handlers collapse to one-liners on the
 * returned controller.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { DuplicateSessionStartError, SessionLifecycle, isTerminalSessionStatus, systemClock } from '@/sdk';
import type { Clock, SessionStatus } from '@/sdk';

import { markGameSessionStart } from '@/sdk/perf';
import { createSessionId } from './session-identity';
import { useWorkoutSessionLaunch } from '@/workout/session-launch-context';
import { registerWorkoutSessionLaunch } from '@/workout/session-provenance';

/** Identity of a freshly begun session, dispatched into the game reducer. */
export interface SessionStartIdentity {
  /** Collision-safe session id (see `createSessionId`). */
  readonly sessionId: string;
  /** Wall-clock start time (diagnostics only; gameplay uses the clock). */
  readonly startedAtMs: number;
}

export interface UseGameSessionOptions {
  /** Stable game id; namespaces the generated session ids. */
  readonly gameId: string;
  /** Injectable monotonic clock; defaults to the system clock. */
  readonly clock?: Clock;
  /**
   * May the session pause right now? Read lazily at pause time via a ref, so
   * it always sees the latest reducer state without re-subscribing the
   * AppState listener. Games encode their in-session phases here.
   */
  readonly canPause?: () => boolean;
  /**
   * Called after a successful pause transition — dispatch the game's
   * `pause` action here. Never called when `canPause()` refuses.
   */
  readonly onPause?: () => void;
}

export interface GameSessionController {
  /**
   * Begin a new session: (re)creates the lifecycle with the injected clock,
   * starts it, resets the finalization guard, and returns the identity to
   * dispatch into the game's `start-session` action.
   */
  begin(): SessionStartIdentity;
  /**
   * Guarded pause: refuses (returning false) when no session is running,
   * the lifecycle is not `active`, or `canPause()` returns false; otherwise
   * pauses the lifecycle (freezing timers) and fires `onPause`.
   */
  requestPause(): boolean;
  /**
   * Resume the paused lifecycle (timers unfreeze). STRICT: throws
   * IllegalTransitionError unless the status is exactly 'paused' (mirrors the
   * SDK state machine). Prefer `resumeIfPaused()` from UI handlers where a
   * stale/double invocation must be dropped instead of crashing.
   */
  resume(): void;
  /**
   * Guarded resume — the mirror of `requestPause()`: resumes only when the
   * lifecycle is exactly `paused` (timers unfreeze) and returns true;
   * refuses (returning false, never throwing) without a session or from any
   * other status ('created'/'active'/terminal). Screens no longer need to
   * read `status()` themselves to guard against a double-tapped Resume or a
   * resume racing completion.
   */
  resumeIfPaused(): boolean;
  /** Complete the lifecycle unless already terminal (idempotent). */
  completeIfActive(): void;
  /** Abandon the lifecycle unless already terminal (quit path). */
  abandonIfActive(): void;
  /** Active-only elapsed ms (paused time excluded); 0 without a session. */
  elapsedMs(): number;
  /** Accumulated paused ms (diagnostics); 0 without a session. */
  pausedDurationMs(): number;
  /** Current lifecycle status; null before the first `begin()`. */
  status(): SessionStatus | null;
  /**
   * Claim the right to finalize the current session. Returns true exactly
   * once per session (double-submission guard); `begin()` re-arms it.
   */
  claimFinalize(): boolean;
  /**
   * Return whether an async completion still belongs to the current session.
   * `begin()` changes this identity synchronously, before React renders the
   * restarted screen, so late persistence callbacks cannot update the new
   * session through a stale closure.
   */
  isCurrentSession(sessionId: string | null | undefined): boolean;
}

export function useGameSession(options: UseGameSessionOptions): GameSessionController {
  const { gameId, clock = systemClock } = options;
  const workoutLaunch = useWorkoutSessionLaunch();

  const lifecycleRef = useRef<SessionLifecycle | null>(null);
  // Once-per-session finalization guard (same role as the old per-screen
  // `finalizedRef`; kept under the same name deliberately).
  const finalizedRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null);

  // Latest options via refs: the AppState subscription below is mounted once,
  // while canPause/onPause closures may change every render.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const requestPause = useCallback((): boolean => {
    const lifecycle = lifecycleRef.current;
    if (lifecycle === null || lifecycle.status !== 'active') {
      return false;
    }
    const { canPause, onPause } = optionsRef.current;
    if (canPause !== undefined && !canPause()) {
      return false;
    }
    lifecycle.pause();
    onPause?.();
    return true;
  }, []);

  // ---- Auto-pause when the app leaves the foreground (constitution §11).
  // Backgrounding routes through the same guarded path as the pause button.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        requestPause();
      }
    });
    return () => subscription.remove();
  }, [requestPause]);

  return {
    // 074: guarded against a DUPLICATE start, and made exception-safe.
    //
    // `begin()` used to REPLACE `lifecycleRef.current` without stopping the
    // previous lifecycle. A second call — a double-tap on a start control, a
    // remount racing the first mount, a QA hook firing twice — therefore
    // silently abandoned a live session: its timer kept running, the new
    // session was persisted, and the abandoned one's completion was dropped with
    // no error anywhere.
    //
    // Two distinct cases, handled differently on purpose:
    //   - a NON-TERMINAL previous session means the caller is about to discard
    //     live state, so this THROWS and leaves everything untouched. Silently
    //     replacing it is the bug; auto-abandoning it would hide a real caller
    //     error and lose a session the user may still be playing.
    //   - a TERMINAL previous session (completed/abandoned) is a legitimate
    //     restart — the normal end of a game followed by a replay. Its timer is
    //     already frozen by the terminal transition, so there is nothing to
    //     release and nothing to warn about.
    begin: useCallback((): SessionStartIdentity => {
      const previous = lifecycleRef.current;
      if (previous !== null && !isTerminalSessionStatus(previous.status)) {
        throw new DuplicateSessionStartError(gameId, previous.status);
      }

      const lifecycle = new SessionLifecycle({ clock });
      lifecycle.start();
      // Publish the new lifecycle BEFORE any work that can throw, so a failure
      // below can find and release it rather than orphaning a running timer.
      lifecycleRef.current = lifecycle;
      try {
        finalizedRef.current = false;
        // Perf mark (dev-only no-op in release): opens the game-start→first-
        // interaction latency window that <GameHost>'s session-body touch
        // observer closes (campaign 010, debt D4).
        markGameSessionStart(gameId);
        const sessionId = createSessionId(gameId);
        currentSessionIdRef.current = sessionId;
        // Query parameters are untrusted input. The route parser already
        // validates their shape; the game-id check here prevents a tampered
        // launch tuple from claiming a different game's completion.
        if (workoutLaunch?.gameId === gameId) {
          registerWorkoutSessionLaunch(sessionId, workoutLaunch);
        }
        return { sessionId, startedAtMs: Date.now() };
      } catch (error) {
        // A start that fails after the lifecycle is running must not leave a
        // live timer nobody owns. `abandon()` is the terminal transition, which
        // freezes the timer; the ref is cleared so the next `begin()` is a
        // clean first start rather than a duplicate-start refusal against
        // debris this call created.
        lifecycle.abandon();
        lifecycleRef.current = null;
        currentSessionIdRef.current = null;
        throw error;
      }
    }, [clock, gameId, workoutLaunch]),

    requestPause,

    resume: useCallback(() => {
      lifecycleRef.current?.resume();
    }, []),

    // Guarded like requestPause(): the PauseOverlay stays mounted until React
    // re-renders, so a fast double-tap on Resume (or a resume racing session
    // completion) can reach this twice; the SDK throws on the illegal
    // transition, so drop the no-op instead of crashing (the two pre-host
    // guards this replaces: attention-sustained-vigilance, math-value-ordering).
    resumeIfPaused: useCallback((): boolean => {
      const lifecycle = lifecycleRef.current;
      if (lifecycle === null || lifecycle.status !== 'paused') {
        return false;
      }
      lifecycle.resume();
      return true;
    }, []),

    completeIfActive: useCallback(() => {
      const lifecycle = lifecycleRef.current;
      if (
        lifecycle !== null &&
        lifecycle.status !== 'completed' &&
        lifecycle.status !== 'abandoned'
      ) {
        lifecycle.complete();
      }
    }, []),

    abandonIfActive: useCallback(() => {
      const lifecycle = lifecycleRef.current;
      if (
        lifecycle !== null &&
        lifecycle.status !== 'completed' &&
        lifecycle.status !== 'abandoned'
      ) {
        lifecycle.abandon();
      }
    }, []),

    elapsedMs: useCallback(() => lifecycleRef.current?.elapsedMs() ?? 0, []),
    pausedDurationMs: useCallback(() => lifecycleRef.current?.pausedDurationMs() ?? 0, []),
    status: useCallback(() => lifecycleRef.current?.status ?? null, []),
    claimFinalize: useCallback(() => {
      if (finalizedRef.current) {
        return false;
      }
      finalizedRef.current = true;
      return true;
    }, []),
    isCurrentSession: useCallback(
      (sessionId: string | null | undefined) =>
        sessionId !== null &&
        sessionId !== undefined &&
        currentSessionIdRef.current === sessionId,
      [],
    ),
  };
}
