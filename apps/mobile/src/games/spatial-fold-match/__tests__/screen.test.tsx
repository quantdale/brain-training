/**
 * SpatialFoldMatchScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop with
 * fake timers: intro → source → choice → rounds → results → persistence.
 * Pause freeze semantics, the tutorial lifecycle, and the dev-only QA force
 * paths are covered too.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import { TUTORIAL_DEMO_SEED } from '../components/tutorial';
import { DIFFICULTY_PARAMS } from '../difficulty';
import { generateRoundData } from '../generator';
import type { Grid } from '../generator';
import SpatialFoldMatchScreen from '../screen';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { perfectSessionScore } from '../scoring';
import { GAME_ID } from '../types';
import type { FoldType, SpatialFoldMatchRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

const NORMAL = DIFFICULTY_PARAMS.normal;
const REVEAL_MS = NORMAL.sourceRevealMs;

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
    <SpatialFoldMatchScreen
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

/** Replicates the reducer's round generation chain for the normal level. */
function expectedRound(
  seed: string,
  roundIndex: number,
  prevSource: Grid | null,
  prevFold: FoldType | null,
) {
  return generateRoundData({
    rng: createRng(seed),
    roundIndex,
    gridRows: NORMAL.gridRows,
    gridCols: NORMAL.gridCols,
    filledCells: NORMAL.filledCells,
    foldsAllowed: NORMAL.foldsAllowed,
    optionCount: NORMAL.optionCount,
    prevSource,
    prevFold,
  });
}

describe('SpatialFoldMatchScreen', () => {
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
      screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // expert board is 4×5; cell row 3 col 4 exists, col 5 does not.
    expect(
      screen.getByTestId(testId(GAME_ID, 'source-grid')),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'cell', '3-4'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'cell', '3-5'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(
      screen.getByTestId(testId(GAME_ID, 'reveal-status')),
    ).toBeOnTheScreen();
  });

  it('opens the tutorial on first play, completes the demo, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const clock = createFakeClock(0);
    const { result } = await renderScreen({ seed: 'tut', store, clock });

    // Auto-opened on first play.
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    // Demo: memorize phase → options appear after the reveal window.
    await advanceTime(clock, 1500);
    const demo = generateRoundData({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: 0,
      gridRows: 3,
      gridCols: 3,
      filledCells: 3,
      foldsAllowed: ['foldV'],
      optionCount: 2,
      prevSource: null,
      prevFold: null,
    });
    expect(
      screen.getAllByTestId(testId(GAME_ID, 'option', String(demo.correctOptionIndex))),
    ).toHaveLength(1);

    // A wrong pick offers a retry instead of completing the demo.
    const wrongIndex = (demo.correctOptionIndex + 1) % demo.options.length;
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))),
    );
    expect(
      screen.getByTestId(testId(GAME_ID, 'tutorial-retry')),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-retry')));
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(demo.correctOptionIndex))),
    );

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'tutorial-demo-done')),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // Second mount over the same store: no auto-open.
    await result.unmount();
    await render(
      <SpatialFoldMatchScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    // Replay via the help button.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  });

  it('skips the tutorial via the dev-only QA button', async () => {
    await renderScreen({ seed: 'skip', store: createInMemoryTutorialStore() });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    let prevSource: Grid | null = null;
    let prevFold: FoldType | null = null;
    for (let round = 0; round < NORMAL.rounds; round += 1) {
      // Source reveal window elapses → choice phase.
      await advanceTime(clock, REVEAL_MS);
      expect(
        screen.getByTestId(testId(GAME_ID, 'choice-status')),
      ).toBeOnTheScreen();

      const expected = expectedRound(seed, round, prevSource, prevFold);
      // All options render; none is marked selected before the player acts.
      expect(screen.getAllByTestId(testId(GAME_ID, 'option-grid', '0'))).toHaveLength(1);
      await fireEvent.press(
        screen.getByTestId(testId(GAME_ID, 'option', String(expected.correctOptionIndex))),
      );

      if (round < NORMAL.rounds - 1) {
        expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
        expect(
          screen.getByTestId(testId(GAME_ID, 'round', String(round + 2))),
        ).toBeOnTheScreen();
      }
      prevSource = expected.source;
      prevFold = expected.foldType;
    }

    expect(screen.getByTestId(testId(GAME_ID, 'round-passed'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(
      screen.getByTestId(testId(GAME_ID, 'rounds-passed')),
    ).toHaveTextContent(`${NORMAL.rounds}/${NORMAL.rounds}`);
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(
      String(perfectSessionScore(NORMAL)),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'xp'))).toHaveTextContent('0');

    // Flush the persistence promise.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('spatial-fold-match');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThan(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as SpatialFoldMatchRawResult;
    expect(raw.score).toBe(perfectSessionScore(NORMAL));
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.1.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );
  });

  it('fails a round on a wrong pick, reveals the answer, and continues', async () => {
    const seed = 'wrong-pick';
    const { clock } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, REVEAL_MS);

    const expected = expectedRound(seed, 0, null, null);
    const wrongIndex = (expected.correctOptionIndex + 1) % expected.options.length;
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))),
    );

    expect(screen.getByTestId(testId(GAME_ID, 'round-failed'))).toBeOnTheScreen();
    // The correct option is revealed in the round-result view.
    expect(
      screen.getByTestId(testId(GAME_ID, 'option', String(expected.correctOptionIndex))),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
    await advanceTime(clock, REVEAL_MS);
    expect(screen.getByTestId(testId(GAME_ID, 'choice-status'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears and timers freeze until resume', async () => {
    const { clock } = await renderScreen({ seed: 'pause-test' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 500); // partway through the reveal window

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(
      screen.getByTestId(testId(GAME_ID, 'pause-overlay')),
    ).toBeOnTheScreen();

    // Frozen: background time must not advance the reveal window.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'choice-status'))).toBeNull();

    // The remaining reveal window is still required (500 of 1300 elapsed).
    await advanceTime(clock, 600);
    expect(screen.queryByTestId(testId(GAME_ID, 'choice-status'))).toBeNull();
    await advanceTime(clock, 200);
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
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SpatialFoldMatchRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'rounds-passed'))).toHaveTextContent('0/1');
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect((input.session.rawResult as SpatialFoldMatchRawResult).forced).toBe(true);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('surfaces persistence failures without crashing', async () => {
    const failing: SessionPersistence & { completeSession: jest.Mock } = {
      completeSession: jest.fn(async () => {
        throw new Error('db locked');
      }),
    } as unknown as SessionPersistence & { completeSession: jest.Mock };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const clock = createFakeClock(0);
      await render(
        <SpatialFoldMatchScreen
          clock={clock}
          tutorialStore={completedStore()}
          sessionSeed="persist-fail"
          persistSession={failing}
        />,
      );
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
      expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
      await act(async () => {});
      expect(failing.completeSession).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId(testId(GAME_ID, 'persist-error'))).toBeOnTheScreen();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
