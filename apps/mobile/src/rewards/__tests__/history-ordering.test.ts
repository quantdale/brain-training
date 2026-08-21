/**
 * Reward-history (provenance feed) hardening (campaign 011 / W13).
 *
 * Attacks the merged XP+ledger projection where the packet matrix is sharpest:
 * EQUAL timestamps. The feed must be newest-first and TOTAL-order stable —
 * same inputs, byte-identical output, on every call — with a deterministic
 * tie-break, correct truncation under `limit`, and honest labels for every
 * engagement source. Also exercised against a REAL db where xp awards and
 * ledger entries are written interleaved under one advancing injected clock.
 */
import { describe, expect, it } from '@jest/globals';

import { AppDatabase, ProfileRepository } from '@/db';
import type { LedgerEntry, XpAward } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { loadRewardHistory, mergeRewardHistory } from '../history';

const award = (id: number, createdAt: number, source = 'quest:qd3', amount = 20): XpAward => ({
  id,
  amount,
  reason: 'quest',
  source,
  createdAt,
});

const entry = (
  id: number,
  createdAt: number,
  reason = 'quest',
  amount = 5,
): LedgerEntry => ({ id, amount, reason, sessionId: null, createdAt });

describe('mergeRewardHistory — equal-timestamp determinism', () => {
  it('is a total order: identical inputs → identical output across repeated calls', () => {
    const xpAwards = [
      award(1, 1000),
      award(2, 3000),
      award(6, 1000), // ties with id 1 AND crosses streams with coins:9
    ];
    const ledgerEntries = [
      entry(7, 2000),
      entry(9, 1000), // same instant as two xp awards
      entry(4, 1000),
    ];

    const first = mergeRewardHistory(xpAwards, ledgerEntries, 10);
    for (let i = 0; i < 25; i += 1) {
      expect(mergeRewardHistory(xpAwards, ledgerEntries, 10)).toEqual(first);
    }

    // Newest-first across distinct timestamps (six events: 3 xp + 3 coins).
    expect(first.map((e) => e.at)).toEqual([3000, 2000, 1000, 1000, 1000, 1000]);
    // Tie-break pinned: within equal timestamps, ids sort DESCENDING as strings.
    const tieGroup = first.filter((e) => e.at === 1000).map((e) => e.id);
    expect(tieGroup).toEqual([...tieGroup].sort((a, b) => b.localeCompare(a)));
    // And concretely (regression pin): xp rows outrank lexicographically-lower ids.
    expect(tieGroup).toEqual(['xp:6', 'xp:1', 'coins:9', 'coins:4']);

    // Inputs never mutated.
    expect(xpAwards).toHaveLength(3);
    expect(ledgerEntries).toHaveLength(3);
  });

  it('truncates to the NEWEST `limit` entries after merging both streams', () => {
    const xpAwards = [award(1, 1000), award(2, 5000)];
    const ledgerEntries = [entry(3, 3000), entry(4, 4000), entry(5, 2000)];
    const limited = mergeRewardHistory(xpAwards, ledgerEntries, 3);
    // Newest three by timestamp regardless of stream.
    expect(limited.map((e) => e.id)).toEqual(['xp:2', 'coins:4', 'coins:3']);
    expect(limited).toHaveLength(3);
  });

  it('limit 0 yields an empty feed without throwing', () => {
    expect(mergeRewardHistory([award(1, 1)], [entry(1, 1)], 0)).toEqual([]);
  });
});

describe('loadRewardHistory — real db, interleaved writes', () => {
  it('stays stable across loads at one frozen clock and orders newest-first as it advances', async () => {
    let now = 1_700_000_000_000;
    const adapter = await createMigratedDb();
    await new ProfileRepository(adapter, () => now).ensureExists();
    const db = new AppDatabase(adapter, { now: () => now });

    // Interleave XP + coin grants at three successive ticks.
    await db.xpAwards.award(20, 'quest', 'quest:qd3'); // t0
    await db.ledger.append({ amount: 5, reason: 'quest' }); // t0
    now += 1_000;
    await db.achievements.upsertDefinition({
      id: 'ach-first',
      title: 't',
      description: 'd',
      criteria: {},
      rewardXp: 50,
      rewardCurrency: 25,
      version: 1,
    });
    await db.achievements.unlock('ach-first');
    await db.xpAwards.award(50, 'achievement', 'achievement:ach-first'); // t1
    await db.ledger.append({ amount: 25, reason: 'achievement', operationId: 'achievement:ach-first' }); // t1
    now += 1_000;
    await db.ledger.append({ amount: -150, reason: 'cosmetic', operationId: 'cosmetic:x' }); // t2 spend

    const atT2 = await loadRewardHistory(db, 20);
    expect(atT2[0]).toMatchObject({ coins: -150, label: 'Cosmetic purchase' });

    // Frozen-clock stability: reloading produces the identical feed.
    expect(await loadRewardHistory(db, 20)).toEqual(atT2);
    // Newest-first overall.
    const times = atT2.map((e) => e.at);
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    // Labels resolve for every engagement source kind present.
    expect(atT2.some((e) => e.label === 'Achievement reward' && e.xp === 50)).toBe(true);
    expect(atT2.some((e) => e.label === 'Quest reward')).toBe(true);

    // Limit truncation keeps only the most recent slice.
    const limited = await loadRewardHistory(db, 3);
    expect(limited).toHaveLength(3);
    expect(limited[0].id).toBe(atT2[0].id);
  });
});
