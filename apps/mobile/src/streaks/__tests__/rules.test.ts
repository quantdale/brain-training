import { describe, expect, it } from '@jest/globals';
import { reconstructStreak } from '../reconstruct';
import {
  applyFreeze,
  applyRecovery,
  canApplyFreeze,
  canPurchase,
  FREEZE_COST_COINS,
  FREEZE_MAX_PER_PERIOD,
  freezeUsedThisPeriod,
  ITEM_COSTS,
  RECOVERY_COST_COINS,
  RECOVERY_MAX_STREAK_RESTORE_DAYS,
  recordFreezeUse,
  readFreezeUsage,
  SHIELD_COST_COINS,
  streakPeriodKey,
} from '../rules';

const TODAY = '2026-08-16';
const AUGUST_2026 = new Date(2026, 7, 16, 12); // local clock date (repo convention)

function atRiskState(): ReturnType<typeof reconstructStreak> {
  return reconstructStreak(['2026-08-15'], TODAY); // last active yesterday
}

describe('cost and limit constants', () => {
  it('exposes the documented config constants', () => {
    expect(FREEZE_COST_COINS).toBe(100);
    expect(SHIELD_COST_COINS).toBe(150);
    expect(RECOVERY_COST_COINS).toBe(200);
    expect(ITEM_COSTS).toEqual({ freeze: 100, shield: 150, recovery: 200 });
    expect(FREEZE_MAX_PER_PERIOD).toBe(3);
    expect(RECOVERY_MAX_STREAK_RESTORE_DAYS).toBe(3);
  });
});

describe('streakPeriodKey', () => {
  it('keys the local calendar month as YYYY-MM, zero-padded', () => {
    expect(streakPeriodKey(new Date(2026, 7, 16, 23, 59, 59))).toBe('2026-08');
    expect(streakPeriodKey(new Date(2026, 0, 5))).toBe('2026-01');
    expect(streakPeriodKey(new Date(2026, 11, 31))).toBe('2026-12');
    expect(streakPeriodKey(new Date(2025, 11, 31))).toBe('2025-12');
    expect(streakPeriodKey(new Date(2026, 0, 1))).toBe('2026-01');
  });
});

describe('freeze usage bookkeeping', () => {
  it('readFreezeUsage tolerates missing or garbage blocks', () => {
    expect(readFreezeUsage({})).toEqual({ period: '', count: 0 });
    expect(readFreezeUsage({ streaks: { freeze: 1 } })).toEqual({ period: '', count: 0 });
    expect(readFreezeUsage({ streaks: { freezeUsed: 'x' } })).toEqual({ period: '', count: 0 });
    expect(readFreezeUsage({ streaks: { freezeUsed: { period: '2026-08', count: -1 } } })).toEqual({
      period: '2026-08',
      count: 0,
    });
    expect(readFreezeUsage({ streaks: { freezeUsed: { period: 7, count: '2' } } })).toEqual({
      period: '',
      count: 0,
    });
  });

  it('freezeUsedThisPeriod counts only the current month', () => {
    const settings = { streaks: { freezeUsed: { period: '2026-07', count: 3 } } };
    expect(freezeUsedThisPeriod(settings, AUGUST_2026)).toBe(0);
    const august = { streaks: { freezeUsed: { period: '2026-08', count: 2 } } };
    expect(freezeUsedThisPeriod(august, AUGUST_2026)).toBe(2);
  });

  it('recordFreezeUse increments within the month and resets across months', () => {
    const settings = { theme: 'dark', streaks: { freeze: 1, shield: 0, recovery: 0 } };
    const first = recordFreezeUse(settings, AUGUST_2026);
    expect(first.theme).toBe('dark');
    const firstStreaks = first.streaks as Record<string, unknown>;
    expect(firstStreaks.freezeUsed).toEqual({ period: '2026-08', count: 1 });
    expect(firstStreaks.freeze).toBe(1); // item counts untouched

    const second = recordFreezeUse(first, new Date(2026, 7, 31, 12));
    expect((second.streaks as Record<string, unknown>).freezeUsed).toEqual({
      period: '2026-08',
      count: 2,
    });

    const nextMonth = recordFreezeUse(second, new Date(2026, 8, 1, 12));
    expect((nextMonth.streaks as Record<string, unknown>).freezeUsed).toEqual({
      period: '2026-09',
      count: 1,
    });
  });
});

describe('canPurchase', () => {
  it('requires a finite balance covering the item cost', () => {
    const settings = {};
    expect(canPurchase(99, 'freeze', settings, AUGUST_2026)).toBe(false);
    expect(canPurchase(100, 'freeze', settings, AUGUST_2026)).toBe(true);
    expect(canPurchase(149, 'shield', settings, AUGUST_2026)).toBe(false);
    expect(canPurchase(150, 'shield', settings, AUGUST_2026)).toBe(true);
    expect(canPurchase(199, 'recovery', settings, AUGUST_2026)).toBe(false);
    expect(canPurchase(200, 'recovery', settings, AUGUST_2026)).toBe(true);
    expect(canPurchase(Number.NaN, 'freeze', settings, AUGUST_2026)).toBe(false);
    expect(canPurchase(-1, 'freeze', settings, AUGUST_2026)).toBe(false);
  });

  it('rejects unknown item kinds at runtime', () => {
    expect(canPurchase(9999, 'potion' as never, {}, AUGUST_2026)).toBe(false);
  });

  it('gates freezes on the monthly usage cap, but not shields/recovery', () => {
    const capped = { streaks: { freezeUsed: { period: '2026-08', count: FREEZE_MAX_PER_PERIOD } } };
    expect(canPurchase(9999, 'freeze', capped, AUGUST_2026)).toBe(false);
    expect(canPurchase(9999, 'shield', capped, AUGUST_2026)).toBe(true);
    expect(canPurchase(9999, 'recovery', capped, AUGUST_2026)).toBe(true);

    const belowCap = { streaks: { freezeUsed: { period: '2026-08', count: FREEZE_MAX_PER_PERIOD - 1 } } };
    expect(canPurchase(9999, 'freeze', belowCap, AUGUST_2026)).toBe(true);

    // ...but the cap is per month: last month's usage does not block.
    const lastMonth = { streaks: { freezeUsed: { period: '2026-07', count: 99 } } };
    expect(canPurchase(9999, 'freeze', lastMonth, AUGUST_2026)).toBe(true);
  });
});

