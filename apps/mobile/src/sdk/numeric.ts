/**
 * Canonical numeric helpers shared by game modules and the rating pipeline.
 *
 * Games previously re-implemented these locally; the SDK is the single source
 * so the normalized-score clamp and seed mapping cannot drift between games.
 */

/**
 * Clamp to [0, 1] — the canonical normalized-performance scale.
 *
 * Invariant: `NormalizedPerformance.value` is persisted and later drives XP
 * and rating deltas. Non-finite input (NaN/±Infinity from a corrupt or
 * garbage statistic) collapses to 0 — the safe worst-case — instead of
 * propagating NaN/Infinity into persisted or rating arithmetic. Finite input
 * is only clamped, never otherwise transformed, so persisted normalized
 * scores keep their existing meaning.
 */
export function canonicalClamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
