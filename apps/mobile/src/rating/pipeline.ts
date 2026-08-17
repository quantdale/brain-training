/**
 * Rating pipeline — the real XP/rating/currency engine (constitution §15:
 * raw result → normalized performance → expected-difficulty comparison →
 * domain update → overall composite; §17: XP/level + currency).
 *
 * Games keep their own raw scoring and normalization; this pipeline converts
 * the persisted `NormalizedPerformance` (0..1) into:
 *
 * - XP:   engagement reward. Poor attempts still earn XP; better play earns
 *         more, scaled by difficulty multiplier.
 * - Rating deltas per cognitive domain: `k * (normalized - expected)`
 *         against a difficulty-level expected-performance baseline, capped
 *         per session so ratings move gradually. The primary domain moves at
 *         full weight; secondary domains at half weight.
 * - Currency: 1 coin per XP_CURRENCY_RATE XP (append-only ledger entry).
 *
 * Ratings never decay on inactivity — consumers mark stale via
 * `isRatingStale` (db layer). All functions are pure and deterministic; the
 * db layer applies the outcome atomically with the session row.
 */
import type { GameSessionRecord, RatingDelta, RatingOutcome, RatingService } from '@/db';

/** XP multiplier per difficulty level (Adaptive sits between Normal and Hard). */
export const DIFFICULTY_XP_MULTIPLIER: Readonly<Record<string, number>> = {
  easy: 0.8,
  normal: 1,
  hard: 1.2,
  expert: 1.4,
  adaptive: 1.1,
};

/**
 * Expected normalized performance per difficulty level. Playing far above the
 * baseline gains rating; far below loses it. Easy has a high baseline so
 * easy play cannot inflate ratings (constitution §9).
 */
export const DIFFICULTY_EXPECTED_PERFORMANCE: Readonly<Record<string, number>> = {
  easy: 0.8,
  normal: 0.6,
  hard: 0.45,
  expert: 0.3,
  adaptive: 0.5,
};

/**
 * Map a continuous challenge rating (0..1) to expected normalized performance.
 * Derived from the fixed-level baseline points (easy 0.2→0.8, normal 0.5→0.6,
 * hard 0.8→0.45, expert 0.95→0.3) via linear interpolation. Adaptive sessions
 * use their final challenge rating directly.
 *
 * Constitution §9: easy has a high baseline so easy play cannot inflate ratings.
 */
export function expectedPerformanceFromChallenge(challengeRating: number): number {
  // Clamp to [0, 1]
  const cr = Math.min(1, Math.max(0, challengeRating));
  // Piecewise linear interpolation between the four anchor points.
  const anchors = [
    { cr: 0.2, ep: 0.8 },
    { cr: 0.5, ep: 0.6 },
    { cr: 0.8, ep: 0.45 },
    { cr: 0.95, ep: 0.3 },
  ];
  // If cr is below the first anchor, extrapolate from first two points.
  if (cr <= anchors[0].cr) {
    const slope = (anchors[1].ep - anchors[0].ep) / (anchors[1].cr - anchors[0].cr);
    return anchors[0].ep + slope * (cr - anchors[0].cr);
  }
  // If cr is above the last anchor, extrapolate from last two points.
  if (cr >= anchors[anchors.length - 1].cr) {
    const slope =
      (anchors[anchors.length - 1].ep - anchors[anchors.length - 2].ep) /
      (anchors[anchors.length - 1].cr - anchors[anchors.length - 2].cr);
    return (
      anchors[anchors.length - 1].ep +
      slope * (cr - anchors[anchors.length - 1].cr)
    );
  }
  // Find the segment containing cr.
  for (let i = 0; i < anchors.length - 1; i++) {
    if (cr >= anchors[i].cr && cr <= anchors[i + 1].cr) {
      const slope = (anchors[i + 1].ep - anchors[i].ep) / (anchors[i + 1].cr - anchors[i].cr);
      return anchors[i].ep + slope * (cr - anchors[i].cr);
    }
  }
  // Fallback (should not reach).
  return 0.6;
}

