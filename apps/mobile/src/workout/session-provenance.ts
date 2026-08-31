/**
 * Durable ownership metadata for sessions launched from a workout.
 *
 * The route owns the immutable `(instance key, leg index, game id)` tuple.
 * It is copied into the session's raw-result JSON at the persistence boundary
 * so the ownership survives results navigation, process relaunch and backup
 * round-trips. The in-memory launch map bridges the route and the existing
 * shared game persister without requiring every one of the 42 game modules to
 * grow a new prop.
 */

export interface WorkoutSessionProvenance {
  /** Persisted workout-instance primary key (daily date or template key). */
  readonly instanceKey: string;
  /** 0-based leg selected when this game was launched. */
  readonly legIndex: number;
  /** Game id at the selected leg. */
  readonly gameId: string;
}

const RAW_RESULT_PROVENANCE_KEY = "workoutProvenance";
const MAX_PENDING_LAUNCHES = 128;

const pendingLaunches = new Map<string, WorkoutSessionProvenance>();

/** Runtime validation for data crossing a route or persistence boundary. */
export function isWorkoutSessionProvenance(
  value: unknown,
): value is WorkoutSessionProvenance {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.instanceKey === "string" &&
    candidate.instanceKey.trim().length > 0 &&
    typeof candidate.gameId === "string" &&
    candidate.gameId.trim().length > 0 &&
    typeof candidate.legIndex === "number" &&
    Number.isSafeInteger(candidate.legIndex) &&
    candidate.legIndex >= 0
  );
}

/** Return a defensive immutable-shaped copy of a validated provenance tuple. */
export function cloneWorkoutSessionProvenance(
  provenance: WorkoutSessionProvenance,
): WorkoutSessionProvenance {
  return {
    instanceKey: provenance.instanceKey,
    legIndex: provenance.legIndex,
    gameId: provenance.gameId,
  };
}

/** Associate a newly-created session id with the route that launched it. */
export function registerWorkoutSessionLaunch(
  sessionId: string,
  provenance: WorkoutSessionProvenance,
): void {
  if (!sessionId || !isWorkoutSessionProvenance(provenance)) {
    return;
  }
  pendingLaunches.set(sessionId, cloneWorkoutSessionProvenance(provenance));
  while (pendingLaunches.size > MAX_PENDING_LAUNCHES) {
    const oldest = pendingLaunches.keys().next().value;
    if (typeof oldest !== "string") {
      break;
    }
    pendingLaunches.delete(oldest);
  }
}

/** Read launch ownership without consuming it; failed persistence must retry. */
export function peekWorkoutSessionLaunch(
  sessionId: string,
): WorkoutSessionProvenance | undefined {
  const provenance = pendingLaunches.get(sessionId);
  return provenance ? cloneWorkoutSessionProvenance(provenance) : undefined;
}

/** Clear ownership after the durable session transaction succeeds. */
export function clearWorkoutSessionLaunch(sessionId: string): void {
  pendingLaunches.delete(sessionId);
}

/**
 * Add ownership to an opaque game result. Game result objects remain shaped as
 * before, with one reserved additive key. Non-object payloads use a small
 * envelope because JSON primitives cannot carry metadata.
 */
export function attachWorkoutProvenance(
  rawResult: unknown,
  provenance: WorkoutSessionProvenance,
): unknown {
  const owned = cloneWorkoutSessionProvenance(provenance);
  if (typeof rawResult === "object" && rawResult !== null && !Array.isArray(rawResult)) {
    return { ...(rawResult as Record<string, unknown>), [RAW_RESULT_PROVENANCE_KEY]: owned };
  }
  return { value: rawResult, [RAW_RESULT_PROVENANCE_KEY]: owned };
}

/** Extract ownership from the reserved raw-result field, if present/valid. */
export function extractWorkoutProvenance(
  rawResult: unknown,
): WorkoutSessionProvenance | undefined {
  if (typeof rawResult !== "object" || rawResult === null || Array.isArray(rawResult)) {
    return undefined;
  }
  const value = (rawResult as Record<string, unknown>)[RAW_RESULT_PROVENANCE_KEY];
  return isWorkoutSessionProvenance(value)
    ? cloneWorkoutSessionProvenance(value)
    : undefined;
}

/**
 * Parse route values defensively. Malformed or partial query strings are
 * intentionally treated as standalone launches and therefore can never claim
 * a workout leg.
 */
export function parseWorkoutLaunchProvenance(input: {
  gameId: unknown;
  instanceKey: unknown;
  legIndex?: unknown;
}): WorkoutSessionProvenance | null {
  const gameId = firstQueryValue(input.gameId);
  const instanceKey = firstQueryValue(input.instanceKey);
  const rawIndex = firstQueryValue(input.legIndex);
  if (typeof gameId !== "string" || typeof instanceKey !== "string") {
    return null;
  }
  const legIndex =
    typeof rawIndex === "number"
      ? rawIndex
      : typeof rawIndex === "string" && rawIndex.trim() !== ""
        ? Number(rawIndex)
        : NaN;
  const provenance = { gameId, instanceKey, legIndex };
  return isWorkoutSessionProvenance(provenance) ? provenance : null;
}

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}
