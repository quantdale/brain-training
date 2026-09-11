/**
 * ContextFitScreen integration tests — full loop with injected seams.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { loadContentPack } from '../content-validation';
import { filterByTiers, selectRound } from '../generator';
import type { ContextFitRound } from '../types';
import ContextFitScreen from '../screen';
import type { SessionPersistence } from '../session';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL_POOL = filterByTiers(loadContentPack().items, ['t1', 't2']);

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState('language-context-fit', { completed: true, replayRequested: false, version: '1.0.0' });
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

async function renderScreen(options: { seed?: string; store?: ReturnType<typeof createInMemoryTutorialStore>; clock?: ReturnType<typeof createFakeClock>; persister?: ReturnType<typeof makePersister> } = {}) {
  const clock = options.clock ?? createFakeClock(0);
  const store = options.store ?? completedStore();
  const persister = options.persister ?? makePersister();
  const result = await render(
    <ContextFitScreen clock={clock} tutorialStore={store} sessionSeed={options.seed ?? 'screen-test-seed'} persistSession={persister} />,
  );
  return { clock, store, persister, result };
}

async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

function expectedRound(seed: string, roundIndex: number, used: ReadonlySet<string>, previous: ContextFitRound | null): ContextFitRound {
  return selectRound({ rng: createRng(seed), roundIndex, pool: NORMAL_POOL, usedItemIds: used, previousRound: previous });
}

describe('ContextFitScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the intro with difficulty options and starts a session', async () => {
    await renderScreen({ seed: 'intro' });
    expect(screen.getByTestId(testId('language-context-fit', 'intro'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId('language-context-fit', 'start'))).toBeOnTheScreen();
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(screen.getByTestId(testId('language-context-fit', 'difficulty', level))).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'difficulty', 'expert')));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'start')));
    expect(screen.getByTestId(testId('language-context-fit', 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId('language-context-fit', 'context'))).toBeOnTheScreen();
    for (let i = 0; i < 4; i += 1) {
      expect(screen.getByTestId(testId('language-context-fit', 'option', String(i)))).toBeOnTheScreen();
    }
  });

  it('opens the tutorial on first play and completes it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });
    expect(screen.getByTestId(testId('language-context-fit', 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'tutorial-next')));
    const demo = selectRound({ rng: createRng(TUTORIAL_DEMO_SEED), roundIndex: 0, pool: filterByTiers(loadContentPack().items, ['t1']), usedItemIds: new Set(), previousRound: null });
    expect(screen.getByTestId(testId('language-context-fit', 'tutorial-context'))).toHaveTextContent(demo.context);
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'option', String(demo.correctIndex))));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'tutorial-done')));
    expect(screen.getByTestId(testId('language-context-fit', 'start'))).toBeOnTheScreen();
    await result.unmount();
    await render(<ContextFitScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
    expect(screen.queryByTestId(testId('language-context-fit', 'tutorial'))).toBeNull();
  });

  it('skips the tutorial via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId('language-context-fit', 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'tutorial-skip')));
    expect(screen.getByTestId(testId('language-context-fit', 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const { clock, persister } = await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'start')));

    let previous: ContextFitRound | null = null;
    const used = new Set<string>();
    for (let round = 0; round < 6; round += 1) {
      const expected = expectedRound(seed, round, used, previous);
      used.add(expected.itemId);
      previous = expected;
      await advanceTime(clock, 500);
      expect(screen.getByTestId(testId('language-context-fit', 'context'))).toHaveTextContent(expected.context);
      await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'option', String(expected.correctIndex))));
      if (round < 5) {
        expect(screen.getByTestId(testId('language-context-fit', 'round-correct'))).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'next-round')));
      }
    }
    // last round answered -> roundResult; advance to results
    expect(screen.getByTestId(testId('language-context-fit', 'round-correct'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'next-round')));
    expect(screen.getByTestId(testId('language-context-fit', 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId('language-context-fit', 'accuracy'))).toHaveTextContent('100%');
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
  });

  it('force-win jumps to a perfect results screen', async () => {
    await renderScreen({ seed: 'force-win' });
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'start')));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'force-win')));
    expect(screen.getByTestId(testId('language-context-fit', 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId('language-context-fit', 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId('language-context-fit', 'accuracy'))).toHaveTextContent('100%');
  });

  it('force-lose jumps to a failed results screen', async () => {
    await renderScreen({ seed: 'force-lose' });
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'start')));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'force-lose')));
    expect(screen.getByTestId(testId('language-context-fit', 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId('language-context-fit', 'forced-badge'))).toBeOnTheScreen();
  });

  it('pause freezes the round and resume returns to the question', async () => {
    const { clock } = await renderScreen({ seed: 'pause' });
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'start')));
    await advanceTime(clock, 200);
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'pause')));
    // while paused the challenge is obscured; resuming restores the question
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'resume')));
    expect(screen.getByTestId(testId('language-context-fit', 'context'))).toBeOnTheScreen();
  });
  it('persists the final adaptive challenge rating in the session record', async () => {
    // Regression: the record difficulty kept the SDK adaptive baseline (0.5)
    // instead of the computed final challenge rating.
    const { persister } = await renderScreen({ seed: 'adaptive-rating' });

    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'difficulty', 'adaptive')));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'start')));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'force-win')));
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as { challengeRating: number };
    const difficulty = input.session.difficulty as { challengeRating: number };
    expect(difficulty.challengeRating).toBeCloseTo(raw.challengeRating);
    expect(difficulty.challengeRating).not.toBe(0.5);
  });

  it('marks the wrong pick and the correct word together with the stem visible', async () => {
    const seed = 'verdict-stem';
    const { clock } = await renderScreen({ seed });
    await fireEvent.press(screen.getByTestId(testId('language-context-fit', 'start')));

    const expected = expectedRound(seed, 0, new Set(), null);
    await advanceTime(clock, 500);
    const wrongIndex = (expected.correctIndex + 1) % expected.options.length;
    await fireEvent.press(
      screen.getByTestId(testId('language-context-fit', 'option', String(wrongIndex))),
    );

    // Verdict headline + panel, derived from the reducer's resolved outcome.
    expect(screen.getByTestId(testId('language-context-fit', 'round-wrong'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId('language-context-fit', 'round-feedback'))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId('language-context-fit', 'round-answer-reveal')),
    ).toHaveTextContent(`The answer was ${expected.correctWord}`);
    expect(screen.getByTestId(testId('language-context-fit', 'round-why'))).toBeOnTheScreen();
    // The stem stays visible while feedback shows.
    expect(screen.getByTestId(testId('language-context-fit', 'context'))).toHaveTextContent(
      expected.context,
    );
    // Multi-channel verdict: the correct option and the wrong pick both read
    // in words via the accessible name, never colour alone.
    expect(
      screen.getByLabelText(`Correct: ${expected.options[expected.correctIndex]}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`Wrong pick: ${expected.options[wrongIndex]}`),
    ).toBeOnTheScreen();
  });
});
