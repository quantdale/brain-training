/**
 * Engagement V2 pure-logic determinism tests (campaign 010 / W12). Covers the
 * new projection helpers only — chains, quest refresh/history, reward
 * history labels/merge, collection progress, provenance. No db access.
 */
import { describe, expect, it } from '@jest/globals';

import {
  ACHIEVEMENT_CHAINS,
  ACHIEVEMENT_DEFINITIONS_V1,
  resolveChainProgress,
} from '@/achievements';
import { nextRefreshAt, msUntilRefresh, summarizeQuestHistory } from '@/quests';
import type { QuestProgress } from '@/db';
import { COSMETIC_DEFINITIONS } from '@/cosmetics';
import { collectionProgress, cosmeticProvenance } from '@/cosmetics/collection';
import {
  describeLedgerReason,
  describeXpSource,
  mergeRewardHistory,
} from '../history';

describe('resolveChainProgress', () => {
  it('reports completed stages and the first incomplete stage mid-chain', () => {
    const chain = ACHIEVEMENT_CHAINS.find((c) => c.id === 'chain-sessions')!;
    const progress = resolveChainProgress(chain, ACHIEVEMENT_DEFINITIONS_V1, {
      sessionCount: 30,
      totalXp: 0,
    });
    expect(progress.completedStages).toBe(2); // ach-first (1), ach-25 (25)
    expect(progress.currentStage?.def.id).toBe('ach-100');
    expect(progress.nextRatio).toBeCloseTo(0.3);
    expect(progress.complete).toBe(false);
  });

  it('is complete with no current stage once every stage is met', () => {
    const chain = ACHIEVEMENT_CHAINS.find((c) => c.id === 'chain-sessions')!;
    const progress = resolveChainProgress(chain, ACHIEVEMENT_DEFINITIONS_V1, {
      sessionCount: 3000,
      totalXp: 0,
    });
    expect(progress.complete).toBe(true);
    expect(progress.currentStage).toBeNull();
    expect(progress.completedStages).toBe(progress.totalStages);
    // A typo'd stage id must fail loudly instead of rendering an empty chain.
    expect(() =>
      resolveChainProgress(
        { id: 't', title: 't', description: '', stageIds: ['ach-nope'] },
        ACHIEVEMENT_DEFINITIONS_V1,
        { sessionCount: 0, totalXp: 0 },
      ),
    ).toThrow(/unknown achievement "ach-nope"/);
  });
});

describe('quest refresh + history', () => {
  it('rolls daily at the next local midnight and weekly at the next Monday', () => {
    const friday = new Date(2026, 7, 21, 13, 22); // 2026-08-21 is a Friday
    expect(nextRefreshAt('daily', friday)).toEqual(new Date(2026, 7, 22, 0, 0, 0, 0));
    expect(nextRefreshAt('weekly', friday)).toEqual(new Date(2026, 7, 24, 0, 0, 0, 0));
    expect(nextRefreshAt('longterm', friday)).toBeNull();
    expect(msUntilRefresh('longterm', friday)).toBeNull();
    expect(msUntilRefresh('daily', friday)).toBe(
      new Date(2026, 7, 22).getTime() - friday.getTime(),
    );
  });

  it('summarizes completions and claims per quest across periods', () => {
    const rows: QuestProgress[] = [
      { questId: 'qd3', period: '2026-08-20', progress: 3, completedAt: 1, claimedAt: 2 },
      { questId: 'qd3', period: '2026-08-21', progress: 1, completedAt: null, claimedAt: null },
      { questId: 'qdx', period: '2026-08-20', progress: 100, completedAt: 5, claimedAt: null },
    ];
    const summaries = summarizeQuestHistory(rows);
    expect(summaries.get('qd3')).toEqual({
      questId: 'qd3',
      periodsPlayed: 2,
      completions: 1,
      claims: 1,
      lastCompletedPeriod: '2026-08-20',
      lastClaimedPeriod: '2026-08-20',
    });
    expect(summaries.get('qdx')?.claims).toBe(0);
    expect(summaries.get('qdx')?.lastClaimedPeriod).toBeNull();
  });
});

describe('reward history labels + merge', () => {
  it('maps known xp sources and ledger reasons to stable labels', () => {
    expect(describeXpSource('quest:qd3')).toEqual({ label: 'Quest reward', detail: 'qd3' });
    expect(describeXpSource('achievement:ach-first').label).toBe('Achievement reward');
    expect(describeLedgerReason('cosmetic')).toEqual({ label: 'Cosmetic purchase' });
    expect(describeLedgerReason('streak-item-freeze')).toEqual({
      label: 'Streak item',
      detail: 'freeze',
    });
    expect(describeLedgerReason('mystery').label).toBe('Coin update');
  });

  it('merges xp awards and ledger entries newest-first, deterministically', () => {
    const merged = mergeRewardHistory(
      [
        { id: 1, amount: 20, reason: 'quest', source: 'quest:qd3', createdAt: 1000 },
        { id: 2, amount: 5, reason: 'quest', source: 'quest:qd5', createdAt: 3000 },
      ],
      [{ id: 7, amount: -150, reason: 'cosmetic', sessionId: null, createdAt: 2000 }],
      10,
    );
    expect(merged.map((entry) => entry.id)).toEqual(['xp:2', 'coins:7', 'xp:1']);
    expect(merged[1]).toMatchObject({ coins: -150, label: 'Cosmetic purchase' });
  });
});

describe('collection progress + provenance', () => {
  const emptyProgression = {
    claimedAchievements: new Set<string>(),
    claimedQuests: new Set<string>(),
    longestStreak: 0,
  };

  it('counts only defaults as owned for a fresh player', () => {
    const summary = collectionProgress(COSMETIC_DEFINITIONS, emptyProgression, {});
    expect(summary.total).toBe(COSMETIC_DEFINITIONS.length);
    // Exactly one default per slot (avatarFrame/accent/celebration).
    expect(summary.ownedTotal).toBe(3);
    expect(summary.ratio).toBeCloseTo(3 / COSMETIC_DEFINITIONS.length);
  });

  it('derives purchase provenance from the ledger operationId evidence', () => {
    const def = COSMETIC_DEFINITIONS.find((d) => d.id === 'cos-accent-emerald')!;
    const ownedSettings = { cosmetics: { owned: ['cos-accent-emerald'] } };
    const provenance = cosmeticProvenance(def, emptyProgression, ownedSettings, {
      ledgerByOperation: new Map([['cosmetic:cos-accent-emerald', 1725000000000]]),
    });
    expect(provenance.owned).toBe(true);
    expect(provenance.source).toBe('purchase');
    expect(provenance.earnedAt).toBe(1725000000000);

    const locked = cosmeticProvenance(def, emptyProgression, {}, {});
    expect(locked.owned).toBe(false);
    expect(locked.earnedAt).toBeNull();
  });
});
