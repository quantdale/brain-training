import { describe, expect, it } from '@jest/globals';

import { orderPathGameReducer } from '../reducer';
import { createInitialOrderPathState } from '../types';

describe('Order Path repeated placement', () => {
  it('ignores a placed item and lets the remaining valid path finish', () => {
    let state = orderPathGameReducer(createInitialOrderPathState(), {
      type: 'start-session', seed: 'repeat-placement', sessionId: 'repeat',
      startedAtMs: 100, nowMs: 100,
    });
    const solution = state.currentRound!.solution;
    state = orderPathGameReducer(state, { type: 'select-item', item: solution[0], nowMs: 200 });
    const afterFirst = state;
    state = orderPathGameReducer(state, { type: 'select-item', item: solution[0], nowMs: 201 });
    expect(state).toBe(afterFirst);
    for (const [index, item] of solution.slice(1).entries()) {
      state = orderPathGameReducer(state, { type: 'select-item', item, nowMs: 300 + index });
    }
    expect(state.roundOutcome).toBe('correct');
    expect(state.stats.roundsCorrect).toBe(1);
  });
});
