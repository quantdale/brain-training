/** Direct recovery deep links must offer a real route back to training. */
import { describe, expect, it } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import StorageUnavailable from '@/app/storage-unavailable';

async function openStorageRoute(): Promise<void> {
  await renderRouter(
    {
      index: () => <View testID="storage-route-home" />,
      'storage-unavailable': StorageUnavailable,
    },
    { initialUrl: '/storage-unavailable' },
  );
}

describe('Storage recovery direct route', () => {
  it('does not claim an active storage failure when no bootstrap retry exists', async () => {
    await openStorageRoute();

    expect(screen.getByTestId('storage-unavailable-title')).toHaveTextContent('Ready to Train');
    expect(screen.getByTestId('storage-unavailable-message')).toHaveTextContent(
      'No startup issue is active. Return to Home to continue training.',
    );
    expect(screen.queryByTestId('storage-unavailable-detail')).toBeNull();
    expect(screen.queryByText(/Tap Retry below/)).toBeNull();
    expect(screen.queryByText(/If retry keeps failing/)).toBeNull();
    expect(screen.queryByText(/nothing is deleted by this error/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeOnTheScreen();
  });

  it('replaces the direct recovery route with Home when its action is pressed', async () => {
    await openStorageRoute();

    // Use the retained action ID so this catches the old inert Retry callback
    // as well as verifying that the correctly labelled replacement can navigate.
    await fireEvent.press(screen.getByTestId('storage-unavailable-retry'));

    expect(await screen.findByTestId('storage-route-home')).toBeOnTheScreen();
    expect(screen.queryByTestId('storage-unavailable')).toBeNull();
  });
});
