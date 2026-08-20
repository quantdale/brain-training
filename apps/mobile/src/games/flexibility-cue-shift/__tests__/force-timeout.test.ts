// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';

import { flexibilityCueReducer } from '../reducer';
import { createInitialFlexibilityCueState } from '../types';
import type { FlexibilityCueGameState } from '../types';

function start(seed = 'to', level: 'easy' | 'normal' | 'hard' | 'expert' | 'adaptive' = 'normal'): FlexibilityCueGameState {
  let s = createInitialFlexibilityCueState();
  s = flexibilityCueReducer(s, { type: 'select-difficulty', level });
  s = flexibilityCueReducer(s, { type: 'start-session', seed, sessionId: 's', startedAtMs: 1 });
  return s;
}

function correctPick(s: FlexibilityCueGameState): FlexibilityCueGameState {
  return flexibilityCueReducer(s, { type: 'pick-card', index: s.round!.correctIndex, responseMs: 0 });
}

describe('qa/force-timeout', () => {
  it('ends the session with the achieved stats and no added penalty', () => {
    const played = correctPick(start());
    const playedBefore = played.stats.roundsPlayed;
    const s = flexibilityCueReducer(played, { type: 'qa/force-timeout' });
    expect(s.phase).toBe('results');
    expect(s.forced).toBe(true);
    expect(s.paused).toBe(false);
    expect(s.round).toBeNull();
    expect(s.stats.roundsPlayed).toBe(playedBefore);
    expect(s.stats.correctPicks).toBe(playedBefore);
    expect(s.stats.mistakes).toBe(0);
  });

  it('does not score the in-flight trialActive round', () => {
    const s = flexibilityCueReducer(start(), { type: 'qa/force-timeout' });
    expect(s.phase).toBe('results');
    expect(s.forced).toBe(true);
    expect(s.stats.roundsPlayed).toBe(0);
    expect(s.stats.mistakes).toBe(0);
  });

  it('is a no-op in intro and results', () => {
    const intro = flexibilityCueReducer(createInitialFlexibilityCueState(), { type: 'qa/force-timeout' });
    expect(intro.phase).toBe('intro');

    const done = flexibilityCueReducer(correctPick(start()), { type: 'qa/force-timeout' });
    const again = flexibilityCueReducer(done, { type: 'qa/force-timeout' });
    expect(again.phase).toBe('results');
    expect(again.forced).toBe(true);
    expect(again.stats.roundsPlayed).toBe(done.stats.roundsPlayed);
  });
});
