/**
 * SymbolTrackerScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → observe → respond → submit → rounds → results →
 * persistence. Pause freeze semantics and the dev-only QA force paths are
 * covered too.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  createFakeClock,
  createInMemoryTutorialStore,
  createRng,
  testId,
} from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { EMPTY, generateRound } from '../generator';
import SymbolTrackerScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { SymbolTrackerRawResult } from '../types';
import { perfectSessionScore, referenceMaxRecall } from '../scoring';
import { SYMBOL_TRACKER_DIFFICULTY_PARAMS } from '../difficulty';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = SYMBOL_TRACKER_DIFFICULTY_PARAMS.normal;
const OBSERVE_MS = NORMAL.observeMs; // 2200

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, {
    completed: true,
    replayRequested: false,
    version: '1.0.0',
  });
  return store;
}

function makePersister(): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: 0,
  }));
  return { completeSession } as SessionPersistence & {
    completeSession: jest.Mock;
  };
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
    <SymbolTrackerScreen
      clock={clock}
      tutorialStore={store}
      sessionSeed={options.seed ?? 'screen-test-seed'}
      persistSession={persister}
    />,
  );
  return { clock, store, persister, result };
}

async function advanceTime(
  clock: ReturnType<typeof createFakeClock>,
  ms: number,
) {
  await act(async () => {
    clock.advance(ms);
    jest.advanceTimersByTime(ms);
  });
}

/** Reproduce the reducer's expected round for a seed/escalation chain. */
function expectedRound(
  seed: string,
  roundIndex: number,
  trackCount: number,
  prevTracked: readonly number[] | null,
) {
  return generateRound({
    rng: createRng(seed),
    roundIndex,
    gridSize: NORMAL.gridSize,
    tokenCount: NORMAL.tokenCount,
    trackCount,
    distractors: NORMAL.distractors,
    prevTracked,
  });
}

/** Respond-board cell indexes holding the given symbol ids. */
function cellsForSymbols(
  board: readonly number[],
  symbolIds: readonly number[],
): number[] {
  const wanted = new Set(symbolIds);
  const cells: number[] = [];
  board.forEach((id, index) => {
    if (id !== EMPTY && wanted.has(id)) {
      cells.push(index);
    }
  });
  return cells;
}

describe('SymbolTrackerScreen', () => {
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
      expect(
        screen.getByTestId(testId(GAME_ID, 'difficulty', level)),
      ).toBeOnTheScreen();
    }

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'difficulty', 'hard')),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    expect(
      screen.getByTestId(testId(GAME_ID, 'observe-board')),
    ).toBeOnTheScreen();
    // hard grid is 4×4 = 16 cells; cell 15 exists, 16 does not.
    expect(screen.getByTestId(testId(GAME_ID, 'cell', '15'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'cell', '16'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const clock = createFakeClock(0);
    const { result } = await renderScreen({ seed: 'tut', store, clock });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    const demo = generateRound({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      gridSize: 9,
      tokenCount: 4,
      trackCount: 2,
      distractors: 0,
      prevTracked: null,
    });
    await advanceTime(clock, 1500); // observe window ends
    for (const cell of cellsForSymbols(demo.respondBoard, demo.trackedSymbolIds)) {
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'cell', String(cell))),
      );
    }
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'tutorial-demo-done')),
    );
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'tutorial-done')),
    );

    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    await result.unmount();
    await render(
      <SymbolTrackerScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

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

    let prevTracked: readonly number[] | null = null;
    let trackCount = NORMAL.initialTrackCount;
    for (let round = 0; round < NORMAL.rounds; round += 1) {
      // observe phase → respond phase
      await advanceTime(clock, OBSERVE_MS);
      expect(
        screen.getByTestId(testId(GAME_ID, 'respond-board')),
      ).toBeOnTheScreen();

      const roundData = expectedRound(seed, round, trackCount, prevTracked);
      for (const cell of cellsForSymbols(
        roundData.respondBoard,
        roundData.trackedSymbolIds,
      )) {
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, 'cell', String(cell))),
        );
      }
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));

      if (round < NORMAL.rounds - 1) {
        expect(
          screen.getByTestId(testId(GAME_ID, 'round-passed')),
        ).toBeOnTheScreen();
        await fireEvent.press(
          screen.getByTestId(testId(GAME_ID, 'next-round')),
        );
      }
      prevTracked = roundData.trackedSymbolIds;
      trackCount += 1;
    }

    expect(
      screen.getByTestId(testId(GAME_ID, 'round-passed')),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, 'rounds-passed')),
    ).toHaveTextContent('5/5');
    expect(
      screen.getByTestId(testId(GAME_ID, 'best-recall')),
    ).toHaveTextContent(String(referenceMaxRecall(NORMAL)));

    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('attention-symbol-tracker');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThan(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as SymbolTrackerRawResult;
    expect(raw.score).toBe(perfectSessionScore(NORMAL));
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails a round on a wrong pick but continues holding the track count', async () => {
    const seed = 'wrong-tap';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, OBSERVE_MS);

    expect(
      screen.getByTestId(testId(GAME_ID, 'respond-board')),
    ).toBeOnTheScreen();
    const roundData = expectedRound(seed, 0, NORMAL.initialTrackCount, null);
    const trackedSet = new Set(roundData.trackedSymbolIds);
    const wrongCell = roundData.respondBoard.findIndex(
      (id) => id !== EMPTY && !trackedSet.has(id),
    );
    expect(wrongCell).toBeGreaterThanOrEqual(0);
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'cell', String(wrongCell))),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit')));

    expect(
      screen.getByTestId(testId(GAME_ID, 'round-failed')),
    ).toBeOnTheScreen();
    // round-result board shows the solution (post-round feedback), not during obscuring.
    expect(
      screen.getByTestId(testId(GAME_ID, 'round-result-board')),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    await advanceTime(clock, OBSERVE_MS); // track count held at 2 after a fail
    expect(
      screen.getByTestId(testId(GAME_ID, 'respond-board')),
    ).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and timers freeze until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 500); // partway through observe

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(
      screen.getByTestId('attention-symbol-tracker.pause-overlay'),
    ).toBeOnTheScreen();

    // Frozen: background time must not advance the observe window.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'respond-board'))).toBeNull();

    // The full remaining observe window is still required.
    await advanceTime(clock, 1600);
    expect(screen.queryByTestId(testId(GAME_ID, 'respond-board'))).toBeNull();
    await advanceTime(clock, 600);
    expect(
      screen.getByTestId(testId(GAME_ID, 'respond-board')),
    ).toBeOnTheScreen();
  });

  it('force-timeout skips the observe countdown immediately', async () => {
    await renderScreen({ seed: 'qa-timeout' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(
      screen.getByTestId(testId(GAME_ID, 'observe-board')),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-timeout')));

    expect(
      screen.getByTestId(testId(GAME_ID, 'respond-board')),
    ).toBeOnTheScreen();
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, 'forced-badge')),
    ).toBeOnTheScreen();
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SymbolTrackerRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, 'rounds-passed')),
    ).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SymbolTrackerRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });
});
