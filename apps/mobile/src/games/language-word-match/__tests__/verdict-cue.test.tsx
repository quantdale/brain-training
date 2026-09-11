/**
 * Verdict-cue contract (PATTERNS-PLAY 6) for Word Match.
 *
 * After a wrong pick the tapped option must show the wrong cue (✕ glyph +
 * "Wrong pick" accessible name) AND the true answer must show the correct
 * cue (✓ glyph + "Correct" accessible name) at the same time; the wrong
 * option must never expose the correct cue or name.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';

import type { CompleteSessionInput } from '@/db';
import { filterByTiers, selectRound } from '../generator';
import { loadContentPack } from '../content-validation';
import type { LanguageRound } from '../types';
import LanguageWordMatchScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL_POOL = filterByTiers(loadContentPack().items, ['t1', 't2']);

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

async function renderScreen(options: { seed?: string } = {}) {
  const clock = createFakeClock(0);
  const store = completedStore();
  const persister = makePersister();
  const result = await render(
    <LanguageWordMatchScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'verdict-cue'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the round timers (RNTL act is async). */
async function advanceTime(clock: { advance: (ms: number) => void }, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Deterministic mirror of the reducer's round generation for a fixed pool. */
function expectedRound(
  seed: string,
  roundIndex: number,
  used: ReadonlySet<string>,
  previous: LanguageRound | null,
): LanguageRound {
  return selectRound({
    rng: createRng(seed),
    roundIndex,
    pool: NORMAL_POOL,
    usedItemIds: used,
    previousRound: previous,
  });
}

describe('LanguageWordMatchScreen verdict cues', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a wrong pick marks the wrong option AND the correct option together', async () => {
    const seed = 'verdict-cue';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const round = expectedRound(seed, 0, new Set(), null);
    await advanceTime(clock, 1000);
    const wrongIndex = (round.correctIndex + 1) % 4;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();

    const wrongOption = screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex)));
    const correctOption = screen.getByTestId(
      testId(GAME_ID, 'option', String(round.correctIndex)),
    );

    // Wrong cue on the tapped option …
    expect(within(wrongOption).getByText('✕')).toBeOnTheScreen();
    expect(wrongOption.props.accessibilityLabel).toMatch(/Wrong pick/);
    // … correct cue alongside it on the true answer …
    expect(within(correctOption).getByText('✓')).toBeOnTheScreen();
    expect(correctOption.props.accessibilityLabel).toMatch(/Correct/);
    // … and the wrong option never reads as correct.
    expect(within(wrongOption).queryByText('✓')).toBeNull();
    expect(wrongOption.props.accessibilityLabel).not.toMatch(/Correct/);
    // Untouched options read as locked, not as verdicts.
    for (let index = 0; index < 4; index += 1) {
      if (index === wrongIndex || index === round.correctIndex) continue;
      const muted = screen.getByTestId(testId(GAME_ID, 'option', String(index)));
      expect(muted.props.accessibilityLabel).toMatch(/locked/);
      expect(within(muted).queryByText('✓')).toBeNull();
      expect(within(muted).queryByText('✕')).toBeNull();
    }
  });

  it('explains the answer in one line without covering the prompt', async () => {
    const seed = 'verdict-why';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const round = expectedRound(seed, 0, new Set(), null);
    await advanceTime(clock, 1000);
    const wrongIndex = (round.correctIndex + 1) % 4;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))));

    // The reveal keeps its contract, and the why-line restates the prompt
    // stem (which the question view unmounts) next to the answer.
    expect(screen.getByTestId(testId(GAME_ID, 'round-answer-reveal'))).toHaveTextContent(
      `The answer was ${round.correctWord}`,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'round-why'))).toHaveTextContent(
      new RegExp(`${round.correctWord}.*${round.prompt}`),
    );
  });
});
