/**
 * Version metadata for the Order Path game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json` (the single
 * source of truth consumed by the registry generator); `SCORING_VERSION`
 * tracks scoring/normalization changes. This module also owns the numeric
 * version mapping used by the integer version columns of `game_sessions`.
 */
import { RNG_ALGORITHM_VERSION } from '@/sdk';

/** Scoring/normalization version — bump when `normalizeOrderPathResult` changes. */
export const SCORING_VERSION = '1.1.0';

/** Algorithm version backing deterministic generation (kept for diagnostics). */
export const GENERATOR_ALGORITHM_VERSION = RNG_ALGORITHM_VERSION;

/**
 * Map a semantic version string to the integer recorded in the db
 * (`game_sessions.game_version` etc.): `major*1e6 + minor*1e3 + patch` so
 * versions are distinguishable. `null` (non-procedural games) maps to `0`.
 */
export function versionToNumber(version: string | null): number {
  if (version === null) {
    return 0;
  }
  const parts = (version ?? '').split('.');
  const ma = Number(parts[0] ?? 0);
  const mi = Number(parts[1] ?? 0);
  const pa = Number(parts[2] ?? 0);
  return ma * 1_000_000 + mi * 1_000 + pa;
}
