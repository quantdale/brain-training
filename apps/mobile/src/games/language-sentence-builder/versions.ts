/**
 * Version metadata for the Sentence Builder game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json` (the single
 * source of truth consumed by the registry generator); this module only owns
 * the scoring version and the numeric mapping used by the integer version
 * columns of `game_sessions`.
 */

/** Scoring/normalization version — bump when normalization formula changes. */
export const SCORING_VERSION = '1.1.0';

/**
 * Map a semantic version string to the integer recorded in the db
 * (`game_sessions.game_version` etc.): the numeric major component.
 */
export function versionToNumber(version: string | null): number {
  const match = /^(\d+)/.exec(version ?? '');
  if (match === null) {
    throw new Error(`versionToNumber: "${version}" has no numeric major component`);
  }
  return Number(match[1]);
}
