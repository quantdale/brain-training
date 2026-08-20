// Jest globals imported explicitly (repo has no @types/jest).
import { describe, expect, it } from '@jest/globals';
import { createRng } from '@/sdk';
import type { DifficultyLevel } from '@/sdk';

import { ruleGridGameReducer } from '../reducer';
import { createInitialRuleGridState } from '../types';
import type { RuleGridGameState } from '../types';
import { generateRound } from '../generator';
import { perfectSessionScore, roundScore } from '../scoring';
import { RULE_GRID_DIFFICULTY_PARAMS, resolveRuleGridDifficulty, ruleGridParamsFromProfile } from '../difficulty';

function startSession(
  seed: string,
  level: DifficultyLevel = 'normal',
  sessionId = 's1',
): RuleGridGameState {
  let state = createInitialRuleGridState();
  state = ruleGridGameReducer(state, { type: 'select-difficulty', level });
  state = ruleGridGameReducer(state, { type: 'start-session', seed, sessionId, startedAtMs: 100 });
  return state;
}

describe('select-difficulty', () => {
  it('selects a level in the intro', () => {
    const state = ruleGridGameReducer(createInitialRuleGridState(), { type: 'select-difficulty', level: 'hard' });
    expect(state.difficulty).toBe('hard');
  });

  it('ignores selection mid-session', () => {
    const state = ruleGridGameReducer(startSession('x'), { type: 'select-difficulty', level: 'easy' });
    expect(state.difficulty).toBe('normal');
  });
});

describe('start-session', () => {
  it('resolves the difficulty and opens round 1 in the showGrid phase', () => {
    const state = startSession('seed-1');
    expect(state.phase).toBe('showGrid');
    expect(state.profile?.level).toBe('normal');
    expect(state.currentRound).not.toBeNull();
    expect(state.currentRound?.square).toHaveLength(4);
    expect(state.stats).toEqual({
      score: 0,
      roundsPlayed: 0,
      roundsCorrect: 0,
      totalElapsedMs: 0,
      totalBudgetMs: 0,
      bestStreak: 0,
      streak: 0,
      bestRoundTimeMs: Number.POSITIVE_INFINITY,
    });
    expect(state.sessionId).toBe('s1');
    expect(state.startedAtMs).toBe(100);
  });

  it('generates the same round for the same seed (determinism)', () => {
    const a = startSession('det');
    const b = startSession('det');
    expect(a.currentRound).toEqual(b.currentRound);
    const profile = resolveRuleGridDifficulty('normal');
    const params = ruleGridParamsFromProfile(profile);
    expect(a.currentRound).toEqual(
      generateRound({ rng: createRng('det'), roundIndex: 0, params, prevRound: null }),
    );
  });

  it('uses the selected difficulty params', () => {
    const expert = startSession('e', 'expert');
    expect(expert.currentRound?.size).toBe(6);
    const easy = startSession('easy', 'easy');
    expect(easy.currentRound?.size).toBe(3);
  });
});

describe('answer', () => {
  it('scores a correct answer', () => {
    const state = startSession('g');
    const answer = state.currentRound!.answer;
    const after = ruleGridGameReducer(state, { type: 'answer', selectedValue: answer, elapsedMs: 1000 });
    expect(after.phase).toBe('roundResult');
    expect(after.roundCorrect).toBe(true);
    expect(after.roundOutcome).toBe('correct');
    expect(after.stats.roundsCorrect).toBe(1);
    expect(after.stats.score).toBe(roundScore(true, 4));
    expect(after.stats.bestRoundTimeMs).toBe(1000);
  });

  it('scores a wrong answer', () => {
    const state = startSession('g');
    const answer = state.currentRound!.answer;
    const wrong = (answer + 1) % state.currentRound!.size;
    const after = ruleGridGameReducer(state, { type: 'answer', selectedValue: wrong, elapsedMs: 2000 });
    expect(after.phase).toBe('roundResult');
    expect(after.roundCorrect).toBe(false);
    expect(after.roundOutcome).toBe('wrong');
    expect(after.stats.roundsCorrect).toBe(0);
    expect(after.stats.score).toBe(0);
  });

  it('treats a null answer as a timeout', () => {
    const state = startSession('g');
    const after = ruleGridGameReducer(state, { type: 'answer', selectedValue: null, elapsedMs: 3000 });
    expect(after.roundOutcome).toBe('timeout');
    expect(after.roundCorrect).toBe(false);
    expect(after.stats.bestRoundTimeMs).toBe(Number.POSITIVE_INFINITY);
  });

  it('is ignored outside showGrid or while paused', () => {
    const intro = ruleGridGameReducer(createInitialRuleGridState(), {
      type: 'answer',
      selectedValue: 0,
      elapsedMs: 10,
    });
    expect(intro.phase).toBe('intro');
    const paused = ruleGridGameReducer(startSession('g'), { type: 'pause' });
    const afterPause = ruleGridGameReducer(paused, { type: 'answer', selectedValue: 0, elapsedMs: 10 });
    expect(afterPause.phase).toBe('showGrid');
  });
});

