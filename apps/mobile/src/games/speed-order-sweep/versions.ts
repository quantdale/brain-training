/**
 * Version metadata for the Order Sweep game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json` (the single
 * source of truth consumed by the registry generator); this module only owns
 * the scoring version and the numeric mapping used by the integer version
 * columns of `game_sessions` (see `docs/PROJECT_CONSTITUTION.md` §21).
 */

import { packVersion } from '@/sdk/version-pack';

export const SCORING_VERSION = '1.0.0';

/**
 * Pack a semantic version string into the integer recorded in the db
 * (`game_sessions.game_version` and friends).
 *
 * 074: the definition moved to `packVersion` in `@/sdk/version-pack`, and this
 * per-game export is kept only so the module's public surface is unchanged.
 * There were 42 identical copies in three different bodies, and 29 of their
 * comments described an algorithm the code did not implement. An absent
 * (`null`) version now maps to a documented sentinel instead of throwing,
 * because `GameDefinition` permits `generatorVersion: null` for non-procedural
 * games while the db column is `NOT NULL`.
 */
export function versionToNumber(version: string | null | undefined): number {
  return packVersion(version);
}
