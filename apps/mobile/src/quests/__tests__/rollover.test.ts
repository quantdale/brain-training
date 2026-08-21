/**
 * Quest period rollover hardening (campaign 009 W08): daily/weekly period
 * keys across midnight, month/year and ISO-week boundaries. All dates are
 * built from LOCAL components so the results are deterministic on every host
 * regardless of its timezone (the helpers under test use local getters).
 */
import { describe, expect, it } from '@jest/globals';

import { QUEST_DEFINITIONS_V1 } from '@/quests';
import {
  currentPeriodKey,
  evaluateQuest,
  isoWeekKey,
  localDateKey,
  periodKeyFor,
  selectActiveQuests,
  type QuestSessionSample,
} from '@/quests';

/** Local Date for Y-M-D h:m (avoids UTC-shifted string parsing). */
function localDate(y: number, m: number, d: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0);
}

const sampleAt = (date: Date, xp = 10): QuestSessionSample => ({
  completedAt: date.getTime(),
  gameId: 'memory',
  domain: 'Memory',
  xp,
});

describe('daily rollover boundaries', () => {
  it('flips the daily key exactly at local midnight', () => {
    const justBefore = localDate(2026, 8, 16, 23, 59);
    const justAfter = localDate(2026, 8, 17, 0, 0);
    expect(currentPeriodKey('daily', justBefore)).toBe('2026-08-16');
    expect(currentPeriodKey('daily', justAfter)).toBe('2026-08-17');
  });

  it('rolls over month and year boundaries without gaps', () => {
    expect(localDateKey(localDate(2025, 12, 31))).toBe('2025-12-31');
    expect(localDateKey(localDate(2026, 1, 1))).toBe('2026-01-01');
    expect(periodKeyFor('daily', '2025-12-31')).toBe('2025-12-31');
    expect(periodKeyFor('daily', '2026-01-01')).toBe('2026-01-01');
    // Leap-day handling.
    expect(periodKeyFor('daily', '2024-02-29')).toBe('2024-02-29');
    expect(() => periodKeyFor('daily', '2023-02-29')).toThrow();
  });

  it('a session at 23:59 counts for its own day only, never the next', () => {
    const def = QUEST_DEFINITIONS_V1.find((d) => d.id === 'qd3')!;
    const lateNight = sampleAt(localDate(2026, 8, 16, 23, 59));
    const earlyMorning = sampleAt(localDate(2026, 8, 17, 0, 0));

    const evalLate = evaluateQuest(def, { sessions: [lateNight] }, localDate(2026, 8, 16));
    expect(evalLate).toMatchObject({ progress: 1, completed: false });
    const evalNextDay = evaluateQuest(def, { sessions: [lateNight] }, localDate(2026, 8, 17));
    expect(evalNextDay.progress).toBe(0);

    // Both sides of midnight coexist correctly when evaluated on their own days.
    expect(
      evaluateQuest(def, { sessions: [lateNight, earlyMorning] }, localDate(2026, 8, 17)).progress,
    ).toBe(1);
  });
});

describe('weekly rollover boundaries', () => {
  it('Sunday→Monday flips the ISO week key', () => {
    const sunday = localDate(2026, 8, 16);
    const monday = localDate(2026, 8, 17);
    expect(isoWeekKey(sunday)).toBe('2026-W33');
    expect(isoWeekKey(monday)).toBe('2026-W34');
  });

  it('a session near the week boundary belongs to exactly one ISO week', () => {
    const def = QUEST_DEFINITIONS_V1.find((d) => d.id === 'qw-memory')!;
    const sundayNight = sampleAt(localDate(2026, 8, 16, 22, 0));
    // Evaluated in W33 (Sunday): counts.
    expect(evaluateQuest(def, { sessions: [sundayNight] }, localDate(2026, 8, 16)).progress).toBe(1);
    // Evaluated in W34 (Monday): does not count — no double-attribution.
    expect(evaluateQuest(def, { sessions: [sundayNight] }, localDate(2026, 8, 17)).progress).toBe(0);
  });

  it('the ISO year boundary reassigns late-December days to the next week-year', () => {
    // Mon 2025-12-29 belongs to 2026-W01 (year of the week's Thursday).
    expect(isoWeekKey(localDate(2025, 12, 29))).toBe('2026-W01');
    expect(isoWeekKey(localDate(2025, 12, 28))).toBe('2025-W52');
    // A weekly quest evaluated during 2026-W01 counts a 2025-12-29 session.
    const def = QUEST_DEFINITIONS_V1.find((d) => d.id === 'qw-memory')!;
    const session = sampleAt(localDate(2025, 12, 29));
    expect(evaluateQuest(def, { sessions: [session] }, localDate(2026, 1, 2)).progress).toBe(1);
    // The whole week Mon 29 Dec – Sun 4 Jan maps to 2026-W01; evaluated on
    // Sunday 2025-12-28 (still 2025-W52) the session does not count.
    expect(evaluateQuest(def, { sessions: [session] }, localDate(2025, 12, 28)).progress).toBe(0);
  });
});

describe('active-pool stability across rollovers', () => {
  it('selection is stable within a day and bounded after a day/week flip', () => {
    const sundayMorning = localDate(2026, 8, 16, 8, 0);
    const sundayNight = localDate(2026, 8, 16, 23, 0);
    const monday = localDate(2026, 8, 17, 8, 0);

    const a = selectActiveQuests(QUEST_DEFINITIONS_V1, sundayMorning).map((d) => d.id);
    const b = selectActiveQuests(QUEST_DEFINITIONS_V1, sundayNight).map((d) => d.id);
    expect(a).toEqual(b); // same local day → identical pool

    const mondayIds = selectActiveQuests(QUEST_DEFINITIONS_V1, monday);
    expect(mondayIds.filter((d) => d.kind === 'daily')).toHaveLength(3);
    expect(mondayIds.filter((d) => d.kind === 'weekly')).toHaveLength(3);
  });

  it('every active quest evaluation period key matches its persisted row key', () => {
    const now = localDate(2026, 8, 16);
    for (const def of selectActiveQuests(QUEST_DEFINITIONS_V1, now)) {
      expect(currentPeriodKey(def.kind, now)).toBe(periodKeyFor(def.kind, localDateKey(now)));
    }
  });
});
