// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { flexibilityCueReducer } from '../reducer';
import { createInitialFlexibilityCueState } from '../types';
import type { FlexibilityCueGameState } from '../types';
import { buildFlexibilityCueRawResult } from '../session';
import { normalizeFlexibilityCueResult } from '../scoring';
import { SCORING_VERSION } from '../versions';
import { gameDefinition } from '../game-definition';
import { flexibilityCueParamsForLevel, sessionChallengeRating } from '../difficulty';

function playAllCorrect(seed: string): FlexibilityCueGameState {
  let s = createInitialFlexibilityCueState();
  s = flexibilityCueReducer(s, { type: 'select-difficulty', level: 'normal' });
  s = flexibilityCueReducer(s, { type: 'start-session', seed, sessionId: 's', startedAtMs: 0 });
  let guard = 0;
  while (s.phase !== 'results' && guard < 200) {
    guard += 1;
    if (s.phase === 'trialActive' && s.round !== null) {
      s = flexibilityCueReducer(s, { type: 'pick-card', index: s.round.correctIndex, responseMs: 0 });
    } else if (s.phase === 'trialResult') {
      s = flexibilityCueReducer(s, { type: 'next-round' });
    } else {
      break;
    }
  }
  return s;
}

function buildRaw(seed: string) {
  const state = playAllCorrect(seed);
  const level = 'normal' as const;
  const params = flexibilityCueParamsForLevel(level);
  const profile = state.profile!;
  return buildFlexibilityCueRawResult({
    gameVersion: gameDefinition.gameVersion,
    generatorVersion: gameDefinition.generatorVersion,
    scoringVersion: SCORING_VERSION,
    difficulty: level,
    params,
    finalSwitchRate: params.switchRate,
    challengeRating: sessionChallengeRating(level, profile, params.switchRate),
    seed,
    stats: state.stats,
    forced: state.forced,
    startedAtMs: 0,
    activeDurationMs: 0,
    pausedDurationMs: 0,
  });
}

describe('full playthrough determinism', () => {
  it('replaying the same seed yields an identical raw result', () => {
    expect(buildRaw('seed-A')).toEqual(buildRaw('seed-A'));
  });

  it('a perfect run completes every round correctly', () => {
    const raw = buildRaw('seed-A');
    expect(raw.roundsPlayed).toBe(raw.totalRounds);
    expect(raw.correctPicks).toBe(raw.totalRounds);
    expect(raw.mistakes).toBe(0);
    expect(raw.forced).toBe(false);
  });

  it('normalization is stable and a perfect run scores at least 0.8', () => {
    const raw = buildRaw('seed-A');
    const ctx = { gameId: 'flexibility-cue-shift', difficulty: 'normal' as const, durationMs: 0 };
    const n1 = normalizeFlexibilityCueResult(raw, ctx).value;
    const n2 = normalizeFlexibilityCueResult(raw, ctx).value;
    expect(n1).toBe(n2);
    expect(n1).toBeGreaterThanOrEqual(0.8);
  });

  it('a wrong playthrough diverges from a correct one', () => {
    const correct = buildRaw('seed-A');
    let s = createInitialFlexibilityCueState();
    s = flexibilityCueReducer(s, { type: 'select-difficulty', level: 'normal' });
    s = flexibilityCueReducer(s, { type: 'start-session', seed: 'seed-A', sessionId: 's', startedAtMs: 0 });
    let guard = 0;
    while (s.phase !== 'results' && guard < 200) {
      guard += 1;
      if (s.phase === 'trialActive' && s.round !== null) {
        const wrong = (s.round.correctIndex + 1) % s.round.candidates.length;
        s = flexibilityCueReducer(s, { type: 'pick-card', index: wrong, responseMs: 1000 });
      } else if (s.phase === 'trialResult') {
        s = flexibilityCueReducer(s, { type: 'next-round' });
      } else {
        break;
      }
    }
    const params = flexibilityCueParamsForLevel('normal');
    const wrongRaw = buildFlexibilityCueRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params,
      finalSwitchRate: params.switchRate,
      challengeRating: sessionChallengeRating('normal', s.profile!, params.switchRate),
      seed: 'seed-A',
      stats: s.stats,
      forced: s.forced,
      startedAtMs: 0,
      activeDurationMs: 0,
      pausedDurationMs: 0,
    });
    expect(wrongRaw.correctPicks).toBeLessThan(correct.correctPicks);
  });
});
