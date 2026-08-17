/**
 * MemoryScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → reveal → input → rounds → results →
 * persistence. Pause freeze semantics and the dev-only QA force paths are
 * covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { generateRoundSequence } from '../generator';
import MemoryScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { MemoryRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const REVEAL_MS = 900;

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
    <MemoryScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the reveal timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

describe('MemoryScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'reveal-grid'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'tile', '15'))).toBeOnTheScreen(); // 4×4 grid
    expect(screen.queryByTestId(testId(GAME_ID, 'tile', '16'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = generateRoundSequence({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      length: 3,
      gridSize: 9,
      prevSequence: null,
    });
    // One tick per advance: chained timers only schedule after each render flush.
    for (let tick = 0; tick < 3; tick += 1) {
      await act(async () => {
        jest.advanceTimersByTime(900);
      });
    }
    for (const tile of demo) {
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
    }
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(<MemoryScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // The help button requests a replay.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('skips the tutorial via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'reveal-grid'))).toBeOnTheScreen();

    // normal: 5 rounds, lengths escalate 4→5→6→7→8 on passes.
    let prev: number[] | null = null;
    let length = 4;
    for (let round = 0; round < 5; round += 1) {
      const sequence = generateRoundSequence({
        rng: createRng(seed),
        roundIndex: round,
        length,
        gridSize: 9,
        prevSequence: prev,
      });

      // Reveal: one tick per tile.
      for (let tick = 0; tick < length; tick += 1) {
        await advanceTime(clock, REVEAL_MS);
      }
      expect(screen.getByTestId(testId(GAME_ID, 'input-grid'))).toBeOnTheScreen();
      expect(screen.getByTestId(testId(GAME_ID, 'progress'))).toBeOnTheScreen();

      // Input: repeat the sequence exactly.
      for (const tile of sequence) {
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(tile))));
      }

      if (round < 4) {
        expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
      prev = sequence;
      length += 1;
    }

    // Final round: the result card's button leads to the results screen.
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('5/5');
    expect(screen.getByTestId(testId(GAME_ID, 'longest-sequence'))).toHaveTextContent('8');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('memory');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(30 * REVEAL_MS); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    expect(input.session.normalizedResult).toBeGreaterThan(0);
    expect(input.session.normalizedResult).toBeLessThanOrEqual(1);
    const raw = input.session.rawResult as MemoryRawResult;
    expect(raw.score).toBe(750); // 100+125+150+175+200
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails the round on a wrong tap and continues', async () => {
    const seed = 'wrong-tap';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    for (let tick = 0; tick < 4; tick += 1) {
      await advanceTime(clock, REVEAL_MS);
    }
    expect(screen.getByTestId(testId(GAME_ID, 'input-grid'))).toBeOnTheScreen();

    const sequence = generateRoundSequence({
      rng: createRng(seed),
      roundIndex: 0,
      length: 4,
      gridSize: 9,
      prevSequence: null,
    });
    const wrongTile = (sequence[0] + 1) % 9;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile))));

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-result-grid'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // The next round holds the length after a failure.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    for (let tick = 0; tick < 4; tick += 1) {
      await advanceTime(clock, REVEAL_MS); // length still 4
    }
    expect(screen.getByTestId(testId(GAME_ID, 'input-grid'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and timers freeze until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, REVEAL_MS); // tile 1 flashing; tile 2 timer pending

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId('memory.pause-overlay')).toBeOnTheScreen();

    // Frozen: elapsed background time must not advance the reveal.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'input-grid'))).toBeNull();

    // The full remaining pacing is still required (3 ticks of 900ms).
    await advanceTime(clock, 899);
    expect(screen.queryByTestId(testId(GAME_ID, 'input-grid'))).toBeNull();
    await advanceTime(clock, 1);
    expect(screen.queryByTestId(testId(GAME_ID, 'input-grid'))).toBeNull();
    await advanceTime(clock, REVEAL_MS);
    expect(screen.queryByTestId(testId(GAME_ID, 'input-grid'))).toBeNull();
    await advanceTime(clock, REVEAL_MS);
    expect(screen.getByTestId(testId(GAME_ID, 'input-grid'))).toBeOnTheScreen();
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
    expect((input.session.rawResult as MemoryRawResult).forced).toBe(true);
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
    expect((input.session.rawResult as MemoryRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
