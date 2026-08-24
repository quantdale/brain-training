/**
 * WordScrambleScreen integration tests — full loop with injected seams.
 *
 * Added at campaign 009 convergence: this was the only catalog module without
 * a screen suite (flagged by the test-infrastructure audit); the cases mirror
 * the sibling language-game screen tests (context-fit / word-chain).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  testId,
} from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { generateRound } from '../generator';
import {
  resolveWordScrambleDifficulty,
  wordScrambleParamsFromProfile,
} from '../difficulty';
import { GAME_ID } from '../types';
import type { WordScrambleRound } from '../types';
import WordScrambleScreen from '../screen';
import type { SessionPersistence } from '../session';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = wordScrambleParamsFromProfile(resolveWordScrambleDifficulty('normal'));
const NORMAL_ROUNDS = NORMAL.rounds;

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: 0,
  }));
  return { completeSession } as SessionPersistence & { completeSession: jest.Mock };
}

async function renderScreen(
  options: {
    seed?: string;
    store?: ReturnType<typeof createInMemoryTutorialStore>;
    clock?: ReturnType<typeof createFakeClock>;
    persister?: ReturnType<typeof makePersister>;
  } = {},
) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <WordScrambleScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Reproduce the reducer's deterministic round sequence for a fixed level. */
function expectedRound(seed: string, roundIndex: number, prevAnswer: string | null): WordScrambleRound {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    optionsCount: NORMAL.optionsCount,
    minWordLength: NORMAL.minWordLength,
    maxWordLength: NORMAL.maxWordLength,
    prevAnswer,
  });
}

describe('WordScrambleScreen', () => {
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
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId(GAME_ID, 'difficulty', level))).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    for (let i = 0; i < NORMAL.optionsCount; i += 1) {
      expect(screen.getByTestId(testId(GAME_ID, 'option', String(i)))).toBeOnTheScreen();
    }
    expect(screen.getByTestId(testId(GAME_ID, 'submit'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play and the dev-only QA button skips it', async () => {
    const store = createInMemoryTutorialStore();
    await renderScreen({ seed: 'tut', store });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const { persister } = await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    let prevAnswer: string | null = null;
    for (let round = 0; round < NORMAL_ROUNDS; round += 1) {
      const expected = expectedRound(seed, round, prevAnswer);
      prevAnswer = expected.answer;
      expect(screen.getByTestId(testId(GAME_ID, 'round', String(round + 1)))).toBeOnTheScreen();
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'option', String(expected.correctIndex))),
      );
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
      if (round < NORMAL_ROUNDS - 1) {
        expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }
    // Last round answered -> round result; advancing lands on results.
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
  });

  it('force-win jumps to a perfect results screen with the forced badge', async () => {
    await renderScreen({ seed: 'force-win' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    // The QA panel mounts in-session; from intro the reducer ignores force
    // states by design.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
  });

  it('pause obscures the round and resume returns to the question', async () => {
    await renderScreen({ seed: 'pause' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    // While paused the challenge is obscured (no option buttons reachable).
    expect(screen.queryByTestId(testId(GAME_ID, 'submit'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.getByTestId(testId(GAME_ID, 'submit'))).toBeOnTheScreen();
  });
});
