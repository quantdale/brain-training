/**
 * Named difficulty → internal difficulty parameters / challenge rating mapping
 * (constitution §9: player-facing named modes with finer-grained internal
 * parameters and continuous challenge/skill estimates; "Manual easy play may
 * still earn participation XP but should not inflate skill ratings").
 *
 * The SDK provides the contract plus a default mapping (challenge ratings only,
 * no game-specific parameters). Each game extends it by passing its own
 * internal parameters through `resolveDifficulty`; games may also implement
 * `DifficultyMapping` directly for fully custom behavior.
 */
export const DIFFICULTY_LEVELS = ['easy', 'normal', 'hard', 'expert', 'adaptive'] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export function isDifficultyLevel(value: unknown): value is DifficultyLevel {
  return typeof value === 'string' && (DIFFICULTY_LEVELS as readonly string[]).includes(value);
}

/**
 * Resolved difficulty for a session.
 *
 * `challengeRating` is a continuous estimate in [0, 1] — the internal
 * representation shared with rating/XP logic (Phase 2). `adaptive` starts at
 * a neutral baseline (0.5) and the game adjusts `challengeRating` during play.
 *
 * `parameters` are game-defined internal tuning values (e.g. sequence length,
 * response window ms); the SDK only carries them.
 */
export interface DifficultyProfile {
  readonly level: DifficultyLevel;
  readonly challengeRating: number;
  readonly parameters: Readonly<Record<string, number>>;
}

/** Contract for games that map difficulties themselves. */
export interface DifficultyMapping {
  resolve(level: DifficultyLevel): DifficultyProfile;
}

/** Default challenge ratings for fixed levels (baseline; games may deviate). */
export const DEFAULT_CHALLENGE_RATINGS: Readonly<Record<Exclude<DifficultyLevel, 'adaptive'>, number>> = {
  easy: 0.2,
  normal: 0.5,
  hard: 0.8,
  expert: 0.95,
};

/** Baseline profile for `adaptive`; games adjust continuously during play. */
export const ADAPTIVE_BASELINE: Readonly<DifficultyProfile> = Object.freeze({
  level: 'adaptive',
  challengeRating: 0.5,
  parameters: {},
});

export function clampChallengeRating(rating: number): number {
  if (!Number.isFinite(rating)) {
    throw new RangeError(`challengeRating must be finite, got ${rating}`);
  }
  return Math.min(1, Math.max(0, rating));
}

/**
 * Reference mapping: resolves any level to a `DifficultyProfile`, merging
 * game-defined internal parameters over the SDK defaults. Never mutates the
 * defaults — callers may safely keep the returned object.
 */
export function resolveDifficulty(
  level: DifficultyLevel,
  gameParameters: Readonly<Record<string, number>> = {},
): DifficultyProfile {
  if (level === 'adaptive') {
    return {
      level,
      challengeRating: ADAPTIVE_BASELINE.challengeRating,
      parameters: { ...gameParameters },
    };
  }
  return {
    level,
    challengeRating: clampChallengeRating(DEFAULT_CHALLENGE_RATINGS[level]),
    parameters: { ...gameParameters },
  };
}

/** Player-facing labels for the named difficulty levels. */
export const DIFFICULTY_LABELS: Readonly<Record<DifficultyLevel, string>> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  expert: 'Expert',
  adaptive: 'Adaptive',
};