describe('canApplyFreeze', () => {
  it('requires the streak to be at risk', () => {
    const settings = { streaks: { freeze: 1, shield: 0, recovery: 0 } };
    expect(canApplyFreeze(reconstructStreak([TODAY], TODAY), settings, AUGUST_2026)).toBe(false);
    expect(canApplyFreeze(reconstructStreak(['2026-08-14'], TODAY), settings, AUGUST_2026)).toBe(false);
    expect(canApplyFreeze(atRiskState(), settings, AUGUST_2026)).toBe(true);
  });

  it('requires at least one owned freeze', () => {
    expect(canApplyFreeze(atRiskState(), {}, AUGUST_2026)).toBe(false);
    expect(canApplyFreeze(atRiskState(), { streaks: { freeze: 0, shield: 0, recovery: 0 } }, AUGUST_2026)).toBe(false);
  });

  it('respects the monthly usage cap', () => {
    const capped = {
      streaks: {
        freeze: 1,
        shield: 0,
        recovery: 0,
        freezeUsed: { period: '2026-08', count: FREEZE_MAX_PER_PERIOD },
      },
    };
    expect(canApplyFreeze(atRiskState(), capped, AUGUST_2026)).toBe(false);
  });
});

describe('applyFreeze', () => {
  it('covers the day: current+1, endpoint advances, frozenDays+1, no longer at risk', () => {
    const frozen = applyFreeze(atRiskState(), TODAY);
    expect(frozen).toEqual({
      current: 2,
      longest: 1,
      lastActiveDate: TODAY,
      atRisk: false,
      frozenDays: 1,
    });
  });
});

describe('applyRecovery', () => {
  it('is a no-op with no history', () => {
    const empty = reconstructStreak([], TODAY);
    expect(applyRecovery(empty, RECOVERY_MAX_STREAK_RESTORE_DAYS, TODAY)).toBe(empty);
  });

  it('is a no-op while the streak is alive or at risk', () => {
    const alive = reconstructStreak([TODAY], TODAY);
    expect(applyRecovery(alive, RECOVERY_MAX_STREAK_RESTORE_DAYS, TODAY)).toBe(alive);
    const atRisk = atRiskState();
    expect(applyRecovery(atRisk, RECOVERY_MAX_STREAK_RESTORE_DAYS, TODAY)).toBe(atRisk);
  });

  it('restores a broken streak by counting the missed days back in', () => {
    // 10-day run ending 2026-08-13; missed 14th + 15th = 2 days.
    const broken = reconstructStreak(['2026-08-13', '2026-08-12', '2026-08-11', '2026-08-10', '2026-08-09', '2026-08-08', '2026-08-07', '2026-08-06', '2026-08-05', '2026-08-04'], TODAY);
    expect(broken).toMatchObject({ current: 10, atRisk: false });

    const recovered = applyRecovery(broken, RECOVERY_MAX_STREAK_RESTORE_DAYS, TODAY);
    expect(recovered).toEqual({
      current: 12,
      longest: 10,
      lastActiveDate: TODAY,
      atRisk: false,
      frozenDays: 2,
    });
  });

  it('restores exactly the missed days for a 1-day gap', () => {
    const broken = reconstructStreak(['2026-08-14', '2026-08-13'], TODAY); // missed the 15th
    const recovered = applyRecovery(broken, RECOVERY_MAX_STREAK_RESTORE_DAYS, TODAY);
    expect(recovered.current).toBe(3);
    expect(recovered.frozenDays).toBe(1);
  });

  it('leaves the state unchanged when the gap exceeds maxRestoreDays', () => {
    // Missed 5 days (last active 2026-08-10), cap is 3.
    const broken = reconstructStreak(['2026-08-10'], TODAY);
    const recovered = applyRecovery(broken, RECOVERY_MAX_STREAK_RESTORE_DAYS, TODAY);
    expect(recovered).toBe(broken);
    expect(recovered).toMatchObject({ current: 1, frozenDays: 0, atRisk: false });
  });

  it('a zero cap restores nothing', () => {
    const broken = reconstructStreak(['2026-08-14'], TODAY);
    expect(applyRecovery(broken, 0, TODAY)).toBe(broken);
  });

  it('rejects negative or fractional caps', () => {
    const broken = reconstructStreak(['2026-08-14'], TODAY);
    expect(() => applyRecovery(broken, -1, TODAY)).toThrow(RangeError);
    expect(() => applyRecovery(broken, 1.5, TODAY)).toThrow(RangeError);
  });
});
