/**
 * OddOneOutScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → tutorial → playing (countdown, taps, penalties,
 * timeout) → roundResult → results → persistence. Pause freeze semantics and
 * the dev-only QA force paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import {
  ADAPTIVE_PARAMS,
  ODD_ONE_OUT_DIFFICULTY_PARAMS,
  effectiveParamsForStep,
  escalateStep,
} from '../difficulty';
import { generateBoard } from '../generator';
import OddOneOutScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { OddOneOutBoard, OddOneOutRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false });
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
    <OddOneOutScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

/** Advance both the fake lifecycle clock and the countdown timers (RNTL act is async). */
async function advanceTime(clock: ReturnType<typeof createFakeClock>, ms: number) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/**
 * Replicate the reducer's board stream for a fixed level so the test knows
 * each round's odd tile (mirrors the escalation logic in difficulty.ts).
 */
function boardsForSession(seed: string, level: keyof typeof ODD_ONE_OUT_DIFFICULTY_PARAMS): OddOneOutBoard[] {
  const params = ODD_ONE_OUT_DIFFICULTY_PARAMS[level];
  const boards: OddOneOutBoard[] = [];
  let step = 0;
  let prev: OddOneOutBoard | null = null;
  for (let round = 0; round < params.rounds; round += 1) {
    const effective = effectiveParamsForStep(params, step);
    const board = generateBoard({
      rng: createRng(seed),
      roundIndex: round,
      subtlety: effective.subtlety,
      gridSize: effective.gridSize,
      prevBoard: prev,
    });
    boards.push(board);
    prev = board;
    step = escalateStep(step, true, level, params);
  }
  return boards;
}

describe('OddOneOutScreen', () => {
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

    expect(screen.getByTestId(testId(GAME_ID, 'board'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'tile', '15'))).toBeOnTheScreen(); // 4×4 grid
    expect(screen.queryByTestId(testId(GAME_ID, 'tile', '16'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'time-left'))).toHaveTextContent('8.0s');
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    // The demo board is deterministic; tap its odd item.
    const demoBoard = generateBoard({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      subtlety: 0,
      gridSize: 9,
      prevBoard: null,
    });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(demoBoard.oddIndex))));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // A fresh mount with the same store must not reopen the tutorial.
    await result.unmount();
    await render(<OddOneOutScreen clock={createFakeClock()} tutorialStore={store} sessionSeed="tut" />);
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // The help button requests a replay.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('replays the demo on a wrong tap and skips via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demoBoard = generateBoard({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      subtlety: 0,
      gridSize: 9,
      prevBoard: null,
    });
    const wrongTile = (demoBoard.oddIndex + 1) % 9;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrongTile))));
    // The demo remounts (new attempt) and is still tappable.
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'board'))).toBeOnTheScreen();

    // normal: 6 rounds, steps 0,1,2,2,2 — all solved first-try after 2s each.
    const boards = boardsForSession(seed, 'normal');
    for (let round = 0; round < 6; round += 1) {
      await advanceTime(clock, 2_000);
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'tile', String(boards[round].oddIndex))),
      );
      if (round < 5) {
        expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }

    // Final round: the result card's button leads to the results screen.
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('6/6');
    expect(screen.getByTestId(testId(GAME_ID, 'first-try-rate'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('750');
    expect(screen.getByTestId(testId(GAME_ID, 'timeouts'))).toHaveTextContent('0');

    // Flush the async persistence chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe(GAME_ID);
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBe(6 * 2_000); // active play time only
    expect(input.session.xp).toBe(0); // no-op hook in Phase 1
    // All first-try, mean solve ratio 2000/(12000,10500,9000×4) ≈ 0.2077 →
    // normalized ≈ 0.896.
    expect(input.session.normalizedResult).toBeGreaterThan(0);
    expect(input.session.normalizedResult).toBeLessThan(1);
    expect(input.session.normalizedResult).toBeCloseTo(0.8962, 3);
    const raw = input.session.rawResult as OddOneOutRawResult;
    expect(raw.score).toBe(750);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('penalizes wrong taps, keeps the round running, and loses the first-try bonus', async () => {
    const seed = 'wrong-tap';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const boards = boardsForSession(seed, 'normal');

    // Round 1: one wrong tap (score clamps at 0), then the odd item.
    await advanceTime(clock, 2_000);
    const wrong1 = (boards[0].oddIndex + 1) % 9;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrong1))));
    expect(screen.getByTestId(testId(GAME_ID, 'playing-status'))).toBeOnTheScreen(); // still playing
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(boards[0].oddIndex))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 100'); // no bonus

    // Round 2: a wrong tap now visibly deducts from the positive score.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    await advanceTime(clock, 2_000);
    const wrong2 = (boards[1].oddIndex + 1) % 9;
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(wrong2))));
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 75');
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(boards[1].oddIndex))));
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 175');
  });

  it('times out when the window expires and reveals the odd item', async () => {
    const seed = 'timeout';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 12_000 + 100); // normal round 1 window is 12s

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'round-result-board'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('Score 0');

    // The next round starts with the step held (still subtlety 0).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();

    // Finish via the QA force-lose path: the in-flight round counts as failed.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/2');
    expect(screen.getByTestId(testId(GAME_ID, 'timeouts'))).toHaveTextContent('2');
  });

  it('pauses: the opaque overlay appears and the countdown freezes until resume', async () => {
    const { clock, persister } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 1_000); // window 12s → 11.0s left
    expect(screen.getByTestId(testId(GAME_ID, 'time-left'))).toHaveTextContent('11.0s');

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(`${GAME_ID}.pause-overlay`)).toBeOnTheScreen();

    // Frozen: elapsed background time must not advance the countdown. While
    // paused the board is hidden from the accessibility tree, so the query
    // opts back into hidden elements.
    await advanceTime(clock, 5_000);
    expect(
      screen.getByTestId(testId(GAME_ID, 'time-left'), { includeHiddenElements: true }),
    ).toHaveTextContent('11.0s');

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(`${GAME_ID}.pause-overlay`)).toBeNull();

    // The full remainder is still required (10999ms leaves 1ms → 0.0s display).
    await advanceTime(clock, 10_999);
    expect(screen.getByTestId(testId(GAME_ID, 'time-left'))).toHaveTextContent('0.0s');
    expect(screen.queryByTestId(testId(GAME_ID, 'round-failed'))).toBeNull();
    await advanceTime(clock, 1);
    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();

    // Paused time is excluded from the active duration.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/1');
    await act(async () => {});
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect(input.session.durationMs).toBe(1_000 + 10_999 + 1); // 5s paused excluded
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('6/6');
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent('750');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock.calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as OddOneOutRawResult).forced).toBe(true);
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
    expect((input.session.rawResult as OddOneOutRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('exposes the adaptive escalation through the difficulty selector', async () => {
    const seed = 'adaptive-run';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'difficulty', 'adaptive')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // Adaptive round 1: 9 items, subtlety 0, window 12s.
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'time-left'))).toHaveTextContent('12.0s');
    // Drive one pass: tap round 1's odd tile via the same replication.
    const params = ADAPTIVE_PARAMS;
    const round0 = generateBoard({
      rng: createRng(seed),
      roundIndex: 0,
      subtlety: effectiveParamsForStep(params, 0).subtlety,
      gridSize: effectiveParamsForStep(params, 0).gridSize,
      prevBoard: null,
    });
    await advanceTime(clock, 1_000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tile', String(round0.oddIndex))));
    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
  });
});