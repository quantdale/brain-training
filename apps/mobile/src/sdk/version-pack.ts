/**
 * Version packing for the integer version columns (Change 074 §5).
 *
 * The db records versions as `INTEGER NOT NULL` (`game_sessions.game_version`,
 * `generator_version`, `scoring_version`), because sorting and range queries
 * need a number. This module is the ONE definition of how a semantic version
 * string becomes that number.
 *
 * WHY IT IS SHARED
 * -----------------
 * There were 42 per-game copies of this function, in three slightly different
 * bodies, and 29 of their doc comments described an algorithm they did not
 * implement. That is not a duplication nit: a reader who trusted the comment
 * ("the numeric major component") would reason about the persisted value
 * wrongly, and a change applied to one copy and not the other would produce
 * two different encodings in one table. The per-game `versionToNumber` exports
 * now delegate here, so the games' public surface is unchanged while the
 * definition exists once.
 *
 * WHY `null` IS ACCEPTED
 * ----------------------
 * `GameDefinition.generatorVersion` is `string | null` and is documented as
 * `null` "for non-procedural games (curated packs, validated templates)". The
 * previous implementations all THREW on `null`, so adding the first genuinely
 * non-procedural game would have crashed in the session-persist path. Every
 * game shipped today is procedural, so the bug was latent, not live — which is
 * exactly the kind that a version bump and a new game mode turns into a crash
 * nobody traces back here. The db column is `NOT NULL`, so an absent version
 * maps to a documented sentinel rather than to an error.
 *
 * WHAT IS NOT COMPROMISED
 * -----------------------
 * The full string versions always travel with the raw result and the diagnostic
 * metadata (constitution §21), so packing is a sortable index, not the record
 * of record. Changing the packing could NOT reinterpret an existing row's
 * provenance, because the strings are stored alongside it.
 */

import type { GameDefinition } from './types/game-definition';

/**
 * The packed value used when a version is absent (`null`/`undefined`), i.e. a
 * non-procedural game with no generator to version.
 *
 * `0` is chosen because it is below every real packed version (the minimum
 * meaningful version `0.0.1` packs to 1) and therefore sorts FIRST, which is the
 * right order for "no version": a query for the oldest sessions finds
 * non-procedural ones before any procedural game.
 */
export const ABSENT_VERSION_NUMBER = 0;

/** Multipliers, named so the packing is readable at the call sites. */
const MAJOR = 1_000_000;
const MINOR = 1_000;
const PATCH = 1;

/**
 * Pack `major.minor.patch` into a single sortable integer.
 *
 * `minor` and `patch` are each clamped to 0–999 so the packing stays
 * order-preserving: `1.2.3` < `1.10.0` < `2.0.0`, which is what makes a numeric
 * comparison on the column meaningful. A component above the range is clamped
 * rather than allowed to overflow into the next component's place, because an
 * overflow would silently reorder versions.
 *
 * An absent version (`null`/`undefined`) packs to {@link ABSENT_VERSION_NUMBER}.
 * A malformed string is a programming error and throws, naming the input: a
 * silently-defaulted version would make a version bump look like no change at
 * all, which defeats the reason the column exists.
 */
export function packVersion(version: GameDefinition['generatorVersion'] | string | undefined): number {
  if (version === null || version === undefined || version === '') {
    return ABSENT_VERSION_NUMBER;
  }
  // Anchored, and deliberately strict about the PARTS while allowing a
  // semver prerelease/build suffix. Campaign 011 finding #4 is the reason the
  // suffix is allowed at all: `Number('0-beta')` is NaN, so `1.0.0-beta` used
  // to pack to NaN and be written straight into a `NOT NULL INTEGER` column.
  //
  // What is still rejected is a non-numeric PART (`1.2.x`): that would pack to
  // something indistinguishable from a real version, which is a different
  // failure from a suffix and must not be silently absorbed.
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec(version);
  if (match === null) {
    throw new Error(
      `packVersion: "${version}" is not a version of the form major[.minor[.patch]]` +
        `[-prerelease]. Each numeric part must be digits; a ` +
        `partially-parseable value would pack to a number indistinguishable ` +
        `from another version, and an unparseable one would corrupt a ` +
        `NOT NULL INTEGER column.`,
    );
  }
  const major = Number(match[1]);
  const minor = Number(match[2] ?? 0);
  const patch = Number(match[3] ?? 0);
  return (
    Math.min(major, 999) * MAJOR + Math.min(minor, 999) * MINOR + Math.min(patch, 999) * PATCH
  );
}

/**
 * Unpack a value produced by {@link packVersion}, for diagnostics and tests.
 * Round-trips every version in range; returns `null` for the absent sentinel.
 */
export function unpackVersion(value: number): string | null {
  if (value === ABSENT_VERSION_NUMBER) return null;
  const major = Math.floor(value / MAJOR);
  const minor = Math.floor((value % MAJOR) / MINOR);
  const patch = value % MINOR;
  return `${major}.${minor}.${patch}`;
}
