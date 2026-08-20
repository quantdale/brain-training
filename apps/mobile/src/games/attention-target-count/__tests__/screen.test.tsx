// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TargetCountScreen from '../screen';
import { GAME_ID } from '../types';
import type { TargetCountRound } from '../types';
import { TARGET_COUNT_DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import type { SessionPersistence } from '../session';
import type { CompleteSessionResult } from '@/db';
import { createRng, testId } from '@/sdk';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const { createInMemoryTutorialStore } = require('@/sdk');
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

/** Replicate the reducer's deterministic round generation to know correct answers. */
function sessionRounds(seed: string, level: keyof typeof TARGET_COUNT_DIFFICULTY_PARAMS = 'normal'): TargetCountRound[] {
  const rng = createRng(seed);
  const params = TARGET_COUNT_DIFFICULTY_PARAMS[level];
  const rounds: TargetCountRound[] = [];
  let prev = null as TargetCountRound | null;
  for (let r = 0; r < params.rounds; r += 1) {
    const round = generateRound({ rng, roundIndex: r, params, prevRound: prev });
    rounds.push(round);
    prev = round;
  }
  return rounds;
}

describe('TargetCountScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the intro screen with difficulty buttons', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'screen'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'hard'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert'))).toBeTruthy();
  });

  it('selects difficulty and starts a session', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'show-grid'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'grid'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'target-prompt'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'count-options'))).toBeTruthy();
  });

  it('pressing the correct count shows a correct round result', async () => {
    const rounds = sessionRounds('test-seed', 'normal');
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(rounds[0].targetCount))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'actual-count'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'next-round'))).toBeTruthy();
  });

  it('pressing a wrong count shows a wrong round result', async () => {
    const rounds = sessionRounds('test-seed', 'normal');
    const correct = rounds[0].targetCount;
    const wrong = rounds[0].options.find((o) => o !== correct) ?? -1;
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(wrong))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeTruthy();
  });

  it('drives a full session to results and finalizes', async () => {
    const rounds = sessionRounds('full-seed', 'normal'); // matches the default 'normal' difficulty
    let resolvePersist: (r: CompleteSessionResult) => void = () => {};
    const persistSession: SessionPersistence = {
      completeSession: jest.fn(
        () =>
          new Promise<CompleteSessionResult>((res) => {
            resolvePersist = res;
          }),
      ),
    };
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="full-seed"
        persistSession={persistSession}
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let r = 0; r < rounds.length; r += 1) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'count-option', String(rounds[r].targetCount))));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-correct'))).toBeTruthy();

    // Resolve persistence and let the success dispatch land inside act.
    await act(async () => {
      resolvePersist({
        session: {} as never,
        ledgerEntry: null,
        balance: 0,
        rating: null,
        completionOutcome: null,
      });
      await Promise.resolve();
    });
  });

  it('shows QA panel in dev mode', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'qa-toggle'))).toBeTruthy();
  });

  it('opens tutorial', async () => {
    await render(
      <TargetCountScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeTruthy();
  });
});
