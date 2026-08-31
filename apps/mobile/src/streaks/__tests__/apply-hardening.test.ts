/**
 * Streak apply hardening (campaign 009 W08): transactionality + idempotency of
 * applying owned Freeze/Shield/Recovery items.
 *
 * Contract under test:
 * - A repeated application that would add NO new covered date (double tap on
 *   the same day, stale UI state) is refused WITHOUT consuming a second item.
 * - Concurrent apply attempts can never consume more than one item.
 * - A refusal leaves inventory and covered dates exactly as they were.
 */
import { describe, expect, it } from '@jest/globals';

import { AppDatabase, ProfileRepository } from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import {
  applyOwnedStreakItem,
  readCoveredDates,
  readInventory,
  reconstructStreak,
} from '@/streaks';
import type { StreakItemKind } from '@/streaks';

const T0 = 1_700_000_000_000;
const NOW = new Date(2026, 7, 16, 12, 0, 0); // local 2026-08-16
const TODAY = '2026-08-16';

async function makeDb(
  settings: Record<string, unknown> = {},
): Promise<AppDatabase> {
  const real = await createMigratedDb();
  await new ProfileRepository(real, () => T0).ensureExists();
  const db = new AppDatabase(real, { now: () => T0 });
  if (Object.keys(settings).length > 0) {
    await db.profile.update({ settings });
  }
  return db;
}

