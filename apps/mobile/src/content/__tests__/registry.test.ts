/**
 * Content-pack registry tests — correctness vs the real bundled pack.json.
 *
 * The reference (`loadContentPack`) is the language game's own validator
 * reading the actual `content/pack.json`, so these tests pin the registry to
 * the shipped pack without duplicating fixture data by hand.
 */

import { describe, expect, it } from '@jest/globals';

import { loadContentPack } from '@/games/language-word-match/content-validation';
import { loadContentPack as loadContextFitPack } from '@/games/language-context-fit/content-validation';

import { estimatePackSizeBytes, getBundledPacks, getPack, getStorageSummary } from '../registry';

/**
 * Independent implementation of the documented size heuristic (registry.ts:
 * UTF-8 byte length of `JSON.stringify(item)`, summed over items). Kept here
 * as a cross-check so a regression in the registry's accounting (missing
 * items, wrong encoding) fails the test rather than being self-consistent.
 */
function expectedPackBytes(items: readonly unknown[]): number {
  // @ts-ignore
  const utf8Length = (value: string): number => {
    let bytes = 0;
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code <= 0x007f) bytes += 1;
      else if (code <= 0x07ff) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff) {
        bytes += 4;
        i += 1;
      } else bytes += 3;
    }
    return bytes;
  };
  return (items as readonly object[]).reduce((total: number, item) => total + utf8Length(JSON.stringify(item)), 0);
}

describe('content-pack registry', () => {
  it('lists exactly the bundled language packs with the real pack.json identities', () => {
    const wordMatchPack = loadContentPack();
    const contextFitPack = loadContextFitPack();
    const packs = getBundledPacks();

    expect(packs).toHaveLength(2);
    const byId = new Map(packs.map((p) => [p.packId, p]));
    const wm = byId.get(wordMatchPack.packId)!;
    expect(wm.packVersion).toBe(wordMatchPack.packVersion);
    expect(wm.itemCount).toBe(wordMatchPack.itemCount);
    expect(wm.itemCount).toBe(120);
    expect(wm.sourceGameId).toBe('language-word-match');
    expect(wm.source).toBe('bundled');

    const cf = byId.get(contextFitPack.packId)!;
    expect(cf.packVersion).toBe(contextFitPack.packVersion);
    expect(cf.itemCount).toBe(contextFitPack.itemCount);
    expect(cf.itemCount).toBe(180);
    expect(cf.sourceGameId).toBe('language-context-fit');
    expect(cf.source).toBe('bundled');
    // deterministic ordering by packId
    expect(packs[0].packId < packs[1].packId).toBe(true);
  });

  it('computes a deterministic, positive size estimate', () => {
    const first = getBundledPacks()[0];
    const second = getBundledPacks()[0];
    expect(first.sizeEstimateBytes).toBeGreaterThan(0);
    expect(second.sizeEstimateBytes).toBe(first.sizeEstimateBytes);
    for (const p of getBundledPacks()) {
      expect(p.sizeEstimateBytes).toBeGreaterThan(0);
    }
  });

  it('matches the documented heuristic (UTF-8 bytes of item JSON, summed)', () => {
    const wmPack = loadContentPack();
    const cfPack = loadContextFitPack();
    const packs = getBundledPacks();
    const byId = new Map(packs.map((p) => [p.packId, p]));
    expect(byId.get(wmPack.packId)!.sizeEstimateBytes).toBe(expectedPackBytes(wmPack.items as unknown as readonly unknown[]));
    expect(byId.get(cfPack.packId)!.sizeEstimateBytes).toBe(expectedPackBytes(cfPack.items as unknown as readonly unknown[]));
    expect(estimatePackSizeBytes(wmPack.items as unknown as readonly unknown[])).toBe(byId.get(wmPack.packId)!.sizeEstimateBytes);
  });

  it('returns null for unknown pack ids and the entry for known ones', () => {
    expect(getPack('does-not-exist')).toBeNull();
    expect(getPack('')).toBeNull();

    for (const info of getBundledPacks()) {
      const known = getPack(info.packId);
      expect(known).not.toBeNull();
      expect(known?.packId).toBe(info.packId);
      expect(known?.sizeEstimateBytes).toBe(info.sizeEstimateBytes);
    }
  });

  it('aggregates storage summary math over all packs', () => {
    const summary = getStorageSummary();
    const packs = getBundledPacks();

    expect(summary.packs).toHaveLength(packs.length);
    expect(summary.totalItems).toBe(packs.reduce((sum, p) => sum + p.itemCount, 0));
    expect(summary.totalSizeEstimateBytes).toBe(
      packs.reduce((sum, p) => sum + p.sizeEstimateBytes, 0),
    );
    expect(summary.totalItems).toBe(120 + 180);
  });
});
