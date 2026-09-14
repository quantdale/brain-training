/**
 * Sensory settings persist failure disclosure (frontier audit
 * `residual-user-surface-honesty`).
 *
 * `persistSettings` in the root layout used to log a failed profile write to
 * the console only: the sfx/haptics toggle stayed visually on, then silently
 * reverted on restart. It must now tell the player with a danger toast (the
 * same pattern as the Profile theme persist).
 *
 * Renders the REAL RootLayout (real bootstrap against the in-memory node db)
 * with a probe route that flips the sfx toggle; `profile.update` is injected to
 * reject.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Pressable } from 'react-native';

import RootLayout from '@/app/_layout';
import { useSettings } from '@/components/settings/settings-provider';

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => {
      const db = (actual.getDb as () => { profile: Record<string, unknown> })();
      return {
        ...db,
        profile: {
          ...db.profile,
          update: jest.fn(async () => {
            throw new Error('settings persist boom');
          }),
        },
      };
    },
  };
});

function SettingsProbe() {
  const { setSetting } = useSettings();
  return (
    <Pressable
      testID="probe-toggle-sfx"
      onPress={() => setSetting('sfx', false)}
    />
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('sensory settings persist failure', () => {
  it('discloses a failed sfx persist with a danger toast', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = renderRouter(
      { _layout: RootLayout, index: SettingsProbe },
      { initialUrl: '/' },
    );
    await result;

    const toggle = await screen.findByTestId(
      'probe-toggle-sfx',
      {},
      { timeout: 10_000 },
    );
    await fireEvent.press(toggle);

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[startup] failed to persist sensory settings',
        expect.any(Error),
      ),
    );
    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't save your settings/);
    expect(toast).toHaveTextContent(/may reset when you restart/);
  });
});
