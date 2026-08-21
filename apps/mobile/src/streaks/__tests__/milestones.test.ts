/**
 * Streak milestone hardening (campaign 009 W08): milestone correctness over
 * large histories and exactly-once reward claiming with a stable ledger
 * `operationId` (`milestone:<id>`).
 */
import { describe, expect, it } from '@jest/globals';

import { AppDatabase, ProfileRepository } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  STREAK_MILESTONES,
  claimStreakMilestoneReward,
  markMilestoneClaimed,
  milestoneProgress,
  readClaimedMilestones,
  reachedMilestones,
  reconstructStreak,
} from '@/streaks';

const T0 = 1_700_000_000_000;
const NOW = new Date(2026, 7, 16, 12, 0, 0); // local 2026-08-16
const TODAY = '2026-08-16';

async function makeDb(): Promise<AppDatabase> {
  const real = await createMigratedDb();
  await new ProfileRepository(real, () => T0).ensureExists();
  return new AppDatabase(real, { now: () => T0 });
}

/** `count` consecutive local dates ending at `end` (inclusive). */
function consecutiveDays(end: string, count: number): string[] {
  const dates: string[] = [];
  let cursor = end;
  while (dates.length < count) {
    dates.push(cursor);
    const d = new Date(`${cursor}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return dates;
}

describe('milestone correctness', () => {
  it('a 365-day history reaches every milestone including mil-365', () => {
    const days = consecutiveDays(TODAY, 365);
    const state = reconstructStreak(days, TODAY);
    expect(state.longest).toBe(365);

    const reached = reachedMilestones(state.longest);
    expect(reached).toEqual(STREAK_MILESTONES.map((m) => m.id)); // all of them, in order

    const progress = milestoneProgress(state);
    expect(progress.every((p) => p.reached && p.remaining === 0)).toBe(true);
  });

  it('milestone progress reports exact remaining days below the threshold', () => {
    const state = reconstructStreak(consecutiveDays(TODAY, 5), TODAY);
    const progress = new Map(
      milestoneProgress(state).map((p) => [p.milestone.id, p]),
    );
    expect(progress.get('mil-3')?.reached).toBe(true);
    expect(progress.get('mil-7')?.remaining).toBe(2);
    expect(progress.get('mil-30')?.remaining).toBe(25);
    expect(progress.get('mil-365')?.reached).toBe(false);
  });

  it('milestones key off the BEST streak: a broken run keeps them reached', () => {
    // Long 40-day run in the past, broken since; current display is 0.
    const past = consecutiveDays('2026-06-30', 40);
    const state = reconstructStreak(past, TODAY);
    expect(state.longest).toBe(40);
    expect(reachedMilestones(state.longest)).toContain('mil-30');
  });
});

describe('claimStreakMilestoneReward — exactly once', () => {
  it('grants once, stamps the ledger operationId, and never double-grants', async () => {
    const db = await makeDb();
    const milestone = STREAK_MILESTONES.find((m) => m.id === 'mil-30')!;

    expect(await claimStreakMilestoneReward(db, milestone, 30, NOW)).toBe('claimed');
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(milestone.rewardXp ?? 0);
    expect(await db.ledger.getBalance()).toBe(milestone.rewardCurrency ?? 0);

    // The ledger entry carries the stable idempotency key.
    const entry = await db.ledger.getByOperation(`milestone:${milestone.id}`);
    expect(entry).not.toBeNull();
    expect(entry?.amount).toBe(milestone.rewardCurrency ?? 0);

    // Retry (double tap / relaunch): reported, nothing re-granted.
    expect(await claimStreakMilestoneReward(db, milestone, 30, NOW)).toBe('already-claimed');
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(milestone.rewardXp ?? 0);
    expect(await db.ledger.getBalance()).toBe(milestone.rewardCurrency ?? 0);
    expect((await db.ledger.list()).filter((e) => e.reason === 'streak-milestone')).toHaveLength(1);
  });

  it('claiming two different milestones grants each exactly once', async () => {
    const db = await makeDb();
    const mil3 = STREAK_MILESTONES.find((m) => m.id === 'mil-3')!;
    const mil7 = STREAK_MILESTONES.find((m) => m.id === 'mil-7')!;
    expect(await claimStreakMilestoneReward(db, mil3, 7, NOW)).toBe('claimed');
    expect(await claimStreakMilestoneReward(db, mil7, 7, NOW)).toBe('claimed');
    expect(await db.xpAwards.getTotalAwardedXp()).toBe((mil3.rewardXp ?? 0) + (mil7.rewardXp ?? 0));
    expect(await db.ledger.getBalance()).toBe((mil3.rewardCurrency ?? 0) + (mil7.rewardCurrency ?? 0));
  });
});

describe('claimed-milestones settings bookkeeping', () => {
  it('markMilestoneClaimed is idempotent and preserves unrelated settings', () => {
    const settings = { theme: 'dark', streaks: { freeze: 2 } };
    const once = markMilestoneClaimed(settings, 'mil-3');
    const twice = markMilestoneClaimed(once, 'mil-3');

    expect(readClaimedMilestones(twice)).toEqual(['mil-3']);
    expect(twice.theme).toBe('dark');
    expect(readInventoryFreeze(twice)).toBe(2);
    // Input never mutated.
    expect(settings.streaks).toEqual({ freeze: 2 });
  });

  it('tolerates garbage claimed lists', () => {
    expect(readClaimedMilestones({ streaks: { claimedMilestones: 'nope' } })).toEqual([]);
    expect(
      readClaimedMilestones({ streaks: { claimedMilestones: ['mil-3', 42, null, 'mil-7'] } }),
    ).toEqual(['mil-3', 'mil-7']);
  });
});

function readInventoryFreeze(settings: Record<string, unknown>): unknown {
  const block = settings.streaks as Record<string, unknown> | undefined;
  return block ? block.freeze : undefined;
}