describe('next-round', () => {
  it('advances to the next round after answering', () => {
    let state = startSession('next');
    state = ruleGridGameReducer(state, { type: 'answer', selectedValue: state.currentRound!.answer, elapsedMs: 500 });
    state = ruleGridGameReducer(state, { type: 'next-round' });
    expect(state.phase).toBe('showGrid');
    expect(state.roundIndex).toBe(1);
    expect(state.currentRound?.size).toBe(4);
  });

  it('moves to results after the final round', () => {
    let state = startSession('final', 'easy'); // 6 rounds
    for (let round = 0; round < 6; round += 1) {
      state = ruleGridGameReducer(state, {
        type: 'answer',
        selectedValue: state.currentRound!.answer,
        elapsedMs: 100,
      });
      state = ruleGridGameReducer(state, { type: 'next-round' });
    }
    expect(state.phase).toBe('results');
    expect(state.stats.roundsPlayed).toBe(6);
    expect(state.stats.roundsCorrect).toBe(6);
    expect(state.stats.score).toBe(perfectSessionScore(RULE_GRID_DIFFICULTY_PARAMS.easy));
  });
});

describe('pause / resume', () => {
  it('pauses only during a session and resumes from paused', () => {
    const inIntro = ruleGridGameReducer(createInitialRuleGridState(), { type: 'pause' });
    expect(inIntro.paused).toBe(false);
    let state = ruleGridGameReducer(startSession('p'), { type: 'pause' });
    expect(state.paused).toBe(true);
    state = ruleGridGameReducer(state, { type: 'resume' });
    expect(state.paused).toBe(false);
    expect(ruleGridGameReducer(state, { type: 'resume' }).paused).toBe(false);
  });

  it('cannot pause while paused', () => {
    let state = ruleGridGameReducer(startSession('p'), { type: 'pause' });
    state = ruleGridGameReducer(state, { type: 'pause' });
    expect(state.paused).toBe(true);
  });
});

describe('tutorial actions', () => {
  it('opens and closes the tutorial', () => {
    const opened = ruleGridGameReducer(createInitialRuleGridState(), { type: 'tutorial-open' });
    expect(opened.tutorialOpen).toBe(true);
    expect(ruleGridGameReducer(opened, { type: 'tutorial-close' }).tutorialOpen).toBe(false);
  });
});

describe('session finalization + persistence states', () => {
  it('stores the finalization payload', () => {
    const state = ruleGridGameReducer(createInitialRuleGridState(), {
      type: 'session-finalized',
      xp: 12,
      normalized: 0.75,
      activeDurationMs: 30_000,
      pausedDurationMs: 2_000,
      completedAtMs: 30_100,
    });
    expect(state.xp).toBe(12);
    expect(state.normalized).toBe(0.75);
    expect(state.activeDurationMs).toBe(30_000);
  });

  it('tracks persistence progress', () => {
    let state = ruleGridGameReducer(createInitialRuleGridState(), { type: 'persistence-started' });
    expect(state.persistState).toBe('started');
    state = ruleGridGameReducer(state, { type: 'persistence-failed', message: 'boom' });
    expect(state.persistState).toBe('failed');
    expect(state.lastError).toBe('boom');
    expect(ruleGridGameReducer(state, { type: 'persistence-succeeded' }).persistState).toBe('succeeded');
  });
});

describe('QA force hooks (state shaping)', () => {
  it('force-win ends the session as a perfect run', () => {
    const state = ruleGridGameReducer(startSession('qa-win'), { type: 'qa/force-win' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(7);
    expect(state.stats.roundsCorrect).toBe(7);
    expect(state.stats.score).toBe(perfectSessionScore(RULE_GRID_DIFFICULTY_PARAMS.normal));
  });

  it('force-lose ends the session with the current round failed', () => {
    const mid = startSession('qa-lose');
    const state = ruleGridGameReducer(mid, { type: 'qa/force-lose' });
    expect(state.phase).toBe('results');
    expect(state.forced).toBe(true);
    expect(state.stats.roundsPlayed).toBe(1);
    expect(state.stats.roundsCorrect).toBe(0);
    expect(state.stats.streak).toBe(0);
  });

  it('force actions are no-ops in intro/results', () => {
    const intro = ruleGridGameReducer(createInitialRuleGridState(), { type: 'qa/force-win' });
    expect(intro.phase).toBe('intro');
    const results = ruleGridGameReducer(startSession('q'), { type: 'qa/force-win' });
    const after = ruleGridGameReducer(results, { type: 'qa/force-lose' });
    expect(after.phase).toBe('results');
    expect(after.forced).toBe(true);
  });

  it('force-state seeds and sets the difficulty for the next session (intro only)', () => {
    let state = ruleGridGameReducer(createInitialRuleGridState(), {
      type: 'qa/force-state',
      patch: { seed: 'qa-seed-7', difficulty: 'expert' },
    });
    expect(state.seedOverride).toBe('qa-seed-7');
    expect(state.difficulty).toBe('expert');
    state = ruleGridGameReducer(createInitialRuleGridState(), {
      type: 'qa/force-state',
      patch: { seed: 42 },
    });
    expect(state.seedOverride).toBe('42');
    state = ruleGridGameReducer(createInitialRuleGridState(), {
      type: 'qa/force-state',
      patch: { difficulty: 'insane' as DifficultyLevel },
    });
    expect(state.difficulty).toBe('normal');
    const mid = ruleGridGameReducer(startSession('x'), {
      type: 'qa/force-state',
      patch: { seed: 'nope' },
    });
    expect(mid.seedOverride).toBeNull();
  });
});
