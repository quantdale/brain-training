/**
 * SpatialCoordinateTurnScreen integration tests.
 *
 * Renders the real screen with injected seams (fake clock, tutorial store,
 * fixed session seed, fake persister) and drives the full game loop:
 * intro → brief → choice → answer → rounds → results → persistence.
 * Pause freeze semantics, the tutorial lifecycle, and the dev-only QA force
 * paths (win / lose / timeout) are covered too.
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
  testId,
} from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import SpatialCoordinateTurnScreen from '../screen';
import { generateSession } from '../generator';
import { perfectSessionScore } from '../scoring';
import { DIFFICULTY_PARAMS } from '../difficulty';
import { seedToNumber } from '../session';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import type { SpatialCoordinateTurnRawResult } from '../types';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, {
    completed: true,
    replayRequested: false,
    version: '1.0.0',
  });
  return store;
}

function makePersister(
  outcome?: Partial<Awaited<ReturnType<SessionPersistence['completeSession']>>>,
): SessionPersistence & { completeSession: jest.Mock } {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: 0,
    rating: null,
    completionOutcome: null,
    ...outcome,
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
    <SpatialCoordinateTurnScreen
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

/** The deterministic plan the screen must be playing through. */
function expectedPlan(seed: string) {
  return generateSession(seed, DIFFICULTY_PARAMS.normal);
}

