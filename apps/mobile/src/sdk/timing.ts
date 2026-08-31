/**
 * Monotonic timing service (GAME_SDK.md: "monotonic/high-resolution timing
 * service"; constitution §20: timing-sensitive games use suitable
 * monotonic clocks and must behave fairly across 60/120 Hz displays).
 *
 * A `Clock` is an injectable abstraction: real code uses `systemClock`
 * (performance.now when available), tests use `createFakeClock` to make time
 * deterministic.
 */

/** Millisecond-resolution clock. Implementations must be monotonic. */
export interface Clock {
  now(): number;
}

/** Wrap any finite clock source so wall-clock rollback cannot move time back. */
export function createMonotonicClock(readNow: () => number): Clock {
  let lastNow = Number.NEGATIVE_INFINITY;
  return {
    now: () => {
      const candidate = readNow();
      if (!Number.isFinite(candidate)) {
        return lastNow === Number.NEGATIVE_INFINITY ? 0 : lastNow;
      }
      lastNow = Math.max(lastNow, candidate);
      return lastNow;
    },
  };
}

/**
 * Real monotonic clock. Prefers `performance.now()` (monotonic, high
 * resolution, available on Hermes/RN, Node ≥ 16, and browsers) and falls back
 * to a rollback-safe `Date.now()` source where unavailable.
 */
const readSystemNow = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    const perfNow = performance.now();
    if (Number.isFinite(perfNow)) return perfNow;
  }
  return Date.now();
};

export const systemClock: Clock = createMonotonicClock(readSystemNow);

/** Fake clock for tests: manual `advance`/`set` control over time. */
export interface FakeClock extends Clock {
  /** Advance the clock by `ms` (may be negative in tests) and return the new value. */
  advance(ms: number): number;
  /** Set the clock to an absolute value. */
  set(ms: number): void;
}

/** Create a fake clock starting at `initialNow` ms (default 0). */
export function createFakeClock(initialNow = 0): FakeClock {
  let nowMs = initialNow;
  return {
    now: () => nowMs,
    advance: (ms: number) => {
      nowMs += ms;
      return nowMs;
    },
    set: (ms: number) => {
      nowMs = ms;
    },
  };
}

/** Stopwatch measuring elapsed time against a clock; 0 before `start()`. */
export class Stopwatch {
  private startMs: number | null = null;

  constructor(private readonly clock: Clock = systemClock) {}

  /** Begin (or restart) timing. */
  start(): void {
    this.startMs = this.clock.now();
  }

  /** Elapsed milliseconds since `start()`; 0 if never started. */
  elapsedMs(): number {
    return this.startMs === null ? 0 : this.clock.now() - this.startMs;
  }

  /** Stop timing; `elapsedMs()` returns 0 until the next `start()`. */
  reset(): void {
    this.startMs = null;
  }

  get isRunning(): boolean {
    return this.startMs !== null;
  }
}
