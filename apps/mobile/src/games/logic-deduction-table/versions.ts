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

/** Scoring/normalization version — bump when `normalizeLogicDeductionResult` changes. */
export const SCORING_VERSION = "1.1.0";

/** Stable game id (re-exported for convenience). */
export const GAME_ID_CONST = GAME_ID;

/**
 * Map a semantic version string to the integer recorded in the db
 * (`game_sessions.game_version` etc.): `major*1e6 + minor*1e3 + patch`.
 * `null` maps to `0`.
 */
export function versionToNumber(version: string | null): number {
 if (version === null) {
  return 0;
 }
 const parts = (version ?? "").split(".");
 const ma = Number(parts[0] ?? 0);
 const mi = Number(parts[1] ?? 0);
 const pa = Number(parts[2] ?? 0);
 return ma * 1_000_000 + mi * 1_000 + pa;
}
