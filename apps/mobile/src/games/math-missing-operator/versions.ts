/**
 * Version metadata for the Math Missing Operator game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json` (the single
 * source of truth consumed by the registry generator); this module only owns
 * the scoring version and the numeric mapping used by the integer version
 * columns of `game_sessions` (see `docs/PROJECT_CONSTITUTION.md` §21).
 */

/** Scoring/normalization version — bump when `normalizeMathMissingOperatorResult` changes. */
export const SCORING_VERSION = '1.1.0';

/**
 * Map a semantic version string to the integer recorded in the db
 * (`game_sessions.game_version` etc.): the numeric major component. The full
 * string versions always travel with the raw result / diagnostic metadata, so
 * no information is lost. `null` (non-procedural games) is rejected.
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
