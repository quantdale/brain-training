/**
 * Representative GameHost screen for the in-game workout next-leg flow
 * (frontier audit `in-game-workout-next-leg` task 3.3).
 *
 * Renders the REAL MemoryScreen the way the route composes it (inside the
 * workout launch provider), force-wins a session, and proves the results
 * chrome advances the workout and surfaces Next Game in the same surface.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';
import type { CompleteSessionInput } from '@/db';

import MemoryScreen from '../screen';
import type { SessionPersistence } from '../session';
import { GAME_ID } from '../types';
import { advanceWorkoutForSession } from '@/workout/session-advance';
import { WorkoutSessionLaunchProvider } from '@/workout/session-launch-context';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
  router: { push: jest.fn() },
}));

jest.mock('@/workout/session-advance', () => ({
  advanceWorkoutForSession: jest.fn(),
}));

const mockedAdvance = jest.mocked(advanceWorkoutForSession);

const PROVENANCE = {
  instanceKey: '2026-09-14',
  legIndex: 0,
  gameId: GAME_ID,
} as const;

function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, {
    completed: true,
    replayRequested: false,
    version: '1.0.0',
  });
  return store;
}

function makePersister(): SessionPersistence {
  return {
    completeSession: jest.fn(async (input: CompleteSessionInput) => ({
      session: input.session,
      ledgerEntry: null,
      balance: 0,
    })),
  } as unknown as SessionPersistence;
}

describe('memory in-game workout next leg', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows Next Game on the in-game results after a workout-launched persist', async () => {
    mockedAdvance.mockResolvedValue({
      advanced: true,
      instance: null,
      nextGameId: 'speed-tap-rush',
      nextProvenance: {
        instanceKey: '2026-09-14',
        legIndex: 1,
        gameId: 'speed-tap-rush',
      },
      completed: false,
    });

    await render(
      <WorkoutSessionLaunchProvider provenance={PROVENANCE}>
        <MemoryScreen
          clock={createFakeClock(0)}
          tutorialStore={completedStore()}
          sessionSeed="workout-next-leg"
          persistSession={makePersister()}
        />
      </WorkoutSessionLaunchProvider>,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    // Flush the persistence promise and the advance promise it gates.
    await act(async () => {});
    await act(async () => {});

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'next-game'))).toBeOnTheScreen();
    expect(mockedAdvance).toHaveBeenCalledWith({
      gameId: GAME_ID,
      workoutProvenance: PROVENANCE,
    });
  });

  it('keeps standalone play unchanged (no Next Game, no advance)', async () => {
    await render(
      <MemoryScreen
        clock={createFakeClock(0)}
        tutorialStore={completedStore()}
        sessionSeed="standalone"
        persistSession={makePersister()}
      />,
    );

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.queryByTestId(testId(GAME_ID, 'next-game'))).toBeNull();
    expect(mockedAdvance).not.toHaveBeenCalled();
  });
});
