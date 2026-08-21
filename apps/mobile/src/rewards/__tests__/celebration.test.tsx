/**
 * Reward celebration hardening (campaign 009 W08): the celebration banner is
 * purely presentational — it appears on emit, replaces a previous banner
 * immediately, auto-dismisses after ~3.5s, and never blocks or grants.
 *
 * Timers note: react-native's jest polyfill routes component-level setTimeout
 * around jest's fake clock, so all tests here run on real timers and the
 * dismissal test waits out the real window once.
 */
import { describe, expect, it } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { celebrateReward, RewardCelebrationHost } from '../celebration';

/** Emit inside async act, then settle real timers so React flushes. */
async function emit(payload: Parameters<typeof celebrateReward>[0]): Promise<void> {
  await act(async () => {
    celebrateReward(payload);
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('RewardCelebrationHost', () => {
  it('renders nothing until a reward is celebrated', async () => {
    const { queryByTestId, getByText } = await render(
      <>
        <Text>underneath</Text>
        <RewardCelebrationHost />
      </>,
    );
    expect(queryByTestId('reward-celebration')).toBeNull();
    // Gameplay/UI underneath stays rendered — the overlay ignores touches
    // (pointerEvents="none"), so its presence never blocks anything.
    expect(getByText('underneath')).toBeTruthy();
  });

  it('shows the celebrated reward', async () => {
    const { getByTestId, getByText } = await render(<RewardCelebrationHost />);

    await emit({ title: 'Quest reward', xp: 20, coins: 5 });
    expect(getByTestId('reward-celebration')).toBeTruthy();
    expect(getByText('Quest reward')).toBeTruthy();
    expect(getByText(/20 XP.*5 coins/)).toBeTruthy();
  });

  it('a new celebration replaces the current one immediately', async () => {
    const { getByText, queryByText } = await render(<RewardCelebrationHost />);

    await emit({ title: 'First', xp: 1 });
    expect(getByText('First')).toBeTruthy();

    await emit({ title: 'Second', coins: 7 });
    expect(getByText('Second')).toBeTruthy();
    expect(queryByText('First')).toBeNull();
  });

  it('fans every emission out to all mounted hosts', async () => {
    const { getAllByText } = await render(
      <>
        <RewardCelebrationHost />
        <RewardCelebrationHost />
      </>,
    );

    await emit({ title: 'Fan-out', xp: 3 });
    expect(getAllByText('Fan-out')).toHaveLength(2);
  });

  // LAST: uses real wall-clock time (~3.5s) because react-native's jest
  // polyfill routes component-level setTimeout around jest's fake clock.
  // W13: the fixed 3600ms sleep raced the component's 3500ms timer with only
  // ~90ms of margin and failed under heavy parallel load (the dismissal
  // callback itself gets starved). Condition-based wait instead: the banner
  // MUST disappear once the real timer fires — if it never does, this fails.
  it('auto-dismisses the banner after ~3.5s', async () => {
    const { getByTestId, queryByTestId, queryByText } = await render(
      <RewardCelebrationHost />,
    );

    await emit({ title: 'Fleeting', xp: 1 });
    expect(getByTestId('reward-celebration')).toBeTruthy();

    await waitFor(
      () => {
        expect(queryByTestId('reward-celebration')).toBeNull();
        expect(queryByText('Fleeting')).toBeNull();
      },
      { timeout: 8_000 },
    );
  }, 10_000);
});
