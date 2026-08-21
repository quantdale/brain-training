/**
 * Content-registry hardening tests (campaign 009 / W11): the registry's own
 * defensive gates, exercised via source injection so no broken pack ever has
 * to ship. Pins:
 *
 *   - duplicate packId across two sources is rejected (getPack must never be
 *     ambiguous);
 *   - non-kebab-case packId / non-semver packVersion are rejected even if a
 *     future source ships a weaker validator;
 *   - itemCount integrity stays enforced at the registry layer;
 *   - output ordering is deterministic by stable packId, independent of
 *     registration order;
 *   - multiple valid sources aggregate correctly (totals, lookups).
 */

import { describe, expect, it } from '@jest/globals';
import { loadContentPack, type ContentPack } from '@/games/language-word-match/content-validation';
import { getBundledPacks, getPack, getStorageSummary } from '../registry';
import type { BundledPackSource } from '../registry';

/** A second, distinct valid pack derived from the shipped one (same shape). */
function variantPack(packId: string, packVersion = '1.0.0'): ContentPack {
  const base = loadContentPack();
  return { ...base, packId, packVersion };
}

function source(gameId: string, pack: ContentPack): BundledPackSource {
  return { sourceGameId: gameId, load: () => pack };
}

describe('registry defensive gates (injected sources)', () => {
  it('rejects a duplicate packId shipped by two sources', () => {
    const sources = [
      source('game-a', variantPack('dup-pack')),
      source('game-b', variantPack('dup-pack')),
    ];
    expect(() => getBundledPacks(sources)).toThrow(/duplicate packId "dup-pack"/);
    expect(() => getBundledPacks(sources)).toThrow(/"game-a".*"game-b"/s);
  });

  it('rejects a non-kebab-case packId', () => {
    const sources = [source('game-a', variantPack('Bad Id'))];
    expect(() => getBundledPacks(sources)).toThrow(/invalid packId/);
    expect(() => getBundledPacks(sources)).toThrow(/kebab-case/);
  });

  it('rejects a non-semver packVersion', () => {
    const sources = [source('game-a', variantPack('ok-pack', '1.0'))];
    expect(() => getBundledPacks(sources)).toThrow(/invalid packVersion/);
    expect(() => getBundledPacks(sources)).toThrow(/semantic version/);
  });

  it('rejects an itemCount that disagrees with items.length', () => {
    const bad = { ...variantPack('count-pack'), itemCount: 999 };
    const sources = [source('game-a', bad)];
    expect(() => getBundledPacks(sources)).toThrow(/itemCount 999 does not match items.length/);
  });

  it('still accepts well-formed injected packs alongside the bundled one', () => {
    const sources = [
      source('language-word-match', loadContentPack()),
      source('game-b', variantPack('another-pack', '2.1.3')),
    ];
    const packs = getBundledPacks(sources);
    expect(packs.map((p) => p.packId)).toEqual(['another-pack', 'language-word-match-core-v1']);
    expect(packs.every((p) => Object.isFrozen(p))).toBe(true);
  });
});

describe('deterministic ordering by stable packId', () => {
  it('sorts by packId regardless of registration order', () => {
    const a = getBundledPacks([
      source('game-b', variantPack('bbb-pack')),
      source('game-a', variantPack('aaa-pack')),
    ]);
    const b = getBundledPacks([
      source('game-a', variantPack('aaa-pack')),
      source('game-b', variantPack('bbb-pack')),
    ]);
    expect(a.map((p) => p.packId)).toEqual(['aaa-pack', 'bbb-pack']);
    expect(b.map((p) => p.packId)).toEqual(['aaa-pack', 'bbb-pack']);
    expect(a).toEqual(b);
  });

  it('the real registry remains stable across calls', () => {
    expect(getBundledPacks()).toEqual(getBundledPacks());
  });
});

describe('multi-source aggregation', () => {
  it('aggregates per-pack lookups over several valid sources', () => {
    const sources = [
      source('game-b', variantPack('bbb-pack')),
      source('language-word-match', loadContentPack()),
      source('game-c', variantPack('aaa-pack')),
    ];
    const packs = getBundledPacks(sources);
    expect(packs).toHaveLength(3);

    const aaa = getPack('aaa-pack', sources);
    expect(aaa?.sourceGameId).toBe('game-c');
    expect(getPack('bbb-pack', sources)?.packVersion).toBe('1.0.0');
  });

  it('the shipped storage summary still reflects the default bundled registry', () => {
    const summary = getStorageSummary();
    const packs = getBundledPacks();
    expect(summary.packs).toHaveLength(packs.length);
    expect(summary.totalItems).toBe(packs.reduce((sum, p) => sum + p.itemCount, 0));
    expect(summary.totalSizeEstimateBytes).toBe(
      packs.reduce((sum, p) => sum + p.sizeEstimateBytes, 0),
    );
  });
});
