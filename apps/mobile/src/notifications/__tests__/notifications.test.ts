import { describe, expect, it } from '@jest/globals';

import type { DayOfWeek } from '../types';
import {
  createEmptyNotificationPreferences,
  createEmptyScheduleIntent,
} from '../defaults';
import {
  clampMinuteOfDay,
  isWindowDecided,
  normalizeDays,
  normalizeNotificationPreferences,
  normalizeScheduleIntent,
  windowCoversMinute,
} from '../normalize';

describe('null-state preferences', () => {
  it('ships all-off with no decided schedule (no default schedule exists)', () => {
    const prefs = createEmptyNotificationPreferences();
    expect(prefs.masterEnabled).toBe(false);
    expect(prefs.intents.map((i) => i.kind)).toEqual([
      'streak-reminder',
      'workout-reminder',
    ]);
    for (const intent of prefs.intents) {
      expect(intent.enabled).toBe(false);
      expect(isWindowDecided(intent)).toBe(false);
      expect(intent.days).toEqual([]);
    }
  });
});

describe('normalizeScheduleIntent', () => {
  it('clamps window bounds and canonicalizes days (dedupe + ascending)', () => {
    const intent = normalizeScheduleIntent({
      kind: 'workout-reminder',
      enabled: true,
      windowStartMinute: -30,
      windowEndMinute: 2000.9,
      // 9 is deliberately invalid: the sanitizer must drop it.
      days: [3, 1, 3, 9, 0] as DayOfWeek[],
    });
    expect(intent).toEqual({
      kind: 'workout-reminder',
      enabled: true,
      windowStartMinute: 0,
      windowEndMinute: 1439,
      days: [0, 1, 3],
    });
  });

  it('resets half-specified or midnight-crossing windows to undecided', () => {
    const half = normalizeScheduleIntent({
      kind: 'streak-reminder',
      enabled: true,
      windowStartMinute: 600,
      windowEndMinute: null,
      days: [],
    });
    expect(half?.windowStartMinute).toBeNull();
    expect(half?.windowEndMinute).toBeNull();

    const crossing = normalizeScheduleIntent({
      kind: 'streak-reminder',
      enabled: true,
      windowStartMinute: 1300,
      windowEndMinute: 30,
      days: [],
    });
    expect(isWindowDecided(crossing!)).toBe(false);
  });

  it('drops unknown kinds and normalizes full preferences into canonical order', () => {
    const prefs = normalizeNotificationPreferences({
      masterEnabled: true,
      intents: [
        // Unknown future kind must be dropped, not crash.
        { kind: 'alien-kind' as never, enabled: true, windowStartMinute: null, windowEndMinute: null, days: [] },
        createEmptyScheduleIntent('workout-reminder'),
      ],
    } as never);
    expect(prefs.masterEnabled).toBe(true);
    expect(prefs.intents.map((i) => i.kind)).toEqual([
      'streak-reminder',
      'workout-reminder',
    ]);
    // Missing known kind was re-added as an empty intent.
    expect(prefs.intents[0]).toEqual(createEmptyScheduleIntent('streak-reminder'));
  });
});

describe('window helpers', () => {
  it('treats decided windows as inclusive on both ends; undecided covers nothing', () => {
    const intent = {
      kind: 'workout-reminder' as const,
      enabled: true,
      windowStartMinute: 540,
      windowEndMinute: 600,
      days: [],
    };
    expect(windowCoversMinute(intent, 540)).toBe(true);
    expect(windowCoversMinute(intent, 600)).toBe(true);
    expect(windowCoversMinute(intent, 601)).toBe(false);
    expect(windowCoversMinute(createEmptyScheduleIntent('workout-reminder'), 540)).toBe(false);
  });

  it('clamps minutes and canonicalizes raw day lists defensively', () => {
    expect(clampMinuteOfDay(1441)).toBe(1439);
    expect(clampMinuteOfDay(-1)).toBe(0);
    expect(normalizeDays('weekdays' as never)).toEqual([]);
    expect(normalizeDays([6, 6, 2])).toEqual([2, 6]);
  });
});
