/**
 * In-game workout continuation chrome (frontier audit
 * `in-game-workout-next-leg`).
 *
 * `GameResults` is the compact results surface every GameHost game shows. When
 * the route launched the game from a workout, the chrome advances the SAME
 * durable CAS `/results` uses (after persist success only) and offers Next Game
 * or completion, so the player never has to route Home between legs.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { GameResults, type GameResultsWorkoutActions } from '../results';
import { WorkoutSessionLaunchProvider } from '@/workout/session-launch-context';
import { advanceWorkoutForSession } from '@/workout/session-advance';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('@/workout/session-advance', () => ({
  advanceWorkoutForSession: jest.fn(),
}));

const mockedAdvance = jest.mocked(advanceWorkoutForSession);
const mockedPush = jest.mocked(router.push);

const PROVENANCE = {
  instanceKey: '2026-09-14',
  legIndex: 0,
  gameId: 'memory',
} as const;

function result(overrides: {
  advanced?: boolean;
  nextGameId?: string | null;
  completed?: boolean;
} = {}) {
  const nextGameId = overrides.nextGameId ?? null;
  return {
    advanced: overrides.advanced ?? true,
    instance: null,
    nextGameId,
    nextProvenance: nextGameId
      ? { instanceKey: '2026-09-14', legIndex: 1, gameId: nextGameId }
      : null,
    completed: overrides.completed ?? false,
  };
}

function renderResults(options: {
  persistState?: 'idle' | 'started' | 'succeeded' | 'failed';
  workout?: GameResultsWorkoutActions;
  withProvider?: boolean;
  gameId?: string;
} = {}) {
  const {
    persistState = 'succeeded',
    workout,
    withProvider = true,
    gameId = 'memory',
  } = options;
  const tree = (
    <GameResults
      gameId={gameId}
      persistState={persistState}
      workout={workout}
      onRestart={jest.fn()}
      onQuit={jest.fn()}>
      <Text>stat row</Text>
    </GameResults>
  );
  return render(
    withProvider ? (
      <WorkoutSessionLaunchProvider provenance={PROVENANCE}>
        {tree}
      </WorkoutSessionLaunchProvider>
    ) : (
      tree
    ),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GameResults workout continuation', () => {
  it('advances after persist success and offers Next Game (no Home detour)', async () => {
    mockedAdvance.mockResolvedValue(result({ nextGameId: 'speed-tap-rush' }));

    await renderResults();

    expect(await screen.findByTestId('memory.next-game')).toBeOnTheScreen();
    expect(mockedAdvance).toHaveBeenCalledWith({
      gameId: 'memory',
      workoutProvenance: PROVENANCE,
    });
    expect(screen.queryByTestId('memory.workout-complete')).toBeNull();

    // Activating it launches the next provenance tuple.
    fireEvent.press(screen.getByTestId('memory.next-game'));
    expect(mockedPush).toHaveBeenCalledWith(
      '/game/speed-tap-rush?workoutKey=2026-09-14&workoutIndex=1',
    );
  });

  it('does not advance and hides Next Game when persist failed', async () => {
    await renderResults({ persistState: 'failed' });

    expect(screen.getByTestId('memory.persist-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory.next-game')).toBeNull();
    expect(mockedAdvance).not.toHaveBeenCalled();
  });

  it('shows workout completion on the last leg instead of Next Game', async () => {
    mockedAdvance.mockResolvedValue(result({ completed: true, nextGameId: null }));

    await renderResults();

    expect(await screen.findByTestId('memory.workout-complete')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory.next-game')).toBeNull();
  });

  it('discloses a failed advance instead of silently dropping the leg', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedAdvance.mockRejectedValue(new Error('advance boom'));

    await renderResults();

    expect(
      await screen.findByTestId('memory.workout-advance-error'),
    ).toHaveTextContent(/Workout progress could not be saved/);
    expect(screen.queryByTestId('memory.next-game')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      '[game-results] workout advance failed',
      expect.any(Error),
    );
  });

  it('leaves standalone sessions untouched (no advance, no Next Game)', async () => {
    await renderResults({ withProvider: false });

    expect(screen.getByTestId('memory.restart')).toBeOnTheScreen();
    expect(screen.queryByTestId('memory.next-game')).toBeNull();
    expect(mockedAdvance).not.toHaveBeenCalled();
  });

  it('honours an explicit workout prop without touching the database seam', async () => {
    const onNextGame = jest.fn();
    await renderResults({
      withProvider: false,
      workout: { nextGameId: 'logic-next-sequence', onNextGame },
    });

    fireEvent.press(screen.getByTestId('memory.next-game'));
    expect(onNextGame).toHaveBeenCalledTimes(1);
    expect(mockedAdvance).not.toHaveBeenCalled();
  });

  it('ignores a launch tuple that belongs to a different game', async () => {
    await renderResults({ gameId: 'logic-next-sequence' });

    expect(screen.queryByTestId('logic-next-sequence.next-game')).toBeNull();
    expect(mockedAdvance).not.toHaveBeenCalled();
  });
});
