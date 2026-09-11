/**
 * WordScrambleScreen integration tests — full loop with injected seams.
 *
 * Added at campaign 009 convergence: this was the only catalog module without
 * a screen suite (flagged by the test-infrastructure audit); the cases mirror
 * the sibling language-game screen tests (context-fit / word-chain).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  testId,
} from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { generateRound } from '../generator';
import { Tutorial } from '../components/tutorial';
import {
  ADAPTIVE_PARAMS,
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
  it('persists the final adaptive challenge rating in the session record', async () => {
    // Regression: the record difficulty kept the SDK adaptive baseline (0.5)
    // instead of the computed final challenge rating.
    const { persister } = await renderScreen({ seed: 'adaptive-rating' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'adaptive')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // One passed adaptive round escalates optionsCount 4 → 5, moving the
    // final computed rating off the neutral baseline.
    const round0 = generateRound({
      rng: createRng('adaptive-rating'),
      roundIndex: 0,
      optionsCount: ADAPTIVE_PARAMS.optionsCount,
      minWordLength: ADAPTIVE_PARAMS.minWordLength,
      maxWordLength: ADAPTIVE_PARAMS.maxWordLength,
      prevAnswer: null,
    });
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(round0.correctIndex))),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as { challengeRating: number };
    const difficulty = input.session.difficulty as { challengeRating: number };
    expect(difficulty.challengeRating).toBeCloseTo(raw.challengeRating);
    expect(difficulty.challengeRating).not.toBe(0.5);
  });

  it('marks the wrong pick and the correct word with the scrambled stem visible', async () => {
    const seed = 'verdict-stem';
    await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'normal')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    const expected = expectedRound(seed, 0, null);
    const wrongIndex = (expected.correctIndex + 1) % expected.options.length;
    // Live score is visible while the round is answerable.
    expect(screen.getByTestId(testId(GAME_ID, 'score', 'live'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));

    // Verdict headline + panel, derived from the reducer's resolved outcome.
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-feedback'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-answer-reveal'))).toHaveTextContent(
      `Answer: ${expected.answer}`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'round-why'))).toHaveTextContent(
      `"${expected.scrambled}" unscrambles to "${expected.answer}"`,
    );
    // The scrambled stem stays mounted while feedback shows.
    expect(screen.getByTestId(testId(GAME_ID, 'scrambled-word'))).toHaveTextContent(
      expected.scrambled.toUpperCase(),
    );
    // Multi-channel verdict: correct option and wrong pick read in words.
    expect(
      screen.getByLabelText(`Correct: ${expected.options[expected.correctIndex]}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`Wrong pick: ${expected.options[wrongIndex]}`),
    ).toBeOnTheScreen();
  });

  it('tutorial copy matches the untimed mechanics (no speed bonus, no expiry)', async () => {
    await render(<Tutorial onComplete={() => {}} />);
    // Longer words score more; nothing rewards speed and rounds never end.
    expect(screen.getByText(/Longer words earn more points/)).toBeOnTheScreen();
    expect(screen.getByText(/rounds never expire/)).toBeOnTheScreen();
    expect(screen.queryByText(/bonus points/)).toBeNull();
    expect(screen.queryByText(/expire on their own/)).toBeNull();
  });
});
