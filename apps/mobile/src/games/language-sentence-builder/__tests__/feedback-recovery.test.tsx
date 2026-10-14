import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import { Colors } from '@/constants/theme';
import type { CompleteSessionInput } from '@/db';

import { SENTENCE_BANK } from '../content/sentence-bank';
import { WordChips } from '../components/word-grid';
import { DIFFICULTY_PARAMS } from '../difficulty';
import { generateRound } from '../generator';
import { sentenceBuilderReducer } from '../reducer';
import SentenceBuilderScreen from '../screen';
import { createInitialState, GAME_ID } from '../types';
import type { SentenceBuilderRawResult } from '../types';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'dark' }));

const WORDS = ['One', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function partialRoundState() {
  const started = sentenceBuilderReducer(createInitialState(), {
    type: 'start-session', seed: 'partial', sessionId: 'partial', startedAtMs: 0,
  });
  return {
    ...started,
    scrambled: {
      original: WORDS, scrambled: WORDS, scrambleOrder: WORDS.map((_, index) => index),
      acceptedOrders: [WORDS], category: 'simple',
    },
  };
}

describe('Sentence Builder honest partial outcomes', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('retains partial points without counting an incomplete order as a passed sentence', () => {
    let state = partialRoundState();
    for (let index = 0; index < 8; index += 1) {
      state = sentenceBuilderReducer(state, { type: 'tap-word', index }) as typeof state;
    }
    state = sentenceBuilderReducer(state, { type: 'tap-word', index: 9 }) as typeof state;
    expect(state.roundOutcome).toBe('partial');
    expect(state.stats.score).toBe(50);
    expect(state.stats.roundsPassed).toBe(0);
    expect(state.stats.streak).toBe(0);
    expect(state.stats.totalTaps).toBe(9);
    expect(state.stats.correctTaps).toBe(8);
  });

  it('does not consume the same physical word tile twice', () => {
    const state = sentenceBuilderReducer(partialRoundState(), { type: 'tap-word', index: 0 });
    expect(sentenceBuilderReducer(state, { type: 'tap-word', index: 0 })).toBe(state);
    expect(sentenceBuilderReducer(state, { type: 'tap-word', index: -1 })).toBe(state);
  });

  it('preserves actual input counts if time runs out after a correct prefix', () => {
    let state = partialRoundState();
    state = sentenceBuilderReducer(state, { type: 'tap-word', index: 0 }) as typeof state;
    state = sentenceBuilderReducer(state, { type: 'timer-expired' }) as typeof state;
    expect(state.stats.totalTaps).toBe(1);
    expect(state.stats.correctTaps).toBe(1);
    expect(state.stats.score).toBe(0);
  });

  it('shows partial credit and persists an incomplete result through the real game caller', async () => {
    const params = DIFFICULTY_PARAMS.expert;
    const candidate = Array.from({ length: 100 }, (_, index) => `partial-caller-${index}`)
      .map((seed) => ({
        seed,
        round: generateRound({
          rng: createRng(seed), roundIndex: 0, bank: SENTENCE_BANK,
          minWords: params.minWords, maxWords: params.maxWords,
          prevCategory: null, usedCategories: [],
        }).scrambled,
      }))
      .find(({ round }) => round.original.length >= 10 && new Set(round.original.map((w) => w.toLowerCase())).size === round.original.length)!;
    expect(candidate).toBeDefined();
    const store = createInMemoryTutorialStore();
    store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
    const clock = createFakeClock();
    const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
      session: input.session, ledgerEntry: null, balance: 0, rating: null, completionOutcome: null,
    }));
    await render(
      <SentenceBuilderScreen
        clock={clock} tutorialStore={store} sessionSeed={candidate.seed}
        persistSession={{ completeSession }}
      />,
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const { original, scrambled } = candidate.round;
    for (const word of original.slice(0, -2)) {
      await fireEvent.press(screen.getByTestId(`${testId(GAME_ID, 'word-grid')}.word.${scrambled.indexOf(word)}`));
    }
    await fireEvent.press(screen.getByTestId(`${testId(GAME_ID, 'word-grid')}.word.${scrambled.indexOf(original[original.length - 1])}`));
    expect(screen.getByTestId(testId(GAME_ID, 'round-partial'))).toHaveTextContent('Partial credit');
    expect(screen.queryByTestId(testId(GAME_ID, 'round-passed'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round-answer-reveal'))).toHaveTextContent(`Correct order: ${original.join(' ')}`);
    expect(screen.getByTestId(testId(GAME_ID, 'round-points'))).toHaveTextContent('+50 points');
    expect(screen.getByTestId(testId(GAME_ID, 'round-why'))).toHaveTextContent(/Incomplete order/);

    for (let round = 1; round < params.rounds; round += 1) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      await act(async () => {
        clock.advance(params.timeBudgetMs);
        jest.advanceTimersByTime(params.timeBudgetMs);
      });
      expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
      expect(screen.getByTestId(testId(GAME_ID, 'round-points'))).toHaveTextContent('+0 points');
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent(`0/${params.rounds}`);
    expect(completeSession).toHaveBeenCalledTimes(1);
    const record = completeSession.mock.calls[0][0].session;
    const raw = record.rawResult as SentenceBuilderRawResult;
    expect(raw.score).toBe(50);
    expect(raw.roundsPassed).toBe(0);
    expect(raw.bestStreak).toBe(0);
    expect(raw.accuracy).toBe(0);
    expect(record.normalizedResult).toBe(0);
    expect(raw.scoringVersion).toBe('1.2.0');
    expect(record.scoringVersion).toBe(1_002_000);
  });

  it('uses the language on-fill ink for dark-mode word chips', async () => {
    await render(<WordChips words={['readable']} tappedIndices={[]} testID="ink" onTapWord={() => {}} />);
    expect(within(screen.getByTestId('ink.word.0')).getByText('readable')).toHaveStyle({ color: Colors.dark.languageOn });
  });
});