describe('SpatialCoordinateTurnScreen', () => {
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
    expect(screen.getByTestId(testId(GAME_ID, 'qa-toggle'))).toBeOnTheScreen(); // dev build
    for (const level of ['easy', 'normal', 'hard', 'expert', 'adaptive']) {
      expect(
        screen.getByTestId(testId(GAME_ID, 'difficulty', level)),
      ).toBeOnTheScreen();
    }

    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'difficulty', 'expert')),
    );
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    // Round 1 opens in the brief phase: commands visible, answers hidden.
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'compass'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'command-list'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'option', '0'))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'choice-begin')));
    expect(screen.getByTestId(testId(GAME_ID, 'options'))).toBeOnTheScreen();
    // Expert uses the 8-way set.
    expect(screen.getByTestId(testId(GAME_ID, 'option', '7'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'option', '8'))).toBeNull();
  });

  it('opens the tutorial on first play, completes it, and does not reopen it', async () => {
    const store = createInMemoryTutorialStore();
    const { result } = await renderScreen({ seed: 'tut', store });

    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    // Demo: start N, right, forward 1, right, forward 1 → facing S (index 2).
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', '2')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));

    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();

    await result.unmount();
    await render(
      <SpatialCoordinateTurnScreen
        clock={createFakeClock()}
        tutorialStore={store}
        sessionSeed="tut"
      />,
    );
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'start'))).toBeOnTheScreen();
  });

  it('replays a wrong demo attempt before completing the tutorial', async () => {
    await renderScreen({ seed: 'demo-retry', store: createInMemoryTutorialStore() });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));

    // Wrong pick (N instead of S) resets the demo for another attempt.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', '0')));
    expect(
      screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status')),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial-done'))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'option', '2')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
  });

  it('skips the tutorial via the dev-only QA button and replays it from help', async () => {
    const store = createInMemoryTutorialStore();
    await renderScreen({ seed: 'skip', store });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
    expect(store.getTutorialState(GAME_ID)?.completed).toBe(true);

    // Help button requests a replay and reopens the tutorial.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-skip')));
    expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'))).toBeNull();
  });

  it('plays a full normal session end-to-end and persists the record', async () => {
    const seed = 'screen-test-seed';
    const plan = expectedPlan(seed);
    const { persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));

    for (let round = 0; round < plan.length; round += 1) {
      expect(
        screen.getByTestId(testId(GAME_ID, 'round', String(round + 1))),
      ).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'choice-begin')));
      await fireEvent.press(
        screen.getByTestId(
          testId(GAME_ID, 'option', String(plan[round].correctIndex)),
        ),
      );
      if (round < plan.length - 1) {
        expect(
          screen.getByTestId(testId(GAME_ID, 'round-correct')),
        ).toBeOnTheScreen();
        await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
      }
    }

    expect(screen.getByTestId(testId(GAME_ID, 'round-correct'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    expect(screen.getByTestId(testId(GAME_ID, 'score'))).toHaveTextContent(
      String(perfectSessionScore(DIFFICULTY_PARAMS.normal)),
    );
    expect(screen.getByTestId(testId(GAME_ID, 'speed'))).toHaveTextContent('0 ms');
    expect(screen.getByTestId(testId(GAME_ID, 'position-accuracy'))).toHaveTextContent('—');
    expect(screen.getByTestId(testId(GAME_ID, 'xp'))).toHaveTextContent('0');

    // Flush the persistence promise chain.
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    expect(input.session.gameId).toBe('spatial-coordinate-turn');
    expect(input.session.seed).toBe(seedToNumber(seed));
    expect(input.session.durationMs).toBeGreaterThanOrEqual(0);
    expect(input.session.xp).toBe(0);
    expect(input.session.normalizedResult).toBe(1);
    const raw = input.session.rawResult as SpatialCoordinateTurnRawResult;
    expect(raw.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.normal));
    expect(raw.roundsPlayed).toBe(plan.length);
    expect(raw.correctPicks).toBe(plan.length);
    expect(raw.diagnosticMetadata.gameVersion).toBe('1.0.0');
    expect(raw.diagnosticMetadata.seed).toBe(seed);
    expect(raw.difficulty).toBe('normal');
    expect(raw.forced).toBe(false);
    expect(input.session.difficulty).toEqual(
      expect.objectContaining({ level: 'normal', challengeRating: 0.5 }),
    );

    // Play again starts a fresh session from round 1.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
    expect(persister.completeSession).toHaveBeenCalledTimes(1); // no extra write
  });

  it('fails a round on a wrong pick but continues to the next round', async () => {
    const seed = 'wrong-pick';
    const plan = expectedPlan(seed);
    const wrongIndex = (plan[0].correctIndex + 1) % plan[0].options.length;
    await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'choice-begin')));
    await fireEvent.press(
      screen.getByTestId(testId(GAME_ID, 'option', String(wrongIndex))),
    );

    expect(screen.getByTestId(testId(GAME_ID, 'round-wrong'))).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'next-round')));
    expect(screen.getByTestId(testId(GAME_ID, 'round', '2'))).toBeOnTheScreen();
  });

  it('renders a brief countdown and auto-transitions to choice when study time expires', async () => {
    const { clock } = await renderScreen({ seed: 'brief-timeout' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    expect(screen.getByTestId(testId(GAME_ID, 'brief-countdown'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'options'))).toBeNull();

    // No manual "Show answers" press: the time-box advances on its own.
    await advanceTime(clock, DIFFICULTY_PARAMS.normal.briefBudgetMs);
    expect(screen.getByTestId(testId(GAME_ID, 'options'))).toBeOnTheScreen();
  });

  it('pausing freezes the brief countdown until resume', async () => {
    const { clock } = await renderScreen({ seed: 'brief-freeze' });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await advanceTime(clock, 4000); // partway into the study window

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    await advanceTime(clock, 10_000); // background time must not consume budget
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(testId(GAME_ID, 'options'))).toBeNull();

    // Only the unpaused remainder of the budget is still required.
    await advanceTime(clock, DIFFICULTY_PARAMS.normal.briefBudgetMs - 4000);
    expect(screen.getByTestId(testId(GAME_ID, 'options'))).toBeOnTheScreen();
  });

  it('pauses: the opaque overlay appears, answering is blocked, timers freeze', async () => {
    const seed = 'pause-test';
    const plan = expectedPlan(seed);
    const { clock, persister } = await renderScreen({ seed });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'choice-begin')));

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
    expect(screen.getByTestId(`${GAME_ID}.pause-overlay`)).toBeOnTheScreen();

    // Obscured: the challenge (options included) leaves the accessibility tree.
    expect(screen.queryByTestId(testId(GAME_ID, 'option', String(plan[0].correctIndex)))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'compass'))).toBeNull();

    // Frozen: five seconds of background time must not count as play time.
    await advanceTime(clock, 5000);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'resume')));
    expect(screen.queryByTestId(`${GAME_ID}.pause-overlay`)).toBeNull();

    // End the session via the dev-only timeout path and check the durations.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-force-timeout')));
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    // The paused 5s window is excluded from the authoritative active time.
    expect(input.session.durationMs).toBeLessThan(5000);
    expect((input.session.rawResult as SpatialCoordinateTurnRawResult).forced).toBe(true);
  });

  it('force-win ends the session as a perfect run and marks it forced', async () => {
    const { persister } = await renderScreen({ seed: 'qa-win' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('100%');
    await act(async () => {});

    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as SpatialCoordinateTurnRawResult;
    expect(raw.forced).toBe(true);
    expect(raw.score).toBe(perfectSessionScore(DIFFICULTY_PARAMS.normal));
    expect(input.session.normalizedResult).toBe(1);
  });

  it('force-lose ends the session as a failed run', async () => {
    const { persister } = await renderScreen({ seed: 'qa-lose' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-lose')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'accuracy'))).toHaveTextContent('0%');
    await act(async () => {});

    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as SpatialCoordinateTurnRawResult;
    expect(raw.forced).toBe(true);
    expect(raw.correctPicks).toBe(0);
    expect(input.session.normalizedResult).toBe(0);
  });

  it('force-timeout ends the session without scoring the in-flight round', async () => {
    const { persister } = await renderScreen({ seed: 'qa-timeout' });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-force-timeout')));

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'forced-badge'))).toBeOnTheScreen();
    await act(async () => {});

    const input = persister.completeSession.mock
      .calls[0][0] as CompleteSessionInput;
    const raw = input.session.rawResult as SpatialCoordinateTurnRawResult;
    expect(raw.forced).toBe(true);
    expect(raw.roundsPlayed).toBe(0);
    expect(raw.mistakes).toBe(0);
  });

  it('surfaces persistence failures without crashing', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const failing = makePersister();
      failing.completeSession.mockImplementation(async () => {
        throw new Error('boom');
      });
      await renderScreen({ seed: 'persist-fail', persister: failing });

      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
      await act(async () => {});

      expect(
        screen.getByTestId(testId(GAME_ID, 'persist-error')),
      ).toBeOnTheScreen();
      expect(
        screen.getByTestId(testId(GAME_ID, 'persist-error')),
      ).toHaveTextContent(/boom/);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('renders the authoritative completion outcome when the backend provides one', async () => {
    const outcomePersister = makePersister({
      completionOutcome: {
        session: {} as CompleteSessionInput['session'],
        xp: 42,
        currency: 7,
        deltas: [{ domain: 'Spatial', delta: 1, ratingAfter: 51 }],
        balance: 7,
      },
    });
    await renderScreen({ seed: 'outcome', persister: outcomePersister });

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});

    expect(screen.getByTestId(testId(GAME_ID, 'xp'))).toHaveTextContent('42');
  });
});
