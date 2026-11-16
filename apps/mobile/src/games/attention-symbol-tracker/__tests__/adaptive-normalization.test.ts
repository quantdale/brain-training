import { describe, expect, it } from '@jest/globals';
import { symbolTrackerGameReducer as reduce, createInitialSymbolTrackerState } from '../reducer';
import { continuationStamp } from '../types';
import { symbolTrackerParamsFromProfile } from '../difficulty';
import { buildSymbolTrackerRawResult } from '../session';
import { normalizeSymbolTrackerResult } from '../scoring';
import { SCORING_VERSION } from '../versions';

describe('Adaptive reducer → persisted raw → normalizer', () => {
  it('records the actually reachable reference and awards a perfect Adaptive run 1', () => {
    let state = reduce(createInitialSymbolTrackerState(), { type: 'select-difficulty', level: 'adaptive' });
    state = reduce(state, { type: 'start-session', seed: 'game-b-adaptive', sessionId: 'adaptive', startedAtMs: 0 });
    const counts: number[] = [];
    while (state.phase !== 'results') {
      counts.push(state.trackCount);
      state = reduce(state, { type: 'observe-tick' });
      for (let index = 0; index < state.respondBoard.length; index += 1) {
        if (state.trackedSymbolIds.includes(state.respondBoard[index])) state = reduce(state, { type: 'tap-cell', index });
      }
      state = reduce(state, { type: 'submit' });
      state = reduce(state, { type: 'next-round', stamp: continuationStamp(state) });
    }
    expect(counts).toEqual([2, 3, 4, 4, 4, 4]);
    const raw = buildSymbolTrackerRawResult({
      gameVersion: '1.0.0', generatorVersion: '1.0.0', scoringVersion: SCORING_VERSION,
      difficulty: 'adaptive', params: symbolTrackerParamsFromProfile(state.profile!), challengeRating: state.profile!.challengeRating,
      seed: state.seed, stats: state.stats, forced: false, startedAtMs: 0, activeDurationMs: 10000, pausedDurationMs: 0,
    });
    const context = { gameId: 'attention-symbol-tracker', difficulty: 'adaptive' as const, durationMs: 10000 };
    expect(normalizeSymbolTrackerResult(raw, context).value).toBe(1);
    expect(raw.referenceMaxRecall).toBe(4);
    const persisted = JSON.parse(JSON.stringify(raw));
    expect(normalizeSymbolTrackerResult(persisted, context).value).toBe(1);
    // Old raw data keeps the old denominator; already persisted normalized values are never rewritten.
    delete persisted.referenceMaxRecall;
    persisted.scoringVersion = '1.1.0';
    expect(normalizeSymbolTrackerResult(persisted, context).value).toBeCloseTo(5 / 6);
  });
});
