/**
 * Version metadata for the Color Stroop game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json` (the single
 * source of truth consumed by the registry generator); this module only owns
 * the scoring version and the numeric mapping used by the integer version
 * columns of `game_sessions`.
 */

/** Scoring/normalization version — bump when `normalizeColorStroopResult` changes. */
export const SCORING_VERSION = '1.0.0';

/**
 * Map a semantic version string to the integer recorded in the db.
 * `null` (non-procedural games) is rejected.
 */
export function versionToNumber(version: string | null): number {
  const match = /^(\d+)/.exec(version ?? '');
  if (match === null) {
    throw new Error(`versionToNumber: "${version}" has no numeric major component`);
  }
  return Number(match[1]);
}