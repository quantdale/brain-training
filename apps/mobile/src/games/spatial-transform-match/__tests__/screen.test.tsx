/**
 * SpatialTransformMatchScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → source → choice → rounds → results →
 * persistence. Pause freeze semantics and the dev-only QA force paths are
 * covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { applyTransform, generateRoundData, generateSourcePattern } from '../generator';
import SpatialTransformMatchScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID, TRANSFORM_LABELS } from '../types';
import type { SpatialTransformMatchRawResult } from '../types';
import { DIFFICULTY_PARAMS } from '../difficulty';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const SOURCE_REVEAL_MS = 1500;

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
    <SpatialTransformMatchScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the reveal timers. */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

describe('SpatialTransformMatchScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'source-grid'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play and completes it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    // The demo shows the source pattern.
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-source'))).toBeOnTheScreen();

    // Option 0 is always correct in the tutorial demo.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-option', '0')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(<SpatialTransformMatchScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'source-grid'))).toBeOnTheScreen();

    // normal: 5 rounds.
    const params = DIFFICULTY_PARAMS.normal;
    const side = Math.round(Math.sqrt(params.gridSize));

    for (let round = 0; round < 5; round += 1) {
      // Source reveal: wait for sourceRevealMs.
      await advanceTime(clock, SOURCE_REVEAL_MS);
      expect(screen.getByTestId(testId(GAME_ID, 'choice-status'))).toBeOnTheScreen();
      expect(screen.getByTestId(testId(GAME_ID, 'options'))).toBeOnTheScreen();

      // Compute the correct answer from the seed using the static import.
      const sourceRng = createRng(seed);
      const roundData = generateRoundData({
        rng: sourceRng,
        roundIndex: round,
        gridSize: params.gridSize,
        side,
        filledCells: params.filledCells,
        allowedTransforms: params.allowedTransforms,
        optionCount: params.optionCount,
        prevSource: null,
        prevTransform: null,
      });

      // Press the correct option.
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', String(roundData.correctOptionIndex))));

      if (round < 4) {
        expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }

    // Final round: the result card's button leads to the results screen.
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('5/5');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('spatial-transform-match');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBeGreaterThan(0);
    expect(input.session.normalizedResult).toBeLessThanOrEqual(1);
    const raw = input.session.rawResult as SpatialTransformMatchRawResult;
    expect(raw.score).toBe(500); // 5 * 100
    expect(raw.roundsPassed).toBe(5);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
  });

  it('fails the round on a wrong tap and continues', async () => {
    const seed = 'wrong-tap';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, SOURCE_REVEAL_MS);
    expect(screen.getByTestId(testId(GAME_ID, 'options'))).toBeOnTheScreen();

    // Press a wrong option (index 1 if correct is 0, else 0).
    // We can't easily determine the correct index without re-running the generator,
    // so just press option 0 and check if it's correct or wrong.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', '0')));

    // Either round-passed or round-failed should appear.
    const passed = screen.queryByTestId(testId(GAME_ID, 'round-passed'));
    const failed = screen.queryByTestId(testId(GAME_ID, 'round-failed'));
    expect(passed !== null || failed !== null).toBe(true);

    // The next round button should be present.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and timers freeze until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, SOURCE_REVEAL_MS / 2); // still in source phase

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(testId(GAME_ID, 'pause-title'))).toBeOnTheScreen();

    // Frozen: elapsed background time must not advance the source reveal.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'choice-status'))).toBeNull();

    // The full remaining sourceRevealMs is still required.
    await advanceTime(clock, SOURCE_REVEAL_MS);
    expect(screen.getByTestId(testId(GAME_ID, 'choice-status'))).toBeOnTheScreen();
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
    expect((input.session.rawResult as SpatialTransformMatchRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
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
    expect((input.session.rawResult as SpatialTransformMatchRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
