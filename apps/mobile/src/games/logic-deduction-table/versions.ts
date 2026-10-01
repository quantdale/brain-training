/**
 * Version metadata for the Deduction Table game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json` (the single
 * source of truth consumed by the registry generator); `SCORING_VERSION`
 * tracks scoring/normalization changes. `versionToNumber` maps a semantic
 * version to the integer recorded in `game_sessions` version columns so the
 * full string versions still travel in the raw result. `null` (non-
 * procedural games) maps to `0`; this game ships a generator, so its
 * `generatorVersion` is a real string.
 */

import { GAME_ID } from "./types";
import { packVersion } from '@/sdk/version-pack';

export const SCORING_VERSION = "1.1.0";

export const GAME_ID_CONST = GAME_ID;

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