/** Rating sensitivity factor (points of movement per unit of performance edge). */
export const RATING_K = 24;

/** Hard per-session cap on one domain's movement (gradual, no swings). */
export const MAX_RATING_DELTA_PER_SESSION = 15;

/** Secondary (non-primary) domains move at half weight. */
export const SECONDARY_DOMAIN_WEIGHT = 0.5;

/** Currency rate: 1 coin per this many XP (floor). */
export const XP_CURRENCY_RATE = 5;

/** Clamp to [0, 1] — the canonical normalized scale. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** XP awarded for a session: participation floor + performance bonus, difficulty-scaled. */
export function computeXp(normalized: number, difficultyLevel: string): number {
  const multiplier = DIFFICULTY_XP_MULTIPLIER[difficultyLevel] ?? 1;
  return Math.round((10 + 40 * clamp01(normalized)) * multiplier);
}

/**
 * Rating delta for one domain: `k * (normalized - expected) * weight`,
 * rounded and capped at ±MAX_RATING_DELTA_PER_SESSION.
 */
export function computeRatingDelta(
  normalized: number,
  difficultyLevel: string,
  weight = 1,
  challengeRating?: number,
): number {
  let expected: number;
  if (typeof challengeRating === 'number' && Number.isFinite(challengeRating)) {
    expected = expectedPerformanceFromChallenge(challengeRating);
  } else {
    expected = DIFFICULTY_EXPECTED_PERFORMANCE[difficultyLevel] ?? 0.6; // default to normal
  }
  const raw = RATING_K * (clamp01(normalized) - expected) * weight;
  const rounded = Math.round(raw);
  return Math.max(-MAX_RATING_DELTA_PER_SESSION, Math.min(MAX_RATING_DELTA_PER_SESSION, rounded));
}

/** Currency coins for a session's XP (floor at the configured rate). */
export function computeCurrency(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_CURRENCY_RATE);
}

/** Difficulty level recorded on the persisted session, defaulting to Normal. */
function difficultyLevelOf(session: GameSessionRecord): string {
  const difficulty = session.difficulty as { level?: string } | null | undefined;
  return difficulty?.level ?? 'normal';
}

function challengeRatingOf(session: GameSessionRecord): number | undefined {
  const difficulty = session.difficulty as { challengeRating?: number } | null | undefined;
  if (typeof difficulty?.challengeRating === 'number' && Number.isFinite(difficulty.challengeRating)) {
    return difficulty.challengeRating;
  }
  return undefined;
}

/**
 * Full outcome for one completed session. `getDomains` maps the game id to
 * its domain list (primary first, then secondary) so the pipeline stays free
 * of registry/UI dependencies and is trivially testable.
 */
export function computeRatingOutcome(
  session: GameSessionRecord,
  getDomains: (gameId: string) => readonly string[],
): RatingOutcome {
  const level = difficultyLevelOf(session);
  const challengeRating = challengeRatingOf(session);
  const normalized = clamp01(session.normalizedResult);

  const xp = computeXp(normalized, level);
  const deltas: readonly RatingDelta[] = getDomains(session.gameId).map((domain, index) => ({
    domain,
    delta: computeRatingDelta(
      normalized,
      level,
      index === 0 ? 1 : SECONDARY_DOMAIN_WEIGHT,
      challengeRating,
    ),
  }));

  return { xp, currency: computeCurrency(xp), deltas };
}

export interface RatingPipelineOptions {
  /** Domain list per game id: primary category first, then secondary domains. */
  getDomains(gameId: string): readonly string[];
}

/**
 * Build the `RatingService` consumed by `SessionRepository.completeSession`.
 * Pure computation; the db layer applies the outcome atomically.
 */
export function createRatingPipeline(options: RatingPipelineOptions): RatingService {
  return {
    async compute(input: { session: GameSessionRecord }): Promise<RatingOutcome> {
      return computeRatingOutcome(input.session, options.getDomains);
    },
  };
}
