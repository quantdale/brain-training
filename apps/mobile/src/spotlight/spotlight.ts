/**
 * Daily Spotlight (Campaign 014 W3): one deterministic featured challenge per
 * local calendar day — a game plus a featured difficulty — giving players a
 * shared point of return that is distinct from the four-game workout.
 *
 * Design constraints (constitution §5/§10/§14):
 * - Fully offline and deterministic: the same date always yields the same
 *   spotlight, derived purely from `createRng("spotlight::v1::<date>")` over
 *   the lexicographically sorted catalog ids. No server, no clock reads —
 *   callers pass the local date string (`workout/today.localDateString`).
 * - Completion detection is deliberately loose for v1: any completed session
 *   of the spotlighted game within the local day counts (`sessions
 *   .countSessions` window query). A strict fixed-seed replay contract would
 *   require routing a forced seed through every game's start path; that seam
 *   can arrive later without changing this module's public shape.
 * - Versioned via {@link SPOTLIGHT_VERSION} so historical attribution stays
 *   honest if the selection scheme ever changes.
 */
import { createRng } from "@/sdk";

/** Version of the selection scheme. */
export const SPOTLIGHT_VERSION = 1;

/** Featured-difficulty rotation (deterministic per day, all levels occur). */
const DIFFICULTY_ROTATION = ["normal", "hard", "expert", "easy"] as const;

export type SpotlightDifficulty = (typeof DIFFICULTY_ROTATION)[number];

export interface DailySpotlight {
  readonly gameId: string;
  readonly difficulty: SpotlightDifficulty;
  /** Local calendar day key this spotlight belongs to (YYYY-MM-DD). */
  readonly date: string;
}

/**
 * Deterministic spotlight for `date`. Empty id lists yield null (no catalog).
 * Sorting before drawing keeps the selection stable regardless of registry
 * ordering, so app updates that append games never reshuffle old days.
 */
export function dailySpotlight(
  gameIds: readonly string[],
  date: string,
): DailySpotlight | null {
  if (gameIds.length === 0) {
    return null;
  }
  const rng = createRng(`spotlight::v${SPOTLIGHT_VERSION}::${date}`);
  const sorted = [...gameIds].sort();
  const gameId = sorted[rng.nextInt(sorted.length)];
  // Day-index rotation over the sorted ids guarantees every difficulty level
  // recurs on a fixed cadence while staying date-deterministic.
  const dayNumber = Math.floor(
    Date.parse(`${date}T00:00:00`) / 86_400_000,
  );
  const difficulty = DIFFICULTY_ROTATION[
    ((dayNumber % DIFFICULTY_ROTATION.length) + DIFFICULTY_ROTATION.length) %
      DIFFICULTY_ROTATION.length
  ];
  return { gameId, difficulty, date };
}

/** Inclusive local-day epoch window for completion checks. */
export function localDayWindow(date: string): { fromMs: number; toMs: number } {
  const start = Date.parse(`${date}T00:00:00`);
  return { fromMs: start, toMs: start + 86_400_000 - 1 };
}
