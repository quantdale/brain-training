/**
 * Assistant seam types (campaign 010, W19; constitution §22).
 *
 * Contracts for a FUTURE advisory AI assistant: a training-context summary
 * DTO built purely from already-stored local data shapes, plus history
 * transport DTOs. No provider, no network, no inference, no persistence —
 * the exact assistant feature set, RAG corpus and provider economics are
 * registered deferred decisions (docs/DEFERRED_DECISIONS.md).
 *
 * INVARIANT (constitution §22): the assistant is ADVISORY ONLY. It must
 * never silently modify authoritative ratings, XP, currency, streaks or any
 * progression state. {@link AssistantContextSummary.advisoryOnly} is typed
 * as the literal `true` so a summary that could ever carry write intent
 * fails to compile.
 */

/** Version of the context-summary DTO shape (for future consumers). */
export const ASSISTANT_CONTEXT_VERSION = '1.0.0';

/**
 * Inactivity horizon (days) after which a domain snapshot is marked stale.
 * Mirrors the staleness convention of `src/personalization` (marked stale,
 * never decayed — constitution §15).
 */
export const STALE_DOMAIN_DAYS = 30;

/** Max recent sessions carried in a summary (newest-first slice). */
export const RECENT_SESSION_LIMIT = 10;

/** Max most-played games carried in a summary. */
export const TOP_GAME_LIMIT = 3;

/**
 * Cognitive domain name as stored in `domain_ratings` (a plain `string`, the
 * GameCategory vocabulary — kept loose so repository rows pass in without
 * casts, mirroring the structural-view policy of `src/personalization`).
 */
export type AssistantDomain = string;

/**
 * Structural view of a `DomainRating` row (`src/db/rating.ts`). Callers pass
 * repository results directly — zero db imports, zero I/O here.
 */
export interface DomainRatingView {
  domain: AssistantDomain;
  rating: number;
  /** Completed sessions that contributed to this rating. */
  sessions?: number;
  /** Unix epoch ms of the last contributing session. */
  updatedAt?: number;
}

/** Structural view of a `GameAggregate` row (`src/db/sessions.ts`). */
export interface GameAggregateView {
  gameId: string;
  count: number;
  /** Mean normalized performance (0..1). */
  avgNormalized: number;
  /** Best normalized performance (0..1). */
  bestNormalized: number;
  /** Unix epoch ms of the most recent session. */
  lastCompletedAt: number;
}

/** Structural view of the lightweight session projection (newest first). */
export interface RecentSessionView {
  gameId: string;
  /** Normalized performance (0..1) of the completed session. */
  normalizedResult: number;
  /** Unix epoch ms of the completion. */
  completedAt: number;
}

/** Structural view of the reconstructed streak (`src/streaks/types.ts`). */
export interface StreakStateView {
  current: number;
  longest: number;
  /** `YYYY-MM-DD` local date of last counted activity, or `null`. */
  lastActiveDate: string | null;
  atRisk: boolean;
}

/** One domain's advisory snapshot inside a summary. */
export interface AssistantDomainSnapshot {
  domain: AssistantDomain;
  rating: number;
  /** Contributing sessions, when known. */
  sessions: number | null;
  /**
   * Staleness verdict: `true`/`false` when both an injected clock and an
   * `updatedAt` timestamp were available, otherwise `null` (unknown — never
   * guessed).
   */
  stale: boolean | null;
}

/** One game's advisory snapshot (most-played slice of the aggregates). */
export interface AssistantGameSnapshot {
  gameId: string;
  count: number;
  avgNormalized: number;
  bestNormalized: number;
  lastCompletedAt: number;
}

/** Player-level figures for the summary. */
export interface AssistantProfileSnapshot {
  /** Sanitized cumulative XP (non-finite/negative input → 0). */
  totalXp: number;
  /** Derived via the shared XP curve (`levelForXp`, `src/rating`). */
  level: number;
  /** Currency balance when provided; `null` = not supplied. */
  coinBalance: number | null;
}

/**
 * The advisory training-context summary a future assistant would consume as
 * its grounding input. Built once per call by
 * `buildAssistantContextSummary` (`context.ts`); deterministic given the same
 * inputs and injected clock.
 */
export interface AssistantContextSummary {
  /** DTO shape version ({@link ASSISTANT_CONTEXT_VERSION}). */
  readonly contextVersion: typeof ASSISTANT_CONTEXT_VERSION;
  /** Injected clock value, or `null` when the caller omitted `nowMs`. */
  readonly generatedAtMs: number | null;
  readonly profile: AssistantProfileSnapshot;
  /** All sanitized domains, WEAKEST FIRST (rating asc, name-asc tiebreak). */
  readonly domains: readonly AssistantDomainSnapshot[];
  /** Most-played games, capped at {@link TOP_GAME_LIMIT}. */
  readonly topGames: readonly AssistantGameSnapshot[];
  /** Newest-first recent-session slice, capped at {@link RECENT_SESSION_LIMIT}. */
  readonly recentSessions: readonly RecentSessionView[];
  /** Streak snapshot, or `null` when none was supplied. */
  readonly streak: StreakStateView | null;
  /** Literal `true`: this DTO is grounding context, never write intent. */
  readonly advisoryOnly: true;
}

// ---------------------------------------------------------------------------
// History DTOs (transport shapes only; persistence format is deferred)
// ---------------------------------------------------------------------------

/** Author of one exchange turn. */
export type AssistantRole = 'user' | 'assistant';

/** Terminal state of one exchange turn. */
export type AssistantExchangeStatus =
  | 'complete'
  | 'aborted'
  | 'error';

/** One turn of an assistant conversation (transport DTO). */
export interface AssistantExchange {
  readonly id: string;
  readonly threadId: string;
  readonly role: AssistantRole;
  /** Unix epoch ms supplied by the caller's injectable clock. */
  readonly createdAtMs: number;
  readonly text: string;
  readonly status: AssistantExchangeStatus;
}

/** List-level view of one conversation thread (transport DTO). */
export interface AssistantThreadSummary {
  readonly id: string;
  /** Display title when one exists; `null` = untitled. */
  readonly title: string | null;
  readonly createdAtMs: number;
  readonly lastActivityAtMs: number;
  readonly exchangeCount: number;
}
