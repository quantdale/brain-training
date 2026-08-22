/**
 * Signal definitions for Advanced Personalization V2.
 *
 * Every signal is a PURE function over stored evidence plus an injectable
 * clock: no db access, no wall-clock reads, no randomness. Each returns a
 * strength value in [0, 1] — how strongly the signal argues FOR the game
 * (dampeners like overexposure return > 0 too; their NEGATIVE weights in
 * `weights.ts` make them demote). A value of 0 means "no evidence" and the
 * scorer omits the component entirely, so reasons stay honest.
 *
 * The weak/stale kernel (`WEAK_DOMAIN_RATING_THRESHOLD`, `STALE_DOMAIN_DAYS`,
 * {@link isDomainStale}) is the single source of truth shared with the legacy
 * workout reorder in `src/workout/personalize.ts`, which consumes this module.
 */

import { clamp01 } from '@/rating/pipeline';

import type {
  DomainRatingView,
  GameAggregateView,
  PersonalizationContext,
  PersonalizationOptions,
  RecentSessionView,
} from './types';

/** Milliseconds per day; keeps staleness math local to this module. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A domain is treated as "weak" when its rating is below this threshold.
 * Deliberately equal to `INITIAL_RATING` (1000) in src/db/rating.ts: a domain
 * that was never played sits exactly at the initial rating, so only domains
 * that have ACTIVELY declined are favored. The workout layer's test pins the
 * two constants together — changing one must be a conscious re-alignment.
 */
export const WEAK_DOMAIN_RATING_THRESHOLD = 1000;

/**
 * A domain rating not updated for this many days is treated as stale
 * (constitution §15). Deliberately equal to the default horizon of
 * `isRatingStale` in src/db/rating.ts — pinned together by a test.
 */
export const STALE_DOMAIN_DAYS = 30;

/**
 * Rating drop below the weak threshold at which weakness saturates to 1.0.
 * A 200-point decline (~8+ bad sessions) is full weakness; half that is 0.5.
 */
export const WEAKNESS_FULL_AT_DROP = 200;

/** Completed sessions at which a domain stops counting as undertrained. */
export const UNDERTRAINED_MIN_SESSIONS = 3;

/** Lifetime sessions at which a game stops earning any novelty boost. */
export const NOVELTY_MAX_SESSIONS = 3;

/**
 * Game-fatigue window measured in SESSIONS, not days: how many of the
 * player's most recent sessions (across all games) we inspect. Clock-free by
 * design so fatigue works even without an injected `nowMs`.
 */
export const FATIGUE_RECENT_SESSIONS = 10;

/** Recent plays of a game that are tolerated before fatigue kicks in. */
export const FATIGUE_FREE_SESSIONS = 2;

/** How many most-recent sessions of a game form its "recent form" sample. */
export const FORM_SESSIONS = 5;

/** Sessions required (lifetime AND in-form) before a trend is trusted. */
export const MIN_TREND_SESSIONS = 3;

/** Recent-vs-lifetime normalized delta that saturates the trend signal. */
export const TREND_SATURATION = 0.2;

/** Gap to the personal best within which proximity boosts (full at 0). */
export const PB_PROXIMITY_GAP = 0.15;

/**
 * Productive-band boundaries for difficulty fit on the normalized scale:
 * results below `tooHard` are frustrating, above `tooEasy` trivial, and the
 * band `[goodLow, goodHigh]` is the flat top of the fit curve.
 */
export const FIT_BAND = {
  tooHard: 0.3,
  goodLow: 0.45,
  goodHigh: 0.75,
  tooEasy: 0.9,
} as const;

/**
 * Staleness check mirroring `isRatingStale` in src/db/rating.ts exactly
 * (`now - updatedAt > maxAgeDays`, strict inequality — exactly 30 days is NOT
 * stale). Tolerates a missing/non-numeric timestamp and an omitted clock by
 * returning `false` (never stale without evidence), matching the opt-in
 * semantics of the legacy workout layer. Throws on a non-positive horizon,
 * like the canonical engine.
 */
export function isDomainStale(
  updatedAt: unknown,
  nowMs: number | undefined,
  maxAgeDays: number = STALE_DOMAIN_DAYS,
): boolean {
  if (maxAgeDays <= 0) {
    throw new RangeError('isDomainStale: maxAgeDays must be > 0');
  }
  if (nowMs === undefined || typeof updatedAt !== 'number') {
    return false;
  }
  return nowMs - updatedAt > maxAgeDays * DAY_MS;
}

