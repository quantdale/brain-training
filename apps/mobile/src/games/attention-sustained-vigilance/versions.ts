/**
 * Version metadata for the Sustained Vigilance game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json`; this module
 * owns the scoring version and the numeric mapping used by the integer version
 * columns of `game_sessions`.
 */

/** Scoring/normalization version — bump when `normalizeVigilanceResult` changes. */
export const SCORING_VERSION = '1.0.0';

/**
 * Map a semantic version string to the integer recorded in the db
 * (`game_sessions.game_version` etc.): major*1e6 + minor*1e3 + patch. The full
 * string versions always travel with the raw result / diagnostic metadata.
 */
export function versionToNumber(version: string | null): number {
  const match = /^(\d+)/.exec(version ?? '');
  if (match === null) {
    throw new Error(`versionToNumber: "${version}" has no numeric major component`);
  }
  const parts = (version ?? '').split('.');
  const ma = Number(parts[0] ?? 0);
  const mi = Number(parts[1] ?? 0);
  const pa = Number(parts[2] ?? 0);
  return ma * 1000000 + mi * 1000 + pa;
}
