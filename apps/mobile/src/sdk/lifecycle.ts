/**
 * Session lifecycle state machine (GAME_SDK.md: session
 * start/pause/resume/complete/abandon lifecycle; pause freezes timers).
 *
 * Legal transitions (state table):
 *
 *   created → active → paused ⇄ active → completed | abandoned
 *
 * `completed` and `abandoned` are terminal. Methods are strict about their
 * source state — `start()` only from `created`, `pause()` only from `active`,
 * `resume()` only from `paused`, `complete()`/`abandon()` from `active` or
 * `paused` — and any other use throws `IllegalTransitionError`. Pausing
 * freezes the active timer; `elapsedMs()` reports only active time (paused
 * time is tracked separately), so a player pausing mid-session can never gain
 * time on a timing-sensitive game.
 */
import type { Clock } from './timing';
import { systemClock } from './timing';

export type SessionStatus = 'created' | 'active' | 'paused' | 'completed' | 'abandoned';

/** Thrown when a session transition is not allowed in the current state. */
export class IllegalTransitionError extends Error {
  constructor(
    readonly from: SessionStatus,
    readonly to: SessionStatus,
    readonly method?: string,
  ) {
    const via = method !== undefined ? ` via ${method}()` : '';
    super(`Illegal session transition: ${from} → ${to}${via}`);
    this.name = 'IllegalTransitionError';
  }
}

export interface SessionLifecycleOptions {
  /** Injectable clock; defaults to the real monotonic clock. */
  clock?: Clock;
  /** Called on every successful transition with (newStatus, previousStatus). */
  onStatusChange?: (status: SessionStatus, previous: SessionStatus) => void;
}

/**
 * Reference `SessionLifecycle` service. Games drive it from their own UI;
 * the app auto-pauses on backgrounding (constitution §11).
 */
export class SessionLifecycle {
  private status_: SessionStatus = 'created';
  private activeAccumMs = 0;
  private pausedAccumMs = 0;
  /** Start time of the current active/paused segment, or null when no segment is open. */
  private segmentStartMs: number | null = null;
  private segmentKind: 'active' | 'paused' | null = null;
  private readonly clock: Clock;
  private readonly onStatusChange?: (status: SessionStatus, previous: SessionStatus) => void;

  constructor(options: SessionLifecycleOptions = {}) {
    this.clock = options.clock ?? systemClock;
    this.onStatusChange = options.onStatusChange;
  }

  get status(): SessionStatus {
    return this.status_;
  }

  /** Begin the session: created → active. */
  start(): void {
    this.transition('start', 'active', 'active', ['created']);
  }

  /** Pause the session: active → paused. Freezes the active timer. */
  pause(): void {
    this.transition('pause', 'paused', 'paused', ['active']);
  }

  /** Resume the session: paused → active. */
  resume(): void {
    this.transition('resume', 'active', 'active', ['paused']);
  }

  /** Complete the session: active|paused → completed. Terminal. */
  complete(): void {
    this.transition('complete', 'completed', null, ['active', 'paused']);
  }

  /** Abandon the session: active|paused → abandoned. Terminal. */
  abandon(): void {
    this.transition('abandon', 'abandoned', null, ['active', 'paused']);
  }

  /**
   * Accumulated active (non-paused) time in ms. Frozen while paused and in
   * terminal states. This is the authoritative "time spent playing".
   */
  elapsedMs(): number {
    return (
      this.activeAccumMs +
      (this.segmentKind === 'active' && this.segmentStartMs !== null
        ? this.clock.now() - this.segmentStartMs
        : 0)
    );
  }

  /** Accumulated paused time in ms (informational / diagnostics). */
  pausedDurationMs(): number {
    return (
      this.pausedAccumMs +
      (this.segmentKind === 'paused' && this.segmentStartMs !== null
        ? this.clock.now() - this.segmentStartMs
        : 0)
    );
  }

  private transition(
    method: string,
    to: SessionStatus,
    openSegment: 'active' | 'paused' | null,
    fromAllowed: readonly SessionStatus[],
  ): void {
    const from = this.status_;
    if (!fromAllowed.includes(from)) {
      throw new IllegalTransitionError(from, to, method);
    }

    // Close any open segment, banking its elapsed time.
    if (this.segmentKind !== null && this.segmentStartMs !== null) {
      const segmentMs = this.clock.now() - this.segmentStartMs;
      if (this.segmentKind === 'active') {
        this.activeAccumMs += segmentMs;
      } else {
        this.pausedAccumMs += segmentMs;
      }
      this.segmentStartMs = null;
      this.segmentKind = null;
    }

    // Open the next segment for non-terminal states.
    if (openSegment !== null) {
      this.segmentStartMs = this.clock.now();
      this.segmentKind = openSegment;
    }

    this.status_ = to;
    this.onStatusChange?.(to, from);
  }
}
