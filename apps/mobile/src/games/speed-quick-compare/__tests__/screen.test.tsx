/**
 * QuickCompareScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the loop: intro → tutorial →
 * active (answer) → feedback → rounds → results → persistence. The dev-only QA
 * force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { quickCompareParamsForLevel } from '../difficulty';
import { generateRound } from '../generator';
import QuickCompareScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { QuickCompareRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const SEED = 'screen-test-seed';
const PARAMS = quickCompareParamsForLevel('normal');
const ROUNDS = PARAMS.rounds;

/** Correct option index for round `roundIndex` of this seed (deterministic). */
function correctIndex(roundIndex: number): number {
  return generateRound(createRng(SEED), roundIndex, PARAMS).correctIndex;
}

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

async function renderScreen(options: { store?: ReturnType<typeof createInMemoryTutorialStore>; persister?: ReturnType<typeof makePersister> } = {}) {
  const clock = createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <QuickCompareScreen clock={clock} tutorialStore={store} sessionSeed={SEED} persistSession={persister} />,
  );
  return { clock, store, persister, result };
}

describe('QuickCompareScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro with difficulty options and starts a session', async () => {
    await renderScreen();

    expect(screen.getByTestId(testId(GAME_ID, 'intro'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId(GAME_ID, 'difficulty', level))).toBeOnTheScreen();
    }

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    expect(screen.getByTestId(testId(GAME_ID, 'comparison'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    // expert uses 4 options
    for (let i = 0; i < 4; i += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'option', String(i)))).toBeOnTheScreen();
    }
  });

  it('opens the tutorial on first play and can skip it', async () => {
    const store = createInMemoryTutorialStore();
    await renderScreen({ store });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('answers a round correctly and advances', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(correctIndex(0)))));

    expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toHaveTextContent('Correct!');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const { persister } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let round = 0; round < ROUNDS; round += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'round', String(round + 1)))).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(correctIndex(round)))));
      expect(screen.getByTestId(testId(GAME_ID, 'verdict'))).toBeOnTheScreen();
      if (round < ROUNDS - 1) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next')));
      }
    }

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'correct'))).toHaveTextContent(`${ROUNDS}/${ROUNDS}`);

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('speed-quick-compare');
    expect(input.session.rawResult).toBeDefined();
    const raw = input.session.rawResult as QuickCompareRawResult;
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(raw.roundsCorrect).toBe(ROUNDS);
    expect(input.session.normalizedResult).toBe(1); // all correct at reaction 0
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as QuickCompareRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session with every round missed', async () => {
    const { persister } = await renderScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'correct'))).toHaveTextContent(`0/${ROUNDS}`);
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as QuickCompareRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
