/**
 * Domain types for the canonical local persistence layer (src/db).
 *
 * The layer stores exactly what the Game SDK and app produce: game sessions,
 * a singleton local profile, and an append-only currency ledger. See
 * docs/PROJECT_CONSTITUTION.md §6 (profiles), §9 (session model),
 * §17 (XP/level/currency: "Currency uses an append-only transaction ledger").
 */

/** Values we ever bind into SQLite queries. Kept to the common dialect subset. */
export type SQLiteValue = string | number | null;

/** The singleton local profile row. `id` is a fixed key, not a generated UUID. */
export interface Profile {
  id: string;
  displayName: string;
  settings: Record<string, unknown>;
  /** Unix epoch milliseconds. */
  createdAt: number;
  /** Unix epoch milliseconds. */
  updatedAt: number;
}

/**
 * A completed game session as persisted. All timestamps are Unix epoch
 * milliseconds; `difficulty` and `rawResult` are opaque JSON payloads owned by
 * the game/generator (this layer never interprets their contents).
 */
export interface GameSessionRecord {
  id: string;
  gameId: string;
  gameVersion: number;
  generatorVersion: number;
  scoringVersion: number;
  seed: number;
  difficulty: unknown;
  rawResult: unknown;
  normalizedResult: number;
  xp: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
}

/** One immutable currency ledger entry. `id` is strictly monotonic. */
export interface LedgerEntry {
  id: number;
  /** Signed delta: positive = credit, negative = debit. */
  amount: number;
  reason: string;
  /** Reference to the game session that produced this entry, if any. */
  sessionId: string | null;
  /** Unix epoch milliseconds. */
  createdAt: number;
}

/** Input for the atomic session-completion API. */
export interface CompleteSessionInput {
  session: GameSessionRecord;
  /**
   * Optional currency ledger entry committed atomically with the session.
   * Applies ONLY when no rating service is configured; when a rating service
   * is present it owns the gameplay currency award and this field is ignored
   * (task 7.6) so the same completion event is never double-awarded.
   */
  currency?: {
    amount: number;
    reason: string;
  };
}

/** One domain's rating movement for a completed session. */
export interface RatingDelta {
  /** Cognitive domain (a GameCategory string; see SDK `GAME_CATEGORIES`). */
  domain: string;
  /** Signed rating points applied to the domain. */
  delta: number;
}

/**
 * A rating delta after being applied to the database, including the domain's
 * resulting rating. This is the authoritative per-domain outcome returned by
 * the session-completion boundary.
 */
export interface AppliedRatingDelta extends RatingDelta {
  /** Domain rating after applying this delta. */
  ratingAfter: number;
}

/** What a rating service computed for one completed session. */
export interface RatingOutcome {
  /** Authoritative XP award for the session (overrides the game-reported value). */
  xp: number;
  /** Currency amount appended to the ledger for this session (>= 0). */
  currency: number;
  /** Rating movement per domain; empty = no movement. */
  deltas: readonly RatingDelta[];
}

/**
 * The authoritative completion outcome returned by the session-completion
 * boundary (constitution §15). Contains everything the UI needs to display
 * the result: persisted session, XP, currency, per-domain rating movements
 * with resulting ratings, and post-completion balance.
 */
export interface CompletionOutcome {
  /** The persisted session record (xp reflects authoritative rating pipeline value). */
  session: GameSessionRecord;
  /** Authoritative XP for this session. */
  xp: number;
  /** Currency awarded for this session. */
  currency: number;
  /** Per-domain applied deltas with resulting ratings. */
  deltas: readonly AppliedRatingDelta[];
  /** Currency balance after this completion. */
  balance: number;
}

/**
 * Optional rating seam consumed by `completeSession`. The implementation is
 * app-owned (`src/rating/pipeline.ts`); the db layer only applies the
 * outcome inside the session transaction so XP/currency/ratings are always
 * atomic with the session row.
 */
export interface RatingService {
  compute(input: { session: GameSessionRecord }): Promise<RatingOutcome>;
}
