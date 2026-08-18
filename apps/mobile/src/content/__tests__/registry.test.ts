/**
 * Content-pack registry tests — correctness vs the real bundled pack.json.
 *
 * The reference (`loadContentPack`) is the language game's own validator
 * reading the actual `content/pack.json`, so these tests pin the registry to
 * the shipped pack without duplicating fixture data by hand.
 */

// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { loadContentPack } from '@/games/language-word-match/content-validation';

import { estimatePackSizeBytes, getBundledPacks, getPack, getStorageSummary } from '../registry';

/**
 * Independent implementation of the documented size heuristic (registry.ts:
 * UTF-8 byte length of `JSON.stringify(item)`, summed over items). Kept here
 * as a cross-check so a regression in the registry's accounting (missing
 * items, wrong encoding) fails the test rather than being self-consistent.
 */
function expectedPackBytes(items: readonly { id: string; prompt: string }[]): number {
  const utf8Length = (value: string): number => {
    let bytes = 0;
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code <= 0x7f) {
        bytes += 1;
      } else if (code <= 0x7ff) {
        bytes += 2;
      } else if (code >= 0xd800 && code <= 0xdbff) {
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
  };
  return items.reduce((total, item) => total + utf8Length(JSON.stringify(item)), 0);
}

describe('content-pack registry', () => {
  it('lists exactly the bundled language pack with the real pack.json identity', () => {
    const pack = loadContentPack();
    const packs = getBundledPacks();

    expect(packs).toHaveLength(1);
    const [info] = packs;
    expect(info.packId).toBe(pack.packId);
    expect(info.packVersion).toBe(pack.packVersion);
    expect(info.itemCount).toBe(pack.itemCount);
    expect(info.itemCount).toBe(120); // pinned to the shipped pack
    expect(info.sourceGameId).toBe('language-word-match');
    expect(info.source).toBe('bundled');
  });

  it('computes a deterministic, positive size estimate', () => {
    const first = getBundledPacks()[0];
    const second = getBundledPacks()[0];
    expect(first.sizeEstimateBytes).toBeGreaterThan(0);
    expect(second.sizeEstimateBytes).toBe(first.sizeEstimateBytes);
  });

  it('matches the documented heuristic (UTF-8 bytes of item JSON, summed)', () => {
    const pack = loadContentPack();
    const [info] = getBundledPacks();
    expect(info.sizeEstimateBytes).toBe(expectedPackBytes(pack.items));
    expect(estimatePackSizeBytes(pack.items)).toBe(info.sizeEstimateBytes);
  });

  it('returns null for unknown pack ids and the entry for known ones', () => {
    expect(getPack('does-not-exist')).toBeNull();
    expect(getPack('')).toBeNull();

    const [info] = getBundledPacks();
    const known = getPack(info.packId);
    expect(known).not.toBeNull();
    expect(known?.packId).toBe(info.packId);
    expect(known?.sizeEstimateBytes).toBe(info.sizeEstimateBytes);
  });

  it('aggregates storage summary math over all packs', () => {
    const summary = getStorageSummary();
    const packs = getBundledPacks();

    expect(summary.packs).toHaveLength(packs.length);
    expect(summary.totalItems).toBe(packs.reduce((sum, p) => sum + p.itemCount, 0));
    expect(summary.totalSizeEstimateBytes).toBe(
      packs.reduce((sum, p) => sum + p.sizeEstimateBytes, 0),
    );
    // Single-pack invariant today: totals equal the bundled pack's own values.
    expect(summary.totalItems).toBe(getBundledPacks()[0].itemCount);
    expect(summary.totalSizeEstimateBytes).toBe(getBundledPacks()[0].sizeEstimateBytes);
  });
});
