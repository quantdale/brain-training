/**
 * Version metadata for the Word Match game.
 *
 * `gameVersion` / `generatorVersion` are declared in `game.json` (the single
 * source of truth consumed by the registry generator); `CONTENT_PACK_VERSION`
 * comes from the bundled content pack (`content/pack.json`) so the pack
 * identity and the code that consumes it can never drift apart. This module
 * also owns the numeric version mapping used by the integer version columns
 * of `game_sessions` (see docs/PROJECT_CONSTITUTION.md §21).
 */
import { loadContentPack } from './content-validation';

/** Scoring/normalization version — bump when `normalizeLanguageResult` changes. */
export const SCORING_VERSION = '1.1.0';

/** Stable id of the bundled content pack (never renamed once shipped). */
export const CONTENT_PACK_ID: string = loadContentPack().packId;

/** Version of the bundled content pack (bump when the pack changes). */
export const CONTENT_PACK_VERSION: string = loadContentPack().packVersion;

/**
 * Map a semantic version string to the integer recorded in the db
 * (`game_sessions.game_version` etc.): the numeric major component. The full
 * string versions always travel with the raw result / diagnostic metadata, so
 * no information is lost. `null` (non-procedural games) maps to `0`, which
 * documents that no procedural generator produced the challenge — unlike the
 * Memory game, Word Match ships curated content (`generatorVersion: null`).
 */
export function versionToNumber(version: string | null): number {
  if (version === null) {
    return 0;
  }
  const match = /^(\d+)/.exec(version);
  if (match === null) {
    throw new Error(`versionToNumber: "${version}" has no numeric major component`);
  }
  return Number(match[1]);
}
