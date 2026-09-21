/**
 * Focus-time progression-sync throttle (hardening packet, finding 1).
 *
 * `refreshProgression` re-evaluates the bounded 5000-session quest sample and
 * re-runs ~30 idempotent definition upserts. Sessions take minutes, so a tab
 * bounce inside the window cannot hide real progression — the Progress screen
 * already applies the same reasoning (`shouldScheduleFocusReload`, 061). This
 * gate extends that policy to the three reward surfaces (Home, Profile,
 * Rewards) that sync on focus.
 *
 * Unlike a pure time window, the gate is INPUT-AWARE: the newest persisted
 * session is fingerprinted, and a changed fingerprint always forces a sync.
 * A completion performed in-app is therefore never hidden by the window, even
 * when the player reaches the next surface in under the minimum interval.
 *
 * The state is module-level (one process-wide gate): the surfaces read the
 * same persisted progression, so one sync refreshes all of them, and Rewards
 * (which remounts per visit rather than focusing) is throttled across visits
 * too. `resetProgressionFocusSyncForTests` keeps unit tests isolated.
 */
import type { AppDatabase } from '@/db';
import type { QuestSnapshot } from '@/quests';

/** Minimum age of the last successful sync before a focus schedules another. */
export const FOCUS_PROGRESSION_SYNC_MIN_MS = 5000;

/** Identity of the newest persisted session (the sync's primary input). */
export interface ProgressionInput {
  readonly id: string;
  readonly completedAt: number;
}

interface ProgressionFocusSyncState {
  /** Epoch-ms of the last successful full sync (0 = never). */
  lastSyncMs: number;
  /** Newest-session fingerprint recorded by the last successful sync. */
  fingerprint: string | null;
  /** Quest snapshot returned by the last successful sync, for throttled reads. */
  lastSnapshot: QuestSnapshot | null;
}

function emptyState(): ProgressionFocusSyncState {
  return { lastSyncMs: 0, fingerprint: null, lastSnapshot: null };
}

let state = emptyState();

/**
 * In-flight sync shared by concurrent loads (a focus bounce can start a
 * second load before the first settles). Joining the same attempt keeps the
 * gate's promise: one native evaluation per window, not one per load.
 */
let inFlight: Promise<QuestSnapshot> | null = null;

/**
 * Stable identity of the newest session. An absent newest session maps to `''`
 * (not null) so a fresh gate still syncs exactly once before throttling.
 */
export function progressionInputFingerprint(
  newest: ProgressionInput | null | undefined,
): string {
  return newest ? `${newest.id}@${newest.completedAt}` : '';
}

/**
 * Pure decision (unit-tested): a changed input always syncs — a completion
 * performed in-app is never hidden by the window; otherwise sync only when the
 * window elapsed since the last successful sync.
 */
export function shouldSyncProgression(
  lastSyncMs: number,
  nowMs: number,
  fingerprint: string,
  lastFingerprint: string | null,
): boolean {
  if (lastFingerprint !== fingerprint) {
    return true;
  }
  return nowMs - lastSyncMs > FOCUS_PROGRESSION_SYNC_MIN_MS;
}

/** Decision against the shared gate state. */
export function progressionFocusSyncDue(nowMs: number, fingerprint: string): boolean {
  return shouldSyncProgression(state.lastSyncMs, nowMs, fingerprint, state.fingerprint);
}

/**
 * Record a successful full sync. Call only after `refreshProgression` resolves
 * so a failed sync is retried on the next focus instead of being throttled.
 */
export function markProgressionSynced(
  nowMs: number,
  fingerprint: string,
  snapshot: QuestSnapshot | null,
): void {
  state = { lastSyncMs: nowMs, fingerprint, lastSnapshot: snapshot };
}

/**
 * Run the (mockable) sync exactly once when a window is open: the first caller
 * executes it, concurrent callers join the same attempt, and the gate is only
 * marked after the sync resolves. A rejection leaves the window open so the
 * next focus retries.
 */
export async function runProgressionSync(
  sync: (now: Date) => Promise<QuestSnapshot>,
  now: Date,
  fingerprint: string,
): Promise<QuestSnapshot> {
  if (inFlight !== null) {
    return inFlight;
  }
  const attempt = (async () => {
    const snapshot = await sync(now);
    markProgressionSynced(now.getTime(), fingerprint, snapshot);
    return snapshot;
  })();
  inFlight = attempt;
  try {
    return await attempt;
  } finally {
    if (inFlight === attempt) {
      inFlight = null;
    }
  }
}

/**
 * Quest snapshot from the last successful sync, reused by Profile when its
 * focus is throttled (the persisted rows are unchanged inside the window).
 */
export function lastSyncedQuestSnapshot(): QuestSnapshot | null {
  return state.lastSnapshot;
}

/**
 * Cheap newest-session read for the fingerprint. Partial test doubles and a
 * degraded db legitimately lack `listRecent`; those map to "no input" rather
 * than failing the surface load.
 */
export async function readNewestProgressionInput(
  db: AppDatabase,
  throughMs: number,
): Promise<ProgressionInput | null> {
  try {
    const listRecent = db.sessions?.listRecent;
    if (typeof listRecent !== 'function') {
      return null;
    }
    const rows = await listRecent.call(db.sessions, 1, throughMs);
    const newest = rows[0];
    return newest ? { id: newest.id, completedAt: newest.completedAt } : null;
  } catch {
    return null;
  }
}

/** Test-only: reset the shared gate so suites start from a clean window. */
export function resetProgressionFocusSyncForTests(): void {
  state = emptyState();
  inFlight = null;
}
