/**
 * Content-pack registry — statically enumerates the bundled content packs
 * (constitution §24).
 *
 * The registry is fed by the game modules that ship packs: today the language
 * game (`language-word-match`) bundles a curated, versioned pack at
 * `games/language-word-match/content/pack.json`. Its own validator
 * (`content-validation.ts` → `loadContentPack`) performs the full mechanical
 * pack check (ids, semver, itemCount vs items.length, confusability), so the
 * registry reuses it rather than duplicating validation. Future packs extend
 * `BUNDLED_PACK_SOURCES` with one line each — no API churn.
 *
 * Size heuristic (documented, deterministic): `sizeEstimateBytes` is the sum,
 * over all pack items, of the UTF-8 byte length of `JSON.stringify(item)`.
 * Item serialization key order is fixed by the pack validators (they build
 * items in a constant field order), and UTF-8 length is computed with pure
 * arithmetic (no `TextEncoder`), so the estimate is identical across runs and
 * JS engines. The estimate covers the items payload only — the envelope
 * (`packId`/`packVersion`/families) is small and constant by comparison; the
 * seam's purpose is relative storage accounting, not byte-exact on-disk size.
 */
import { loadContentPack } from '@/games/language-word-match/content-validation';
import { loadContentPack as loadContextFitPack } from '@/games/language-context-fit/content-validation';
import type { ContentPack } from '@/games/language-word-match/content-validation';

import type { PackInfo, StorageSummary } from './types';

/** A bundled pack source: the game module that ships + validates the pack. */
export interface BundledPackSource {
  /** Stable game id of the module shipping the pack. */
  readonly sourceGameId: string;
  /** Loads and validates the pack; throws on a broken pack (fail-fast). */
  readonly load: () => ContentPack;
}

/** Static enumeration of known bundled packs. Extend here for future packs. */
const BUNDLED_PACK_SOURCES: readonly BundledPackSource[] = [
  { sourceGameId: 'language-word-match', load: loadContentPack },
  { sourceGameId: 'language-context-fit', load: loadContextFitPack as unknown as () => ContentPack },
];

/**
 * Pure UTF-8 byte length of a string. Handles surrogate pairs; equivalent to
 * `TextEncoder().encode(value).byteLength` but engine-independent.
 */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate: must pair with a low surrogate (else it is lone, which
      // JSON.stringify escapes, but we still count the pair conservatively).
      const next = i + 1 < value.length ? value.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * Deterministic byte-size estimate of a pack's items payload (see module doc
 * for the documented heuristic). Exported so future on-disk pack readers can
 * reuse the same accounting for downloaded packs.
 */
export function estimatePackSizeBytes(items: readonly unknown[]): number {
  return (items as readonly object[]).reduce((total: number, item) => total + utf8ByteLength(JSON.stringify(item)), 0);
}

/**
 * All bundled packs, deterministically ordered by stable `packId` (NOT by
 * registration order, so adding a source line can never reshuffle existing
 * entries). Each entry is validated (via the source validator) and frozen;
 * throws on the first broken pack so an invalid bundled pack fails fast
 * instead of silently producing a wrong registry.
 *
 * The optional `sources` parameter exists for tests/hardening drills: it lets
 * callers exercise the registry's defensive checks (bad ids/versions,
 * duplicate pack ids) without shipping a broken pack.
 */
export function getBundledPacks(
  sources: readonly BundledPackSource[] = BUNDLED_PACK_SOURCES,
): PackInfo[] {
  const seen = new Map<string, string>(); // packId -> first sourceGameId
  const infos = sources.map((source): PackInfo => {
    const pack = source.load();

    // Defensive required-field + format checks. The game validators already
    // enforce the full contract; this keeps the registry self-contained if a
    // future source ships its own (weaker) validator.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(pack.packId)) {
      throw new Error(
        `ContentPack registry: pack from "${source.sourceGameId}" has invalid packId "${pack.packId}" (must be non-empty kebab-case)`,
      );
    }
    if (!/^\d+\.\d+\.\d+$/.test(pack.packVersion)) {
      throw new Error(
        `ContentPack registry: pack "${pack.packId}" has invalid packVersion "${pack.packVersion}" (must be a semantic version like "1.0.0")`,
      );
    }
    if (!Number.isInteger(pack.itemCount) || pack.itemCount !== pack.items.length) {
      throw new Error(
        `ContentPack registry: pack "${pack.packId}" itemCount ${pack.itemCount} does not match items.length ${pack.items.length}`,
      );
    }

    const firstOwner = seen.get(pack.packId);
    if (firstOwner !== undefined) {
      throw new Error(
        `ContentPack registry: duplicate packId "${pack.packId}" shipped by both "${firstOwner}" and "${source.sourceGameId}"`,
      );
    }
    seen.set(pack.packId, source.sourceGameId);

    return Object.freeze({
      packId: pack.packId,
      packVersion: pack.packVersion,
      itemCount: pack.itemCount,
      sizeEstimateBytes: estimatePackSizeBytes(pack.items),
      sourceGameId: source.sourceGameId,
      source: 'bundled' as const,
    });
  });

  return infos.sort((a, b) => (a.packId < b.packId ? -1 : a.packId > b.packId ? 1 : 0));
}

/** Look up a pack by stable pack id; `null` when unknown. Accepts injected sources for tests/hardening drills (see `getBundledPacks`). */
export function getPack(
  packId: string,
  sources: readonly BundledPackSource[] = BUNDLED_PACK_SOURCES,
): PackInfo | null {
  return getBundledPacks(sources).find((pack) => pack.packId === packId) ?? null;
}

/** Aggregate storage view over all known packs (see `types.ts`). */
export function getStorageSummary(): StorageSummary {
  const packs = getBundledPacks();
  return Object.freeze({
    packs: Object.freeze(packs),
    totalItems: packs.reduce((sum, pack) => sum + pack.itemCount, 0),
    totalSizeEstimateBytes: packs.reduce((sum, pack) => sum + pack.sizeEstimateBytes, 0),
  });
}
