/**
 * ConfirmButton unit tests (campaign 012 W12).
 *
 * Two-tap destructive confirmation contract: first tap arms (label swap),
 * second tap confirms, the arm expires, and a disabled control can neither
 * arm nor confirm.
 *
 * Environment note (RNTL v14 + React 19): state updates triggered by
 * fireEvent settle asynchronously, so every post-press assertion goes
 * through the async findBy-star / waitFor queries. The expiry test uses
 * real wall-clock time - faking timers desynchronizes RNTL async rendering.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CONFIRM_ARM_MS, ConfirmButton } from '@/components/settings/confirm-button';

/** Real-ms upper bound for one arm cycle plus scheduler slack. */
const ARM_WINDOW_MS = CONFIRM_ARM_MS + 1500;

describe('ConfirmButton', () => {

  it('arms on first tap and confirms only on the second', async () => {
    const onConfirm = jest.fn();
    const api = await render(
      <ConfirmButton
        label="Delete"
        confirmLabel="Tap to confirm"
        testID="cb"
        accessibilityLabel="Delete saved backup b.json"
        variant="danger"
        size="small"
        onConfirm={onConfirm}
      />,
    );

    expect(api.getByText('Delete')).toBeOnTheScreen();

    fireEvent.press(api.getByTestId('cb'));
    // Armed: confirm label shown, action NOT yet run.
    await api.findByText('Tap to confirm');
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.press(api.getByTestId('cb'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    // Disarmed after firing.
    await api.findByText('Delete');
  }, ARM_WINDOW_MS);

  it('does not fire twice for extra taps after confirming', async () => {
    const onConfirm = jest.fn();
    const api = await render(
      <ConfirmButton
        label="Delete"
        confirmLabel="Tap to confirm"
        testID="cb"
        accessibilityLabel="Delete saved backup b.json"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(api.getByTestId('cb'));
    await api.findByText('Tap to confirm');
    fireEvent.press(api.getByTestId('cb'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));

    // Third tap begins a fresh arm; it does not confirm again.
    fireEvent.press(api.getByTestId('cb'));
    await api.findByText('Tap to confirm');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  }, ARM_WINDOW_MS);

  it('disarms when the arm expires', async () => {
    const onConfirm = jest.fn();
    const api = await render(
      <ConfirmButton
        label="Delete"
        confirmLabel="Tap to confirm"
        testID="cb"
        accessibilityLabel="Delete saved backup b.json"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(api.getByTestId('cb'));
    await api.findByText('Tap to confirm');

    // Let the arm window lapse entirely (real wall-clock time).
    await waitFor(
      () => expect(api.queryByText('Tap to confirm')).toBeNull(),
      { timeout: ARM_WINDOW_MS },
    );
    expect(api.getByText('Delete')).toBeOnTheScreen();

    // A late single press cannot confirm an expired arm.
    fireEvent.press(api.getByTestId('cb'));
    expect(onConfirm).not.toHaveBeenCalled();
  }, ARM_WINDOW_MS * 2);

  it('never arms or confirms while disabled', async () => {
    const onConfirm = jest.fn();
    const api = await render(
      <ConfirmButton
        label="Delete"
        confirmLabel="Tap to confirm"
        testID="cb"
        accessibilityLabel="Delete saved backup b.json"
        disabled
        onConfirm={onConfirm}
      />,
    );

    fireEvent.press(api.getByTestId('cb'));
    fireEvent.press(api.getByTestId('cb'));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(api.getByText('Delete')).toBeOnTheScreen();
    expect(
      api.getByTestId('cb').props.accessibilityState?.disabled,
    ).toBe(true);
  });

  it('exposes the armed intent to screen readers via its label', async () => {
    const onConfirm = jest.fn();
    const api = await render(
      <ConfirmButton
        label="Replace Import"
        confirmLabel="Tap again to erase and restore"
        testID="cb"
        accessibilityLabel="Apply replace import"
        onConfirm={onConfirm}
      />,
    );

    expect(api.getByTestId('cb').props.accessibilityLabel).toBe(
      'Apply replace import',
    );
    fireEvent.press(api.getByTestId('cb'));
    await api.findByText('Tap again to erase and restore');
    expect(api.getByTestId('cb').props.accessibilityLabel).toBe(
      'Tap again to erase and restore. Apply replace import',
    );
  }, ARM_WINDOW_MS);
});
