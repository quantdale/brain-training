/**
 * Streak actions tests (engagement-cosmetics wave): applying owned
 * Freeze/Shield/Recovery persists covered dates (so the reconstructed streak
 * reflects protection) and consumes the item; milestone reward claiming grants
 * XP + currency exactly once and never double-grants.
 */
import { describe, expect, it } from '@jest/globals';

import { AppDatabase , ProfileRepository } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  applyOwnedStreakItem,
  claimStreakMilestoneReward,
  effectiveCurrent,
  readCoveredDates,
  readInventory,
  reconstructStreak,
  STREAK_MILESTONES,
} from '@/streaks';
import type { StreakItemKind } from '@/streaks';

const T0 = 1_700_000_000_000;
const NOW = new Date(2026, 7, 16, 12, 0, 0); // local 2026-08-16
const TODAY = '2026-08-16';

async function makeDb(settings: Record<string, unknown> = {}): Promise<AppDatabase> {
  const real = await createMigratedDb();
  await new ProfileRepository(real, () => T0).ensureExists();
  const db = new AppDatabase(real, { now: () => T0 });
  if (Object.keys(settings).length > 0) {
    await db.profile.update({ settings });
  }
  return db;
}

describe('applyOwnedStreakItem — freeze', () => {
  it('covers today, consumes a freeze, and persists a covered date', async () => {
    const db = await makeDb({ streaks: { freeze: 1, shield: 0, recovery: 0 } });
    const state = reconstructStreak(['2026-08-15'], TODAY); // at risk
    const result = await applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW);
    expect(result).toBe('applied');

    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings).freeze).toBe(0);
    const covered = readCoveredDates(settings);
    expect(covered).toContain(TODAY);

    // The reconstructed streak (with covered dates) is now alive at today.
    const restored = reconstructStreak(['2026-08-15'], TODAY, covered);
    expect(effectiveCurrent(restored, TODAY)).toBeGreaterThan(0);
    expect(restored.lastActiveDate).toBe(TODAY);
  });

  it('refuses when no freeze is owned', async () => {
    const db = await makeDb({ streaks: { freeze: 0, shield: 0, recovery: 0 } });
    const state = reconstructStreak(['2026-08-15'], TODAY);
    expect(await applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW)).toBe('no-item');
  });
});

describe('applyOwnedStreakItem — recovery', () => {
  it('restores a broken streak by persisting the missed days as covered', async () => {
    const db = await makeDb({ streaks: { freeze: 0, shield: 0, recovery: 1 } });
    // 10-day run ending 2026-08-13; today is 2026-08-16 → 2 missed days.
    const broken = reconstructStreak(
      [
        '2026-08-13',
        '2026-08-12',
        '2026-08-11',
        '2026-08-10',
        '2026-08-09',
        '2026-08-08',
        '2026-08-07',
        '2026-08-06',
        '2026-08-05',
        '2026-08-04',
      ],
      TODAY,
    );
    const result = await applyOwnedStreakItem(db, 'recovery' as StreakItemKind, broken, NOW);
    expect(result).toBe('applied');

    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings).recovery).toBe(0);
    const covered = readCoveredDates(settings);
    expect(covered).toContain('2026-08-14');
    expect(covered).toContain('2026-08-16');

    const restored = reconstructStreak(
      [
        '2026-08-13',
        '2026-08-12',
        '2026-08-11',
        '2026-08-10',
        '2026-08-09',
        '2026-08-08',
        '2026-08-07',
        '2026-08-06',
        '2026-08-05',
        '2026-08-04',
      ],
      TODAY,
      covered,
    );
    expect(effectiveCurrent(restored, TODAY)).toBeGreaterThan(0);
  });

  it('refuses recovery when the gap exceeds the restore cap', async () => {
    const db = await makeDb({ streaks: { freeze: 0, shield: 0, recovery: 1 } });
    // Last active 2026-08-10; today 2026-08-16 → 5 missed days (cap is 3).
    const broken = reconstructStreak(['2026-08-10', '2026-08-09'], TODAY);
    expect(await applyOwnedStreakItem(db, 'recovery' as StreakItemKind, broken, NOW)).toBe(
      'not-allowed',
    );
  });
});

describe('claimStreakMilestoneReward', () => {
  const milestone = STREAK_MILESTONES[0]; // mil-3: 3 days, +30 XP / +15 coins

  it('grants the reward exactly once for a reached milestone', async () => {
    const db = await makeDb();
    const first = await claimStreakMilestoneReward(db, milestone, 5, NOW);
    expect(first).toBe('claimed');
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(milestone.rewardXp ?? 0);
    expect(await db.ledger.getBalance()).toBe(milestone.rewardCurrency ?? 0);

    const second = await claimStreakMilestoneReward(db, milestone, 5, NOW);
    expect(second).toBe('already-claimed');
    // No double grant.
    expect(await db.xpAwards.getTotalAwardedXp()).toBe(milestone.rewardXp ?? 0);
    expect(await db.ledger.getBalance()).toBe(milestone.rewardCurrency ?? 0);
  });

  it('refuses when the milestone is not yet reached', async () => {
    const db = await makeDb();
    expect(await claimStreakMilestoneReward(db, milestone, 1, NOW)).toBe('not-reached');
    expect(await db.ledger.getBalance()).toBe(0);
  });
});