/** Whole days since `updatedAt`, floored; `null` without usable inputs. */
export function daysSinceUpdate(
  updatedAt: unknown,
  nowMs: number | undefined,
): number | null {
  if (nowMs === undefined || typeof updatedAt !== 'number') {
    return null;
  }
  return Math.floor((nowMs - updatedAt) / DAY_MS);
}

/** Per-domain signal summary used by both the V2 scorer and the workout reorder. */
export interface DomainSignalSummary {
  domain: string;
  /** Always `true` here: the map only contains domains with a rating row. */
  seen: boolean;
  /** Stored rating (never fabricated: absent domains have no entry). */
  rating: number;
  /** Actively declined below {@link WEAK_DOMAIN_RATING_THRESHOLD}. */
  weak: boolean;
  /** Weakness strength in [0, 1]; 0 when not weak. */
  weakness: number;
  /** Completed sessions that contributed to the rating. */
  sessions: number;
  /** Freshness-marked stale per {@link isDomainStale}. */
  stale: boolean;
  /** Staleness strength in [0, 1]; 0 when not stale. */
  staleness: number;
  /** Whole days since the last contributing session, or `null`. */
  daysSinceUpdate: number | null;
}

/**
 * Compute per-domain signals for every rating row. Domains WITHOUT a row are
 * intentionally absent from the map — consumers treat absence as "unseen":
 * never weak, never stale, maximally undertrained (see
 * {@link undertrainingValue}). Duplicate rows for one domain: last wins.
 */
export function computeDomainSignals(
  ratings: readonly DomainRatingView[],
  options: PersonalizationOptions = {},
): Map<string, DomainSignalSummary> {
  const staleDays = options.staleDays ?? STALE_DOMAIN_DAYS;
  const map = new Map<string, DomainSignalSummary>();
  for (const row of ratings) {
    // Defensive: direct callers may pass unsanitized db output; skip rows
    // that are null/malformed rather than crashing mid-signal.
    if (
      row === null ||
      typeof row !== 'object' ||
      typeof row.domain !== 'string' ||
      !Number.isFinite(row.rating)
    ) {
      continue;
    }
    const weak = row.rating < WEAK_DOMAIN_RATING_THRESHOLD;
    const stale = isDomainStale(row.updatedAt, options.nowMs, staleDays);
    const age = daysSinceUpdate(row.updatedAt, options.nowMs);
    map.set(row.domain, {
      domain: row.domain,
      seen: true,
      rating: row.rating,
      weak,
      weakness: weak
        ? clamp01(
            (WEAK_DOMAIN_RATING_THRESHOLD - row.rating) / WEAKNESS_FULL_AT_DROP,
          )
        : 0,
      sessions: typeof row.sessions === 'number' ? row.sessions : 0,
      stale,
      staleness:
        stale && age !== null
          ? clamp01((age - staleDays) / staleDays)
          : 0,
      daysSinceUpdate: age,
    });
  }
  return map;
}

/**
 * Undertraining strength for a domain: unseen domains (no rating row) are
 * maximally undertrained (1.0); otherwise it decays linearly to 0 at
 * {@link UNDERTRAINED_MIN_SESSIONS} completed sessions.
 */
export function undertrainingValue(
  summary: DomainSignalSummary | undefined,
): number {
  const sessions = summary ? summary.sessions : 0;
  return clamp01(1 - sessions / UNDERTRAINED_MIN_SESSIONS);
}

/** Per-game evidence derived from the context (aggregates + recent sessions). */
export interface GameEvidence {
  gameId: string;
  /** Lifetime completed sessions (aggregate count, session-list fallback). */
  lifetimeSessions: number;
  /** Plays within the last {@link FATIGUE_RECENT_SESSIONS} overall sessions. */
  recentPlays: number;
  /** Size of the available recent-form sample (≤ {@link FORM_SESSIONS}). */
  formSessions: number;
  /** Mean normalized result of the form sample, or `null` when none. */
  recentFormNormalized: number | null;
  /** Best normalized result inside the form sample, or `null` when none. */
  recentBestNormalized: number | null;
  /** Lifetime mean normalized result, or `null` without an aggregate row. */
  lifetimeAvgNormalized: number | null;
  /** Lifetime best normalized result, or `null` without an aggregate row. */
  bestNormalized: number | null;
}

/**
 * Derive one game's evidence from the context. `context.recentSessions` must
 * be newest-first (db convention); the form sample is its first
 * {@link FORM_SESSIONS} entries for this game.
 */
