/**
 * Pure query-building helpers shared by the repositories (campaign 010 W11).
 *
 * Everything here is deterministic and DB-free: it only shapes SQL fragments
 * and normalizes caller-supplied numbers so repository methods can compose
 * parameterized statements without string-concatenating unvalidated input.
 * No identifier or value is ever interpolated from caller data — values always
 * travel as positional `?` params.
 */

/**
 * Conservative per-statement bind-variable budget used to split `IN (...)`
 * lists and batch groups. SQLite's historical default limit is 999 variables
 * per statement; 500 leaves headroom for the statement's other params and is
 * far below every build either backend (expo-sqlite / better-sqlite3) ships.
 */
export const SQL_VARIABLE_CHUNK = 500;

/** Default read limit when a caller omits one. */
export const DEFAULT_READ_LIMIT = 50;

/**
 * Hard ceiling for any caller-supplied read limit. Bounds a single page even
 * when a caller passes an "everything" number, so new APIs cannot regress into
 * the unbounded materialization pattern the 009 audit flagged.
 */
export const MAX_READ_LIMIT = 10_000;

/**
 * Split `items` into chunks of at most `size` elements. The last chunk may be
 * shorter; empty input yields no chunks.
 */
export function chunk<T>(items: readonly T[], size: number = SQL_VARIABLE_CHUNK): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`chunk: size must be a positive integer (got ${size})`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/** Build a comma-separated `?,?,?` placeholder list of length `count`. */
export function buildInPlaceholders(count: number): string {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`buildInPlaceholders: count must be a non-negative integer (got ${count})`);
  }
  return Array.from({ length: count }, () => '?').join(',');
}

/**
 * Normalize a caller-supplied LIMIT: undefined/NaN/non-positive falls back to
 * `fallback`, anything above `max` clamps to `max`.
 */
export function clampLimit(limit: number | undefined, fallback: number, max: number): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(limit), max);
}

/** Normalize a caller-supplied OFFSET: undefined/NaN/negative becomes 0. */
export function normalizeOffset(offset: number | undefined): number {
  if (offset === undefined || !Number.isFinite(offset) || offset <= 0) {
    return 0;
  }
  return Math.floor(offset);
}

/**
 * Join WHERE conditions with AND. Returns '' for no conditions so callers can
 * inline the result (`SELECT ... ${where} ORDER BY ...`) without a branch.
 */
export function joinAnd(conditions: readonly string[]): string {
  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Validate that a value is a finite number usable as a bound parameter.
 * Throws with the caller-facing parameter name — NaN/Infinity must never reach
 * SQLite (better-sqlite3 rejects them; expo-sqlite binds them unpredictably).
 */
export function requireFiniteNumber(value: number | undefined, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name}: must be a finite number (got ${String(value)})`);
  }
  return value;
}
