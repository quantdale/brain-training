// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import {
  ADAPTIVE_PARAMS,
  DEFAULT_RESPOND_DEADLINE_MS,
  SYMBOL_TRACKER_DIFFICULTY_PARAMS,
  nextTrackCount,
  resolveSymbolTrackerDifficulty,
  sessionChallengeRating,
  symbolTrackerParamsForLevel,
  symbolTrackerParamsFromProfile,
} from '../difficulty';

describe('symbolTrackerParamsForLevel / resolve', () => {
  it('returns fresh copies of the frozen defaults for fixed levels', () => {
    expect(symbolTrackerParamsForLevel('easy')).toEqual(
      SYMBOL_TRACKER_DIFFICULTY_PARAMS.easy,
    );
    const copy = symbolTrackerParamsForLevel('normal');
    expect(copy).toEqual(SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal);
    expect(copy).not.toBe(SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal);
  });

  it('resolves fixed levels with the SDK default challenge ratings', () => {
    expect(resolveSymbolTrackerDifficulty('easy').challengeRating).toBe(0.2);
    expect(resolveSymbolTrackerDifficulty('normal').challengeRating).toBe(0.5);
    expect(resolveSymbolTrackerDifficulty('hard').challengeRating).toBe(0.8);
    expect(resolveSymbolTrackerDifficulty('expert').challengeRating).toBe(0.95);
  });

  it('adaptive uses the neutral baseline', () => {
    const profile = resolveSymbolTrackerDifficulty('adaptive');
    expect(profile.level).toBe('adaptive');
    expect(profile.challengeRating).toBe(0.5);
    expect(profile.parameters.gridSize).toBe(ADAPTIVE_PARAMS.gridSize);
  });
});

describe('symbolTrackerParamsFromProfile', () => {
  it('recovers params and throws on missing numeric fields', () => {
    const profile = resolveSymbolTrackerDifficulty('hard');
    const params = symbolTrackerParamsFromProfile(profile);
    expect(params.gridSize).toBe(16);
    expect(params.tokenCount).toBe(8);
    expect(params.initialTrackCount).toBe(3);
    expect(params.respondDeadlineMs).toBe(6000);
    const broken = {
      ...profile,
      parameters: { gridSize: 16 },
    } as typeof profile;
    expect(() => symbolTrackerParamsFromProfile(broken)).toThrow();
  });

  it('gives every tier a generous, shrinking respond budget', () => {
    // 8s at easy down to 5s at expert; the budget is a safety net, not the
    // challenge (score decays only via fewer correct picks on expiry).
    expect(SYMBOL_TRACKER_DIFFICULTY_PARAMS.easy.respondDeadlineMs).toBe(8000);
    expect(SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal.respondDeadlineMs).toBe(7000);
    expect(SYMBOL_TRACKER_DIFFICULTY_PARAMS.hard.respondDeadlineMs).toBe(6000);
    expect(SYMBOL_TRACKER_DIFFICULTY_PARAMS.expert.respondDeadlineMs).toBe(5000);
    expect(ADAPTIVE_PARAMS.respondDeadlineMs).toBe(7000);
    expect(symbolTrackerParamsForLevel('easy').respondDeadlineMs).toBeGreaterThan(
      symbolTrackerParamsForLevel('expert').respondDeadlineMs,
    );
  });

  it('defaults respondDeadlineMs for profiles persisted before the deadline existed', () => {
    const profile = resolveSymbolTrackerDifficulty('normal');
    const { respondDeadlineMs: _legacy, ...legacyParameters } = profile.parameters;
    const params = symbolTrackerParamsFromProfile({ ...profile, parameters: legacyParameters });
    expect(params.respondDeadlineMs).toBe(DEFAULT_RESPOND_DEADLINE_MS);
  });
});

describe('nextTrackCount', () => {
  it('escalates by one on a pass (capped at the token count)', () => {
    expect(
      nextTrackCount(2, true, 'normal', SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal),
    ).toBe(3);
    expect(
      nextTrackCount(6, true, 'normal', SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal),
    ).toBe(6); // capped at token count
  });
  it('holds on a failure', () => {
    expect(
      nextTrackCount(4, false, 'normal', SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal),
    ).toBe(4);
  });
  it('adaptive moves within bounds', () => {
    expect(nextTrackCount(2, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(3);
    expect(nextTrackCount(4, true, 'adaptive', ADAPTIVE_PARAMS)).toBe(4); // capped at maxTrackCount
    expect(nextTrackCount(1, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(1); // floored at minTrackCount
    expect(nextTrackCount(2, false, 'adaptive', ADAPTIVE_PARAMS)).toBe(1);
  });
});

describe('sessionChallengeRating', () => {
  it('returns the SDK default for fixed levels', () => {
    expect(
      sessionChallengeRating(
        'hard',
        resolveSymbolTrackerDifficulty('hard'),
        8,
      ),
    ).toBe(0.8);
  });
  it('maps the final track count into [0,1] for adaptive', () => {
    const profile = resolveSymbolTrackerDifficulty('adaptive');
    expect(sessionChallengeRating('adaptive', profile, 1)).toBeCloseTo(0);
    expect(sessionChallengeRating('adaptive', profile, 4)).toBeCloseTo(1);
    expect(sessionChallengeRating('adaptive', profile, 2)).toBeCloseTo(1 / 3, 5);
  });
});
