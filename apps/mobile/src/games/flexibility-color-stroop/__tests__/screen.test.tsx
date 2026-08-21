/**
 * ColorStroopScreen integration tests.
 *
 * Renders the real screen with injected seams and drives the full game loop.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { generateTrials } from '../generator';
import ColorStroopScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { ColorStroopRawResult } from '../types';
import { COLOR_STROOP_DIFFICULTY_PARAMS } from '../difficulty';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(
    async (input: CompleteSessionInput) => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
    }),
  );
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(options: {
  seed?: string;
  store?: ReturnType<typeof createInMemoryTutorialStore>;
  clock?: ReturnType<typeof createFakeClock>;
  persister?: ReturnType<typeof makePersister>;
} = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <ColorStroopScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

describe('ColorStroopScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro with difficulty options and starts a session', async () => {
    await renderScreen({ seed: 'intro' });

    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'help'))).toBeOnTheScreen();
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId(GAME_ID, 'difficulty', level))).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'trial', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(<ColorStroopScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a normal session and shows correct feedback', async () => {
    const seed = 'screen-play';
    const { persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();

    // Play through one trial.
    const firstTrial = screen.getByTestId(testId(GAME_ID, 'stimulus'));
    expect(firstTrial).toBeOnTheScreen();

    // Tap the first answer button (always available).
    const answerButton = screen.getByTestId(testId(GAME_ID, 'answer-buttons-red'));
    await fireEvent.press(answerButton);

    expect(screen.getByTestId(testId(GAME_ID, 'feedback'))).toBeOnTheScreen();
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as ColorStroopRawResult).forced).toBe(true);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'correct-trials'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as ColorStroopRawResult).forced).toBe(true);
  });

  it('a stimulus timeout scores the trial wrong and the session continues', async () => {
    // Regression: the stimulus timer used to dispatch a session-wide timeout
    // that jumped straight to results on the first slow trial.
    await renderScreen({ seed: 'timeout-flow' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();

    // Let the stimulus window lapse without answering.
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    expect(screen.getByTestId(testId(GAME_ID, 'feedback'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'results'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'feedback'))).toHaveTextContent(/Time's up!/);

    // The session continues with the next trial.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-trial')));
    expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();
  });

  it('the rule-flip banner auto-advances to the next stimulus', async () => {
    // Regression: the flipCue phase had no continue affordance in the UI and
    // dead-ended the session at the first rule flip.
    await renderScreen({ seed: 'flip-flow' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert'))); // flips every 2 trials
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    for (let i = 0; i < 2; i += 1) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'answer-buttons-red')));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-trial')));
    }
    expect(screen.getByTestId(testId(GAME_ID, 'flip-cue'))).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.queryByTestId(testId(GAME_ID, 'flip-cue'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'stimulus'))).toBeOnTheScreen();
  });
});