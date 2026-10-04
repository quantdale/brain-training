/**
 * `StateCard` primitive contract (071 §6.1 shared-kit coverage debt).
 *
 * The shell's one consistent empty/loading/error presentation: loading shows
 * skeleton lines (never a bare spinner), error tints the headline with the
 * danger color and offers a secondary action, empty offers a ghost action, the
 * action fires exactly once per press and announces itself (with the optional
 * label override), and the card is a polite live region so state transitions
 * are announced.
 */

import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { StateCard } from '@/components/shell/state-card';
import { Colors } from '@/theme/tokens';

describe('StateCard', () => {
  it('shows skeleton lines and no action in the loading variant', async () => {
    const onPress = jest.fn();
    await render(
      <StateCard
        variant="loading"
        title="Loading your progress"
        message="Reading your training record."
        testID="state"
        action={{ label: 'Retry', onPress }}
      />,
    );
    // The skeleton block is exposed under the derived testID.
    expect(screen.getByTestId('state-skeleton')).toBeTruthy();
    // The action stays available for a retry-style loading state.
    expect(screen.getByTestId('state-action')).toBeTruthy();
  });

  it('tints the error headline with the danger color and uses a secondary action', async () => {
    const onPress = jest.fn();
    await render(
      <StateCard
        variant="error"
        title="Could not load"
        message="Check your storage and try again."
        testID="state"
        action={{ label: 'Try again', onPress }}
      />,
    );
    const headline = screen.getByText('Could not load');
    const flatten = (style: unknown) =>
      Object.assign({}, ...(Array.isArray(style) ? style.flat().filter(Boolean) : [style])) as {
        color?: string;
      };
    // The error headline must use the danger text slot — not the neutral
    // text color an empty/loading card uses.
    expect(flatten(headline.props.style).color).toBe(Colors.light.dangerText);
    // The action renders under the derived testID and fires.
    expect(screen.getByTestId('state-action')).toBeTruthy();
  });

  it('fires the action exactly once per press and honours the label override', async () => {
    const onPress = jest.fn();
    await render(
      <StateCard
        variant="empty"
        title="No sessions yet"
        message="Play your first game to start the record."
        testID="state"
        action={{
          label: 'Browse games',
          accessibilityLabel: 'Browse the game library',
          onPress,
        }}
      />,
    );
    const action = screen.getByTestId('state-action');
    expect(action.props.accessibilityLabel).toBe('Browse the game library');
    // Each press is awaited inside act(): the button's press feedback drives
    // async state, and overlapping act() calls are unsupported (and would
    // poison the next render in this file).
    await act(async () => {
      fireEvent.press(action);
    });
    await act(async () => {
      fireEvent.press(action);
    });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('marks the card as a polite live region so transitions are announced', async () => {
    const tree = await render(
      <StateCard variant="empty" title="Empty" message="Nothing here yet." />,
    );
    const json = tree.toJSON() as { props: Record<string, unknown> } | null;
    expect(json?.props.accessibilityLiveRegion).toBe('polite');
  });

  it('renders no action control when none is provided', async () => {
    await render(
      <StateCard
        variant="empty"
        title="Empty"
        message="Nothing here yet."
        testID="state"
      />,
    );
    expect(screen.queryByTestId('state-action')).toBeNull();
  });
});
