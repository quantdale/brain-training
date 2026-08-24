/**
 * SentenceBuilderScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → puzzle → rounds → results → persistence.
 * Pause freeze semantics and the dev-only QA force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { SENTENCE_BANK } from '../content/sentence-bank';
import { generateRound } from '../generator';
import SentenceBuilderScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { SentenceBuilderRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const TIME_BUDGET_MS = 25_000;

/** Tutorial store that already completed the tutorial. */
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
      rating: null,
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
    <SentenceBuilderScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/**
 * Generate the session's sentences deterministically, matching the reducer's
 * logic: creates a FRESH rng per round from the same seed, matching the
 * reducer which calls `createRng(state.seed)` for each round.
 */
function generateSessionSentences(
  seed: string,
  rounds: number,
  minWords: number,
  maxWords: number,
) {
  const sentences: {
    original: readonly string[];
    scrambled: readonly string[];
    category: string;
  }[] = [];
  let prevCategory: string | null = null;
  for (let round = 0; round < rounds; round += 1) {
    const rng = createRng(seed);
    const { scrambled } = generateRound({
      rng,
      roundIndex: round,
      bank: SENTENCE_BANK,
      minWords,
      maxWords,
      prevCategory,
      usedCategories: prevCategory !== null ? [prevCategory] : [],
    });
    sentences.push(scrambled);
    prevCategory = scrambled.category;
  }
  return sentences;
}

/** Solve a round by tapping words in correct (original) order. */
async function solveRoundBySentence(scrambled: {
  original: readonly string[];
  scrambled: readonly string[];
}) {
  const gridTestId = testId(GAME_ID, 'word-grid');
  for (let i = 0; i < scrambled.original.length; i += 1) {
    const targetWord = scrambled.original[i];
    const scrambledIdx = scrambled.scrambled.indexOf(targetWord);
    await fireEvent.press(
      screen.getByTestId(`${gridTestId}.word.${scrambledIdx}`),
    );
  }
}

describe('SentenceBuilderScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'word-grid'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'category-hint'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();

    // Step 1: intro → demo
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-grid'))).toBeOnTheScreen();

    // Step 2: demo → done (press without completing the demo)
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-next')));

    // Step 3: done → dismiss
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount must not reopen the tutorial.
    await result.unmount();
    await render(
      <SentenceBuilderScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists', async () => {
    const seed = 'e2e-normal';
    const { persister } = await renderScreen({ seed });

    // Pre-compute the exact session the reducer will generate.
    // The reducer creates a fresh createRng(seed) per round, so we match.
    const sentences = generateSessionSentences(seed, 5, 5, 7);

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'word-grid'))).toBeOnTheScreen();

    // Solve each of the 5 rounds.
    for (let round = 0; round < 5; round += 1) {
      await solveRoundBySentence(sentences[round]);

      expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    }

    // Results screen
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('5/5');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('language-sentence-builder');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBeGreaterThan(0);
    expect(input.session.normalizedResult).toBeLessThanOrEqual(1);
    const raw = input.session.rawResult as SentenceBuilderRawResult;
    expect(raw.score).toBeGreaterThan(0);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.1.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('pauses: the opaque overlay appears and timers freeze until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'word-grid'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('language-sentence-builder.pause-overlay')).toBeOnTheScreen();

    // Timer frozen: advance past the time budget but resume should still show puzzle.
    await advanceTime(clock, TIME_BUDGET_MS + 1000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    // Still in puzzle phase (timer was frozen during pause).
    expect(screen.getByTestId(testId(GAME_ID, 'word-grid'))).toBeOnTheScreen();
  });

  it('timer expiry fails the round', async () => {
    const { clock } = await renderScreen({ seed: 'timer-fail' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, TIME_BUDGET_MS);

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-result'))).toBeOnTheScreen();
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
    const raw = input.session.rawResult as SentenceBuilderRawResult;
    expect(raw.forced).toBe(true);
    // Force-win: all rounds passed perfectly → accuracy=1, normalized ≥ 0.5
    expect(input.session.normalizedResult).toBeGreaterThanOrEqual(0.5);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SentenceBuilderRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
