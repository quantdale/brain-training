/**
 * Campaign 023 reward moment: `<GameResults>` shows the reward card only
 * after the authoritative write succeeds, and never invents a reward from
 * the local estimate. The canonical feedback event is fire-and-forget through
 * the global sensory service, so these tests stay purely presentational.
 */
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { GameResults } from '../results';

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
    expect(getByText('+30 XP earned!')).toBeTruthy();
    expect(getByText('+2 coins · Progress saved')).toBeTruthy();
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

    expect(getByText('Session complete!')).toBeTruthy();
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
