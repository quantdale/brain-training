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
 * Non-numeric suffixes (e.g. "1.0.0-beta") are tolerated: each segment falls
 * back to 0 instead of poisoning the integer column with NaN.
 */
export function versionToNumber(version: string | null): number {
  const text = version ?? '';
  const match = /^(\d+)/.exec(text);
  if (match === null) {
    throw new Error(`versionToNumber: "${version}" has no numeric major component`);
  }
  const segment = (raw: string | undefined): number => {
    const parsed = Number(raw ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const parts = text.split('.');
  return segment(parts[0]) * 1000000 + segment(parts[1]) * 1000 + segment(parts[2]);
}
