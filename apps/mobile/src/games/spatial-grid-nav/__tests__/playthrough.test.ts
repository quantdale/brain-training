// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { gameReducer } from '../reducer';
import { createInitialState } from '../types';
import type { SpatialGridNavGameState } from '../types';
import { buildRawResult } from '../session';
import { normalizeSpatialGridNavResult } from '../scoring';
import { SCORING_VERSION } from '../versions';
import { gameDefinition } from '../game-definition';
import { paramsForLevel, sessionChallengeRating } from '../difficulty';

function playAllCorrect(seed: string): SpatialGridNavGameState {
  let s = createInitialState();
  s = gameReducer(s, { type: 'select-difficulty', level: 'normal' });
  s = gameReducer(s, { type: 'start-session', seed, sessionId: 's', startedAtMs: 0 });
  let guard = 0;
  while (s.phase !== 'results' && guard < 200) {
    guard += 1;
    if (s.phase === 'trialActive' && s.round !== null) {
      s = gameReducer(s, { type: 'pick-cell', index: s.round.correctIndex, responseMs: 0 });
    } else if (s.phase === 'trialResult') {
      s = gameReducer(s, { type: 'next-round' });
    } else {
      break;
    }
  }
  return s;
}

function buildRaw(seed: string) {
  const state = playAllCorrect(seed);
  const level = 'normal' as const;
  const params = paramsForLevel(level);
  const profile = state.profile!;
  return buildRawResult({
    gameVersion: gameDefinition.gameVersion,
    generatorVersion: gameDefinition.generatorVersion,
    scoringVersion: SCORING_VERSION,
    difficulty: level,
    params,
    challengeRating: sessionChallengeRating(level, profile, params.gridSide),
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
    const ctx = { gameId: 'spatial-grid-nav', difficulty: 'normal' as const, durationMs: 0 };
    const n1 = normalizeSpatialGridNavResult(raw, ctx).value;
    const n2 = normalizeSpatialGridNavResult(raw, ctx).value;
    expect(n1).toBe(n2);
    expect(n1).toBeGreaterThanOrEqual(0.8);
  });

  it('a wrong playthrough diverges from a correct one', () => {
    const correct = buildRaw('seed-A');
    let s = createInitialState();
    s = gameReducer(s, { type: 'select-difficulty', level: 'normal' });
    s = gameReducer(s, { type: 'start-session', seed: 'seed-A', sessionId: 's', startedAtMs: 0 });
    let guard = 0;
    while (s.phase !== 'results' && guard < 200) {
      guard += 1;
      if (s.phase === 'trialActive' && s.round !== null) {
        const wrong = (s.round.correctIndex + 1) % s.round.options.length;
        s = gameReducer(s, { type: 'pick-cell', index: wrong, responseMs: 1000 });
      } else if (s.phase === 'trialResult') {
        s = gameReducer(s, { type: 'next-round' });
      } else {
        break;
      }
    }
    const params = paramsForLevel('normal');
    const wrongRaw = buildRawResult({
      gameVersion: gameDefinition.gameVersion,
      generatorVersion: gameDefinition.generatorVersion,
      scoringVersion: SCORING_VERSION,
      difficulty: 'normal',
      params,
      challengeRating: sessionChallengeRating('normal', s.profile!, params.gridSide),
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
