/**
 * Result contract (GAME_SDK.md scoring rule; constitution §15: raw result →
 * normalized performance → expected-difficulty comparison → domain update →
 * overall composite).
 *
 * Games own raw scoring and must convert it through `PerformanceNormalizer`
 * before any shared rating/XP logic runs. Real XP/rating computation is
 * Phase 2 work; the contract ships now with a no-op default so Phase 1 games
 * can already flow results end-to-end.
 */
import type { DifficultyLevel } from './difficulty';
import type { GameCategory } from './game-definition';

/** Raw game result shape is game-owned; this is a loose marker for the generic. */
export type GameRawResult = Readonly<Record<string, unknown>>;

/** Supported performance scales. `0..1` is the canonical normalized scale. */
export type PerformanceScale = '0..1';

/** Normalized performance on a documented scale — the shared result currency. */
export interface NormalizedPerformance {
  /** Normalized value on `scale` (for `0..1`: 0 = worst, 1 = best possible). */
  readonly value: number;
  readonly scale: PerformanceScale;
  /** Optional snapshot of the raw result for diagnostics. */
  readonly raw?: unknown;
}

/** Context every normalizer receives at conversion time. */
export interface NormalizeContext {
  readonly gameId: string;
  readonly difficulty: DifficultyLevel;
  /** Active (non-paused) session duration in ms. */
  readonly durationMs: number;
}

/**
 * Game-owned conversion: raw result → `NormalizedPerformance`.
 * Implementations must document their normalization rules and clamp to [0, 1].
 */
export interface PerformanceNormalizer<TRaw = GameRawResult> {
  readonly gameId: string;
  normalize(raw: TRaw, context: NormalizeContext): NormalizedPerformance;
}

/** Rating delta for one cognitive domain, in rating points (Phase 2 semantics). */
export interface RatingDelta {
  readonly domain: GameCategory;
  readonly delta: number;
}

/** Context for XP/rating hooks. */
export interface XpRatingContext {
  readonly gameId: string;
  readonly difficulty: DifficultyLevel;
  /** Active (non-paused) session duration in ms. */
  readonly durationMs: number;
}

/**
 * XP/rating integration hook — Phase 2 implements the real algorithms
 * (hybrid lifetime/recent rating updates, XP curve, currency). Phase 1 code
 * should wire the shared `noopXpRatingHook` so the seam exists end-to-end.
 */
export interface XpRatingHook {
  /** XP awarded for the session (engagement reward; poor attempts still earn some). */
  computeXp(performance: NormalizedPerformance, context: XpRatingContext): number;
  /** Rating deltas per domain (empty = no change). */
  computeRatingDeltas(performance: NormalizedPerformance, context: XpRatingContext): readonly RatingDelta[];
}

/** No-op default: awards 0 XP and no rating movement. Phase 2 replaces this. */
export const noopXpRatingHook: XpRatingHook = {
  computeXp: () => 0,
  computeRatingDeltas: () => [],
};
