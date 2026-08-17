/**
 * Rating engine (WP-2H): XP/level curve and the rating/currency pipeline.
 * The db layer consumes this through the `RatingService` seam
 * (`@/db` -> `AppDatabaseOptions.rating`) and applies outcomes atomically.
 */
export {
  computeRatingDelta,
  computeRatingOutcome,
  computeXp,
  computeCurrency,
  createRatingPipeline,
  clamp01,
  DIFFICULTY_EXPECTED_PERFORMANCE,
  DIFFICULTY_XP_MULTIPLIER,
  MAX_RATING_DELTA_PER_SESSION,
  RATING_K,
  SECONDARY_DOMAIN_WEIGHT,
  XP_CURRENCY_RATE,
} from './pipeline';
export type { RatingPipelineOptions } from './pipeline';
export {
  levelForXp,
  levelProgress,
  xpForLevel,
  xpForNextLevel,
  xpIntoLevel,
} from './levels';
export {
  computeComposite,
} from './composite';
export type { CompositeResult, DomainRatingWithStaleness } from './composite';
