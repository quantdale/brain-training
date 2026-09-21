/**
 * Campaign 023 reward moment: `<GameResults>` shows the reward card only
 * after the authoritative write succeeds, and never invents a reward from
 * the local estimate. The canonical feedback event is fire-and-forget through
 * the global sensory service, so these tests stay purely presentational.
 *
 * Change 065 adds the in-session announcement contract: the result artifact
 * (headline), the persist failure, and the workout-advance failure each
 * expose a polite live region — the workout-complete card already had one.
 * Announcement is live-region driven, so a plain re-render stays silent;
 * only a state transition changes the region's content.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react-native';

import { expectConsoleNoise } from '@/test-utils';
import { advanceWorkoutForSession } from '@/workout/session-advance';
import { WorkoutSessionLaunchProvider } from '@/workout/session-launch-context';

import { GameResults } from '../results';

jest.mock('@/workout/session-advance', () => ({
  advanceWorkoutForSession: jest.fn(),
}));

const mockedAdvance = jest.mocked(advanceWorkoutForSession);

const PROVENANCE = {
  instanceKey: '2026-09-14',
  legIndex: 0,
  gameId: 'memory',
} as const;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GameResults reward moment', () => {
  it('shows no reward card before persistence succeeds', async () => {
    const { queryByTestId } = await render(
      <GameResults
        gameId="demo"
        persistState="started"
        reward={{ xp: 30, coins: 2 }}
        onRestart={() => {}}
        onQuit={() => {}}>
        <></>
      </GameResults>,
    );

    expect(queryByTestId('demo.reward')).toBeNull();
  });

  it('renders the authoritative XP and coin outcome after success', async () => {
    const { getByTestId, getByText } = await render(
      <GameResults
        gameId="demo"
        persistState="succeeded"
        reward={{ xp: 30, coins: 2 }}
        onRestart={() => {}}
        onQuit={() => {}}>
        <></>
      </GameResults>,
    );

    expect(getByTestId('demo.reward')).toBeTruthy();
    expect(getByText(/\+30 XP/)).toBeTruthy();
    expect(getByText(/\+2 coins/)).toBeTruthy();
    expect(getByText('Progress saved')).toBeTruthy();
  });

  it('renders a neutral success card when only coins were paid', async () => {
    const { getByText } = await render(
      <GameResults
        gameId="demo"
        persistState="succeeded"
        reward={{ xp: 0, coins: 5 }}
        onRestart={() => {}}
        onQuit={() => {}}>
        <></>
      </GameResults>,
    );

    expect(getByText(/Reward/)).toBeTruthy();
    expect(getByText(/\+5 coins/)).toBeTruthy();
  });

  it('does not celebrate a failed persistence', async () => {
    const { queryByTestId } = await render(
      <GameResults
        gameId="demo"
        persistState="failed"
        lastError="disk full"
        reward={{ xp: 30, coins: 2 }}
        onRestart={() => {}}
        onQuit={() => {}}>
        <></>
      </GameResults>,
    );

    expect(queryByTestId('demo.reward')).toBeNull();
  });
});

describe('GameResults in-session announcements', () => {
  it('announces the result headline through a polite live region', async () => {
    const { getByTestId } = await render(
      <GameResults
        gameId="demo"
        persistState="started"
        onRestart={() => {}}
        onQuit={() => {}}>
        <></>
      </GameResults>,
    );

    const artifact = getByTestId('demo.result-artifact');
    expect(artifact.props.accessibilityLiveRegion).toBe('polite');
    // The announced region is the one that contains the headline.
    expect(within(artifact).getByTestId('demo.result-headline')).toBeTruthy();
  });

  it('exposes the persist failure as a polite live region', async () => {
    const { getByTestId } = await render(
      <GameResults
        gameId="demo"
        persistState="failed"
        lastError="disk full"
        onRestart={() => {}}
        onQuit={() => {}}>
        <></>
      </GameResults>,
    );

    const error = getByTestId('demo.persist-error');
    expect(error.props.accessibilityLiveRegion).toBe('polite');
  });

  it('exposes a failed workout advance as a polite live region', async () => {
    mockedAdvance.mockRejectedValue(new Error('advance boom'));

    // The deliberate advance-failure diagnostic is scoped to this test.
    await expectConsoleNoise(/\[game-results\] workout advance failed/, async () => {
      await render(
        <WorkoutSessionLaunchProvider provenance={PROVENANCE}>
          <GameResults
            gameId="memory"
            persistState="succeeded"
            onRestart={() => {}}
            onQuit={() => {}}>
            <></>
          </GameResults>
        </WorkoutSessionLaunchProvider>,
      );
      await screen.findByTestId('memory.workout-advance-error');
    });

    expect(
      screen.getByTestId('memory.workout-advance-error').props
        .accessibilityLiveRegion,
    ).toBe('polite');
  });
});