async function seedActivity(db: AppDatabase, dates: readonly string[]): Promise<void> {
  await db.transaction(async (txn) => {
    for (const [index, date] of dates.entries()) {
      const completedAt = new Date(`${date}T12:00:00`).getTime();
      await txn.run(
        `INSERT INTO game_sessions
          (id, game_id, game_version, generator_version, scoring_version, seed,
           difficulty_json, raw_result_json, normalized_result, xp, started_at,
           completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`streak-${index}-${date}`, 'memory', 1, 1, 1, index + 1, '{}', '{}', 0.5, 1,
          completedAt - 1_000, completedAt, 1_000],
      );
    }
  });
}

/** 10-day run ending 2026-08-13; today is 2026-08-16 → broken, 2 missed days. */
const BROKEN_HISTORY = [
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
];

describe('streak apply duplicate-application hardening', () => {
  it('a second freeze on an already-covered day consumes nothing extra', async () => {
    const db = await makeDb({ streaks: { freeze: 2, shield: 0, recovery: 0 } });
    await seedActivity(db, ['2026-08-15']);
    const state = reconstructStreak(['2026-08-15'], TODAY); // at risk

    expect(await applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW)).toBe('applied');
    // Double tap / stale-state retry: still "at risk" per the captured state.
    expect(await applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW)).toBe('not-allowed');

    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings).freeze).toBe(1); // exactly one consumed
    expect(readCoveredDates(settings).filter((d) => d === TODAY)).toHaveLength(1);
  });

  it('a second recovery on already-covered missed days consumes nothing extra', async () => {
    const db = await makeDb({ streaks: { freeze: 0, shield: 0, recovery: 2 } });
    await seedActivity(db, BROKEN_HISTORY);
    const broken = reconstructStreak(BROKEN_HISTORY, TODAY);

    expect(await applyOwnedStreakItem(db, 'recovery' as StreakItemKind, broken, NOW)).toBe('applied');
    expect(await applyOwnedStreakItem(db, 'recovery' as StreakItemKind, broken, NOW)).toBe('not-allowed');

    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings).recovery).toBe(1); // exactly one consumed
    // Coverage is complete and stable after the refused retry.
    const covered = new Set(readCoveredDates(settings));
    expect(covered.has('2026-08-14')).toBe(true);
    expect(covered.has('2026-08-15')).toBe(true);
    expect(covered.has('2026-08-16')).toBe(true);
  });

  it('a second shield application consumes nothing extra (either window)', async () => {
    const db = await makeDb({ streaks: { freeze: 0, shield: 2, recovery: 0 } });
    await seedActivity(db, ['2026-08-15']);
    const atRisk = reconstructStreak(['2026-08-15'], TODAY);

    expect(await applyOwnedStreakItem(db, 'shield' as StreakItemKind, atRisk, NOW)).toBe('applied');
    expect(await applyOwnedStreakItem(db, 'shield' as StreakItemKind, atRisk, NOW)).toBe('not-allowed');

    const settings = (await db.profile.get())?.settings ?? {};
    // Exactly one SHIELD consumed — never a Freeze or Recovery.
    expect(readInventory(settings)).toEqual({ freeze: 0, shield: 1, recovery: 0 });
    expect(readCoveredDates(settings)).toEqual([TODAY]);
  });

  it('a shield-only inventory can protect an at-risk streak (freeze-window)', async () => {
    const db = await makeDb({ streaks: { freeze: 0, shield: 1, recovery: 0 } });
    await seedActivity(db, ['2026-08-15']);
    const state = reconstructStreak(['2026-08-15'], TODAY);
    expect(await applyOwnedStreakItem(db, 'shield' as StreakItemKind, state, NOW)).toBe('applied');

    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings).shield).toBe(0);
    expect(readCoveredDates(settings)).toEqual([TODAY]);
    // The freeze-like window records monthly Freeze usage for the shared cap.
    const streaksBlock = settings.streaks as Record<string, unknown>;
    expect((streaksBlock.freezeUsed as Record<string, unknown>).count).toBe(1);
  });

  it('a shield-only inventory can restore a broken streak (recovery-window)', async () => {
    const db = await makeDb({ streaks: { freeze: 0, shield: 1, recovery: 0 } });
    await seedActivity(db, BROKEN_HISTORY);
    const broken = reconstructStreak(BROKEN_HISTORY, TODAY); // 2 missed days
    expect(await applyOwnedStreakItem(db, 'shield' as StreakItemKind, broken, NOW)).toBe('applied');

    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings).shield).toBe(0);
    const covered = new Set(readCoveredDates(settings));
    expect(covered.has('2026-08-14')).toBe(true);
    expect(covered.has('2026-08-16')).toBe(true);
  });

  it('concurrent apply attempts consume at most one item each', async () => {
    const db = await makeDb({ streaks: { freeze: 3, shield: 0, recovery: 0 } });
    await seedActivity(db, ['2026-08-15']);
    const state = reconstructStreak(['2026-08-15'], TODAY);

    // Fire two applies without awaiting the first (double-tap race). The node
    // backend serializes/rejects overlapping transactions; either way the
    // invariant holds: never more than one item consumed for one covered day.
    const outcomes = await Promise.allSettled([
      applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW),
      applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW),
    ]);

    const fulfilled = outcomes
      .filter((o): o is PromiseFulfilledResult<'applied' | 'not-allowed' | 'no-item'> => o.status === 'fulfilled')
      .map((o) => o.value);
    expect(fulfilled.filter((r) => r === 'applied')).toHaveLength(1);

    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings).freeze).toBe(2); // 3 owned − exactly 1 used
    expect(readCoveredDates(settings)).toEqual([TODAY]);
  });

  it('a refusal leaves inventory and coverage untouched', async () => {
    const db = await makeDb({ streaks: { freeze: 1, shield: 0, recovery: 0 } });
    await seedActivity(db, ['2026-08-15']);
    const state = reconstructStreak(['2026-08-15'], TODAY);
    await applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW);

    // Retry with the same stale state must not touch anything.
    await applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW);
    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings)).toEqual({ freeze: 0, shield: 0, recovery: 0 });
    expect(readCoveredDates(settings)).toEqual([TODAY]);
  });

  it('revalidates a stale snapshot against sessions committed after the screen loaded', async () => {
    const db = await makeDb({ streaks: { freeze: 1, shield: 0, recovery: 0 } });
    const staleState = reconstructStreak(['2026-08-15'], TODAY);

    // The player completed today after the Profile screen captured its state;
    // a Freeze is no longer eligible and must not be consumed.
    await db.transaction(async (txn) => {
      await txn.run(
        `INSERT INTO game_sessions
          (id, game_id, game_version, generator_version, scoring_version, seed,
           difficulty_json, raw_result_json, normalized_result, xp, started_at,
           completed_at, duration_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['today', 'memory', 1, 1, 1, 1, '{}', '{}', 0.5, 1, NOW.getTime(), NOW.getTime(), 0],
      );
    });

    expect(await applyOwnedStreakItem(db, 'freeze' as StreakItemKind, staleState, NOW)).toBe(
      'not-allowed',
    );
    const settings = (await db.profile.get())?.settings ?? {};
    expect(readInventory(settings).freeze).toBe(1);
    expect(readCoveredDates(settings)).toEqual([]);
  });

  it('coverage from a previous day does not block protecting a NEW day', async () => {
    const db = await makeDb({
      streaks: { freeze: 2, shield: 0, recovery: 0, coveredDates: ['2026-08-10'] },
    });
    await seedActivity(db, ['2026-08-15']);
    const state = reconstructStreak(['2026-08-15'], TODAY);
    expect(await applyOwnedStreakItem(db, 'freeze' as StreakItemKind, state, NOW)).toBe('applied');

    const settings = (await db.profile.get())?.settings ?? {};
    const covered = readCoveredDates(settings);
    expect(covered).toContain('2026-08-10'); // old coverage preserved
    expect(covered).toContain(TODAY); // new coverage added
    expect(readInventory(settings).freeze).toBe(1);
  });

  it('partial prior coverage still lets a recovery restore the remaining gap days', async () => {
    // One missed day (2026-08-14) was already covered by an earlier freeze;
    // a recovery must add the remaining days (08-15, 08-16) and consume one item.
    const db = await makeDb({
      streaks: { freeze: 0, shield: 0, recovery: 1, coveredDates: ['2026-08-14'] },
    });
    await seedActivity(db, BROKEN_HISTORY);
    const broken = reconstructStreak(BROKEN_HISTORY, TODAY);
    expect(await applyOwnedStreakItem(db, 'recovery' as StreakItemKind, broken, NOW)).toBe('applied');

    const settings = (await db.profile.get())?.settings ?? {};
    const covered = new Set(readCoveredDates(settings));
    expect(covered.has('2026-08-14')).toBe(true);
    expect(covered.has('2026-08-15')).toBe(true);
    expect(covered.has('2026-08-16')).toBe(true);
    expect(readInventory(settings).recovery).toBe(0);
  });
});
