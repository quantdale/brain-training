/**
 * Global player level from cumulative XP (constitution §17: one global level
 * driven by XP; XP requirements grow smoothly with no practical hard cap and
 * no prestige reset).
 *
 * Curve: reaching level L requires `50 * L * (L - 1)` cumulative XP, so each
 * level requires 100 XP more than the previous one (level 2 at 100, level 3
 * at 300, level 4 at 600, ...). Quadratic, smooth, unbounded — no cap.
 *
 * All functions are pure and deterministic. Non-finite totals (NaN/±Infinity
 * from a corrupt aggregate) are treated as 0 so display paths degrade to
 * level 1 instead of propagating NaN or throwing.
 */

/** Coerce a raw cumulative-XP total into a safe finite integer >= 0. */
function sanitizeXp(xp: number): number {
  if (!Number.isFinite(xp)) {
    return 0;
  }
  return Math.max(0, Math.floor(xp));
}

/** Cumulative XP required to REACH `level` (level >= 1; level 1 needs 0). */
export function xpForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`xpForLevel: level must be an integer >= 1, got ${level}`);
  }
  return 50 * level * (level - 1);
}

/**
 * Player level for a cumulative XP total: the largest level whose entry
 * requirement is satisfied.
 */
export function levelForXp(xp: number): number {
  const total = sanitizeXp(xp);
  // Inverse of 50*L*(L-1) = total -> L = (1 + sqrt(1 + 0.08*total)) / 2.
  return Math.floor((1 + Math.sqrt(1 + 0.08 * total)) / 2);
}

/** Cumulative XP the current level already contains (for progress display). */
export function xpIntoLevel(xp: number): number {
  const total = sanitizeXp(xp);
  const level = levelForXp(total);
  return total - xpForLevel(level);
}

/** XP still needed to advance from the current level to the next one. */
export function xpForNextLevel(xp: number): number {
  const level = levelForXp(xp);
  return xpForLevel(level + 1) - xpForLevel(level);
}

/** Progress within the current level, in [0, 1). */
export function levelProgress(xp: number): number {
  const into = xpIntoLevel(xp);
  const next = xpForNextLevel(xp);
  if (next <= 0) {
    return 0;
  }
  return Math.min(1, into / next);
}
