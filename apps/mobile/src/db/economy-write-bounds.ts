/** Statement-local cumulative bounds for normal append paths.
 *
 * Every caller binds its safe-integer delta as the FINAL parameter. Keeping
 * the test inside INSERT ... SELECT is atomic even for concurrent standalone
 * writes; a separate JavaScript read/check would race and could round first.
 * Valid prior totals and a safe delta sum to at most 2*MAX_SAFE, well inside
 * SQLite's exact signed-64 accumulator. Corrupt overflowing SUMs fail closed.
 * Bulk restore uses its own transaction-wide, deduplicated final-state check.
 */
const MAX = Number.MAX_SAFE_INTEGER;

export const CURRENCY_WRITE_WITHIN_SAFE_BOUNDS = `
  ((SELECT COALESCE(SUM(amount), 0) FROM currency_ledger) + ?)
  BETWEEN ${-MAX} AND ${MAX}`;

export const XP_WRITE_WITHIN_SAFE_BOUNDS = `
  ((SELECT COALESCE(SUM(xp), 0) FROM game_sessions)
   + (SELECT COALESCE(SUM(amount), 0) FROM xp_awards) + ?)
  BETWEEN 0 AND ${MAX}`;
