/**
 * Lightweight performance instrumentation (campaign 010; campaign 009 debt
 * item D4, `docs/audits/campaign009-architecture-debt.md`).
 *
 * Dependency-free mark/measure helpers feeding a fixed-capacity ring buffer
 * of recent records plus a dev-only readout seam for QA tooling. Every entry
 * point is a no-op in production release builds (`isDevBuild()`), mirroring
 * the QA-hook gating contract in `types/qa.ts` — constitution §29 keeps
 * diagnostic machinery out of production paths.
 *
 * Records are emitted as single-line JSON behind a stable `[perf]` prefix,
 * matching the repo's structured-log convention (`[game-id] message`), so QA
 * artifacts capture them alongside existing logs. The record shape is
 * versioned (`PERF_SCHEMA_VERSION`) and carries wall-clock `atMs`, so marks
 * correlate with persisted `DiagnosticMetadata.startedAtMs`.
 *
 * Instrumentation ONLY: nothing here samples frames, benchmarks, or alters
 * measured code paths beyond reading a monotonic clock. Durations come from
 * the shared injectable clock (`timing.ts`) so tests stay deterministic —
 * swap it via `setPerfClockForTests` and reset module state (buffer, pending
 * windows, clock) via `resetPerfForTests`.
 *
 * Current instrumented flows (call sites):
 * - `game-session-start` / `game-first-interaction-latency`: GameHost-based
 *   sessions (`components/game-host`) — latency from session begin to the
 *   first touch on the session body.
 * - `session-persist-duration`: `<GameResults>` brackets the completion DB
 *   write as observed through its `persistState` prop transitions.
 * - `progress-snapshot-load`: the Progress projection query
 *   (`analytics/projections.ts`).
 */
import { systemClock } from './timing';
import type { Clock } from './timing';
import { isDevBuild } from './types/qa';

/** Record-shape version — bump on breaking changes to the record contract. */
export const PERF_SCHEMA_VERSION = 1;

/** Ring-buffer capacity: enough recent sessions for a QA run to inspect. */
export const PERF_RING_CAPACITY = 128;

/** Stable event names; QA tooling keys off these literals. */
export type PerfEventName =
  | 'game-session-start'
  | 'game-first-interaction-latency'
  | 'session-persist-duration'
  | 'progress-snapshot-load';

/** Extra record payload; values restricted so emission stays one-line JSON. */
export type PerfDetailValue = string | number | boolean;
export type PerfDetail = Readonly<Record<string, PerfDetailValue>>;

/**
 * One recorded mark or measure. `durationMs` exists on measures only and is
 * measured against the monotonic perf clock (never wall time).
 */
export interface PerfRecord {
  readonly schemaVersion: number;
  readonly kind: 'mark' | 'measure';
  readonly name: PerfEventName;
  /** Wall-clock epoch ms — correlates with persisted session metadata. */
  readonly atMs: number;
  /** Monotonic duration in ms (measures only). */
  readonly durationMs?: number;
  readonly gameId?: string;
  readonly detail?: PerfDetail;
}

/** Open measurement handle; `end` records exactly once, later calls no-op. */
export interface PerfMeasure {
  end(detail?: PerfDetail): void;
}

export interface PerfEventContext {
  readonly gameId?: string;
  readonly detail?: PerfDetail;
}

// ---- Module state (dev-only in practice: every reader/writer gates on
// isDevBuild(), so production builds never allocate the buffer).

const recentRecords: PerfRecord[] = [];
const pendingFirstInteraction = new Map<string, number>();
let perfClock: Clock = systemClock;

/**
 * Replace the monotonic clock used for durations (tests / deterministic QA).
 * Callers should `resetPerfForTests()` afterwards to restore the default.
 */
export function setPerfClockForTests(clock: Clock): void {
  perfClock = clock;
}

/** Clear the ring buffer + pending windows and restore the default clock. */
export function resetPerfForTests(): void {
  recentRecords.length = 0;
  pendingFirstInteraction.clear();
  perfClock = systemClock;
}

