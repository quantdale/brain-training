// Jest globals imported explicitly (repo has no @types/jest).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import CodeCrackerScreen from '../screen';
import { GAME_ID } from '../types';
import { createInMemoryTutorialStore, testId } from '@/sdk';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

describe('CodeCrackerScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro screen with difficulty buttons', async () => {
    await render(
      <CodeCrackerScreen
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
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    // Select easy difficulty
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'easy')));
    // Start the session
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Should be in roundReveal phase
    expect(screen.getByTestId(testId(GAME_ID, 'round-reveal'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeTruthy();
  });

  it('transitions from roundReveal to input', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // Should be in roundReveal
    expect(screen.getByTestId(testId(GAME_ID, 'round-reveal'))).toBeTruthy();
    // Press start guessing
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'reveal-start')));
    // Should now be in input phase
    expect(screen.getByTestId(testId(GAME_ID, 'input'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'submit-guess'))).toBeTruthy();
  });

  it('allows selecting colors and submitting a guess', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'reveal-start')));
    // Select 4 colors (normal difficulty has codeLength: 4)
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', '0')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', '1')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', '2')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'color', '3')));
    // Submit the guess
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit-guess')));
    // Should show guess history
    expect(screen.getByTestId(testId(GAME_ID, 'guess-history'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'history-row', '0'))).toBeTruthy();
  });

  it('shows QA panel in dev mode', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'qa-toggle'))).toBeTruthy();
  });

  it('opens tutorial', async () => {
    await render(
      <CodeCrackerScreen
        tutorialStore={completedStore()}
        sessionSeed="test-seed"
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeTruthy();
  });
});
