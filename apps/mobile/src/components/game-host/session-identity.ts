/**
 * Collision-safe session identity for GameHost-based games (campaign 010,
 * architecture-debt D1).
 *
 * Every pre-GameHost game screen carried its own copies of `randomSeed()` and
 * `newSessionId()` (36 identical copies across the catalog). This module is
 * the single implementation:
 *
 * - The seed is INPUT, never generator content: a random per-session seed is
 *   drawn with the same shape the catalog has always used, and injected fixed
 *   seeds (tests / QA force-state) pass through verbatim.
 * - The session id combines a wall-clock bucket, a process-wide monotonic
 *   counter, and a random suffix. Two sessions created inside the same
 *   millisecond — e.g. by fast QA restart loops — can therefore never collide.
 */

/** Random per-session seed — the seed is input, not generator content. */
export function randomSeed(): string {
  return String(Math.floor(Math.random() * 0xffffffff));
}

/**
 * Resolve the canonical seed for a new session: an injected seed (tests /
 * QA) wins; otherwise draw a fresh random one.
 */
export function resolveSessionSeed(seed?: string | number): string {
  return seed !== undefined ? String(seed) : randomSeed();
}

/** Process-wide counter so same-millisecond sessions stay unique. */
let sessionCounter = 0;

/**
 * Collision-safe session id: `<gameId>-<time36>-<counter36>-<random>`.
 * The counter disambiguates ids created in the same millisecond; the random
 * suffix additionally separates ids across app restarts (counter reset).
 */
export function createSessionId(gameId: string): string {
  sessionCounter += 1;
  return `${gameId}-${Date.now().toString(36)}-${sessionCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