function pushRecord(record: PerfRecord): void {
  recentRecords.push(record);
  if (recentRecords.length > PERF_RING_CAPACITY) {
    recentRecords.shift();
  }
}

function emitPerfRecord(record: PerfRecord): void {
  // Single-line JSON keeps QA-artifact logs greppable (`[perf] {…}`).
  console.log(`[perf] ${JSON.stringify(record)}`);
}

function recordEvent(
  kind: PerfRecord['kind'],
  name: PerfEventName,
  context: PerfEventContext | undefined,
  durationMs?: number,
): void {
  if (!isDevBuild()) {
    return;
  }
  const record: PerfRecord = {
    schemaVersion: PERF_SCHEMA_VERSION,
    kind,
    name,
    atMs: Date.now(),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(context?.gameId !== undefined ? { gameId: context.gameId } : {}),
    ...(context?.detail !== undefined ? { detail: context.detail } : {}),
  };
  pushRecord(record);
  emitPerfRecord(record);
}

// ---- Generic primitives.

/** Record an instant mark (no duration). No-op outside dev builds. */
export function markPerfEvent(name: PerfEventName, context?: PerfEventContext): void {
  recordEvent('mark', name, context);
}

/**
 * Start a duration measure; call `end(detail?)` when the span closes. The
 * returned handle is safe to abandon: an un-ended measure simply never
 * reaches the buffer. In production builds the handle is a no-op.
 */
export function startPerfMeasure(name: PerfEventName, context?: PerfEventContext): PerfMeasure {
  if (!isDevBuild()) {
    return noopMeasure;
  }
  const startMs = perfClock.now();
  let ended = false;
  return {
    end(detail?: PerfDetail): void {
      if (ended) {
        return;
      }
      ended = true;
      // Math.max guards against non-monotonic test clocks going backwards.
      recordEvent(
        'measure',
        name,
        { ...context, ...(detail !== undefined ? { detail } : {}) },
        Math.max(0, perfClock.now() - startMs),
      );
    },
  };
}

const noopMeasure: PerfMeasure = { end: () => {} };

// ---- Domain helpers (the three D4 flows).

/**
 * Mark a game session start and open its game-start→first-interaction
 * latency window. A later `markGameFirstInteraction(gameId)` closes it; a
 * new start for the same game overwrites any unconsumed window.
 */
export function markGameSessionStart(gameId: string): void {
  if (!isDevBuild()) {
    return;
  }
  pendingFirstInteraction.set(gameId, perfClock.now());
  recordEvent('mark', 'game-session-start', { gameId });
}

/**
 * Close the game-start→first-interaction window opened by
 * `markGameSessionStart`. Silent no-op when no window is pending (already
 * consumed, or a touch before the session began).
 */
export function markGameFirstInteraction(gameId: string): void {
  if (!isDevBuild()) {
    return;
  }
  const startMs = pendingFirstInteraction.get(gameId);
  if (startMs === undefined) {
    return;
  }
  pendingFirstInteraction.delete(gameId);
  recordEvent(
    'measure',
    'game-first-interaction-latency',
    { gameId },
    Math.max(0, perfClock.now() - startMs),
  );
}

/**
 * Measure a session-completion persistence span (the completion DB write as
 * observed by the caller). End with `{ outcome: … }` describing how the
 * write resolved (e.g. `'succeeded'` / `'failed'` / `'superseded'`).
 */
export function trackSessionPersist(gameId: string): PerfMeasure {
  return startPerfMeasure('session-persist-duration', { gameId });
}

/**
 * Measure a progress-snapshot load (projection query path). End with
 * `{ outcome: 'rows' | 'fallback' | 'error', rowCount? }`.
 */
export function trackProgressSnapshotLoad(): PerfMeasure {
  return startPerfMeasure('progress-snapshot-load');
}

// ---- Dev-only readout seam for QA tooling.

/**
 * Snapshot of the most recent records, oldest → newest. Empty outside dev
 * builds, so QA tooling may call it unconditionally.
 */
export function getRecentPerfRecords(): readonly PerfRecord[] {
  if (!isDevBuild()) {
    return [];
  }
  return [...recentRecords];
}
