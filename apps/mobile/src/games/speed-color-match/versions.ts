/**
 * Version metadata for the Speed Color Match game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json`; this module
 * owns the scoring version and the numeric mapping used by the integer version
 * columns of `game_sessions`.
 */

/** Scoring/normalization version — bump when `normalizeSpeedColorMatchResult` changes. */
export const SCORING_VERSION = '1.1.0';

/**
 * Map a semantic version string to the integer recorded in the db
 * (`game_sessions.game_version` etc.): the numeric major component. The full
 * string versions always travel with the raw result / diagnostic metadata.
 */
export function versionToNumber(version: string | null): number {
  const match = /^(\d+)/.exec(version ?? '');
  if (match === null) {
    throw new Error(`versionToNumber: "${version}" has no numeric major component`);
  }
  return Number(match[1]);
}