export function computeGameEvidence(
  gameId: string,
  context: PersonalizationContext,
): GameEvidence {
  let recentPlays = 0;
  const form: RecentSessionView[] = [];
  for (const session of context.recentSessions) {
    if (session.gameId !== gameId) {
      continue;
    }
    if (form.length < FORM_SESSIONS) {
      form.push(session);
    }
  }
  const fatigueWindow = context.recentSessions.slice(0, FATIGUE_RECENT_SESSIONS);
  for (const session of fatigueWindow) {
    if (session.gameId === gameId) {
      recentPlays += 1;
    }
  }

  const aggregate: GameAggregateView | undefined =
    context.aggregateByGame.get(gameId);

  return {
    gameId,
    lifetimeSessions: aggregate ? aggregate.count : form.length,
    recentPlays,
    formSessions: form.length,
    recentFormNormalized:
      form.length === 0
        ? null
        : form.reduce((sum, s) => sum + s.normalizedResult, 0) / form.length,
    recentBestNormalized:
      form.length === 0
        ? null
        : form.reduce((max, s) => Math.max(max, s.normalizedResult), -Infinity),
    lifetimeAvgNormalized: aggregate ? aggregate.avgNormalized : null,
    bestNormalized: aggregate ? aggregate.bestNormalized : null,
  };
}

/** Novelty strength: full for never-played games, 0 at {@link NOVELTY_MAX_SESSIONS}. */
export function noveltyValue(evidence: GameEvidence): number {
  return clamp01(1 - evidence.lifetimeSessions / NOVELTY_MAX_SESSIONS);
}

/**
 * Fatigue strength: 0 while the game took at most
 * {@link FATIGUE_FREE_SESSIONS} of the last {@link FATIGUE_RECENT_SESSIONS}
 * sessions, saturating when it dominated the whole window.
 */
export function fatigueValue(evidence: GameEvidence): number {
  if (evidence.recentPlays <= FATIGUE_FREE_SESSIONS) {
    return 0;
  }
  const span = FATIGUE_RECENT_SESSIONS - FATIGUE_FREE_SESSIONS;
  return clamp01((evidence.recentPlays - FATIGUE_FREE_SESSIONS) / span);
}

/**
 * Momentum strength: how far recent form exceeds the lifetime average,
 * saturating at {@link TREND_SATURATION}. Requires at least
 * {@link MIN_TREND_SESSIONS} sessions on BOTH sides; declining form yields 0
 * (decline is handled by the domain-level signals instead).
 */
export function trendValue(evidence: GameEvidence): number {
  if (
    evidence.recentFormNormalized === null ||
    evidence.lifetimeAvgNormalized === null ||
    evidence.formSessions < MIN_TREND_SESSIONS ||
    evidence.lifetimeSessions < MIN_TREND_SESSIONS
  ) {
    return 0;
  }
  return clamp01(
    (evidence.recentFormNormalized - evidence.lifetimeAvgNormalized) /
      TREND_SATURATION,
  );
}

/**
 * Personal-best proximity: 1.0 when the recent form sample touches the
 * lifetime best, decaying to 0 at a gap of {@link PB_PROXIMITY_GAP}.
 */
export function personalBestProximityValue(evidence: GameEvidence): number {
  if (
    evidence.recentBestNormalized === null ||
    evidence.bestNormalized === null ||
    evidence.formSessions === 0
  ) {
    return 0;
  }
  const gap = evidence.bestNormalized - evidence.recentBestNormalized;
  if (gap < 0 || gap > PB_PROXIMITY_GAP) {
    return 0;
  }
  return clamp01(1 - gap / PB_PROXIMITY_GAP);
}

/**
 * Difficulty fit via trapezoid membership over {@link FIT_BAND}: 0 outside
 * the productive range, ramping to a flat 1 across `[goodLow, goodHigh]`.
 * Uses the recent-form mean — the player's demonstrated current level.
 */
export function difficultyFitValue(evidence: GameEvidence): number {
  const x = evidence.recentFormNormalized;
  if (x === null || evidence.formSessions === 0) {
    return 0;
  }
  const { tooHard, goodLow, goodHigh, tooEasy } = FIT_BAND;
  if (x <= tooHard || x >= tooEasy) {
    return 0;
  }
  if (x < goodLow) {
    return (x - tooHard) / (goodLow - tooHard);
  }
  if (x <= goodHigh) {
    return 1;
  }
  return (tooEasy - x) / (tooEasy - goodHigh);
}
