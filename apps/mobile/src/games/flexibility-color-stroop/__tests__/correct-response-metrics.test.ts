import { describe, expect, it } from '@jest/globals';
import { colorStroopGameReducer as reduce, createInitialColorStroopState } from '../reducer';
import { COLOR_STROOP_DIFFICULTY_PARAMS } from '../difficulty';
import { buildColorStroopRawResult } from '../session';
import { normalizeColorStroopResult } from '../scoring';
import { inputStamp } from '../types';
import type { ColorStroopGameState } from '../types';
import { SCORING_VERSION } from '../versions';
function start() { return reduce(createInitialColorStroopState(), { type: 'start-session', seed: 'metrics', sessionId: 'metrics', startedAtMs: 0, nowMs: 0 }); }
function raw(state: ColorStroopGameState) {
  return buildColorStroopRawResult({ gameVersion: '1.0.0', generatorVersion: '1.0.0', scoringVersion: SCORING_VERSION, difficulty: 'normal', params: COLOR_STROOP_DIFFICULTY_PARAMS.normal, challengeRating: 0.5, seed: state.seed, stats: state.stats, totalFlips: 3, forced: false, startedAtMs: 0, activeDurationMs: 1000, pausedDurationMs: 0 });
}
function answer(state: ColorStroopGameState, correct: boolean, rt: number) {
  const right = state.trials[state.trialIndex].correctAnswer;
  return reduce(state, { type: 'submit-answer', answer: correct ? right : right === 'red' ? 'blue' : 'red', nowMs: state.roundStartedAtMs + rt, stamp: inputStamp(state) });
}
function next(state: ColorStroopGameState) { return reduce(state, { type: 'next-trial', nowMs: state.deadlineMs, stamp: inputStamp(state) }); }
describe('Stroop correct-response-only timing', () => {
  it('does not improve fastest or mean with a fast wrong tap or timeout', () => {
    let state = answer(start(), true, 1000);
    state = answer(next(state), false, 100);
    const beforeTimeout = raw(state);
    expect(beforeTimeout.avgResponseTimeMs).toBe(1000);
    expect(beforeTimeout.fastestResponseMs).toBe(1000);
    expect(beforeTimeout.correctResponseSamples).toBe(1);
    state = next(state);
    state = reduce(state, { type: 'trial-timeout', nowMs: state.deadlineMs, stamp: inputStamp(state) });
    expect(raw(state).avgResponseTimeMs).toBe(1000);
    expect(raw(state).fastestResponseMs).toBe(1000);
    expect(raw(state).correctResponseSamples).toBe(1);
  });
  it('uses null no-response sentinels for empty, entirely wrong and timeout-only runs', () => {
    const initial = start();
    for (const state of [initial, answer(initial, false, 100), reduce(initial, { type: 'trial-timeout', nowMs: initial.deadlineMs, stamp: inputStamp(initial) })]) {
      const result = raw(state);
      expect(result.avgResponseTimeMs).toBeNull();
      expect(result.fastestResponseMs).toBeNull();
      expect(result.correctResponseSamples).toBe(0);
      expect(JSON.parse(JSON.stringify(result)).avgResponseTimeMs).toBeNull();
      expect(normalizeColorStroopResult(result, { gameId: 'flexibility-color-stroop', difficulty: 'normal', durationMs: 1000 }).value).toBe(0);
    }
  });
  it('averages only correct samples, preserves zero-ms samples and resets counts on restart', () => {
    let state = answer(start(), true, 1000);
    state = answer(next(state), false, 100);
    state = answer(next(state), true, 0);
    expect(raw(state).avgResponseTimeMs).toBe(500);
    expect(raw(state).fastestResponseMs).toBe(0);
    expect(raw(state).correctResponseSamples).toBe(2);
    const forced = reduce(state, { type: 'qa/force-win' });
    expect(raw(forced).avgResponseTimeMs).toBe(0);
    expect(raw(forced).correctResponseSamples).toBe(COLOR_STROOP_DIFFICULTY_PARAMS.normal.trials);
    expect(raw(reduce(forced, { type: 'start-session', seed: 'restart', sessionId: 'restart', startedAtMs: 0, nowMs: 0 })).correctResponseSamples).toBe(0);
  });
});
