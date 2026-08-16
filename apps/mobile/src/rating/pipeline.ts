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
  Easy: 0.8,
  Normal: 1,
  Hard: 1.2,
  Expert: 1.4,
  Adaptive: 1.1,
};

/**
 * Expected normalized performance per difficulty level. Playing far above the
 * baseline gains rating; far below loses it. Easy has a high baseline so
 * easy play cannot inflate ratings (constitution §9).
 */
export const DIFFICULTY_EXPECTED_PERFORMANCE: Readonly<Record<string, number>> = {
  Easy: 0.8,
  Normal: 0.6,
  Hard: 0.45,
  Expert: 0.3,
  Adaptive: 0.5,
};

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
): number {
  const expected = DIFFICULTY_EXPECTED_PERFORMANCE[difficultyLevel] ?? DIFFICULTY_EXPECTED_PERFORMANCE.Normal;
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
  return difficulty?.level ?? 'Normal';
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
  const normalized = clamp01(session.normalizedResult);

  const xp = computeXp(normalized, level);
  const deltas: readonly RatingDelta[] = getDomains(session.gameId).map((domain, index) => ({
    domain,
    delta: computeRatingDelta(normalized, level, index === 0 ? 1 : SECONDARY_DOMAIN_WEIGHT),
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
