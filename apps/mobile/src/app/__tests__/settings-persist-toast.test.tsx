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
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable } from 'react-native';

import RootLayout from '@/app/_layout';
import { useSettings } from '@/components/settings/settings-provider';
import { expectConsoleNoise, rootLayoutRoutes } from '@/test-utils';

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => {
      const db = (actual.getDb as () => { profile: object })();
      // Prototype-preserving override: spreading a repository instance would
      // drop its prototype methods (get/ensureExists), which the classified
      // bootstrap preference read genuinely needs. Only the SENSORY settings
      // write is injected to fail; the progression fingerprint write (also
      // routed through profile.update) must still succeed or the foundational
      // progression stage would fail for the wrong reason.
      const profile = Object.create(db.profile) as {
        update: (input: { settings?: Record<string, unknown> }) => Promise<void>;
      };
      const realUpdate = (db.profile as { update: (input: unknown) => Promise<void> })
        .update;
      profile.update = jest.fn(async (input: { settings?: Record<string, unknown> }) => {
        const settings = input.settings ?? {};
        if ('sfx' in settings || 'haptics' in settings) {
          throw new Error('settings persist boom');
        }
        return realUpdate.call(db.profile, input);
      });
      return { ...db, profile };
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

describe('sensory settings persist failure', () => {
  it('discloses a failed sfx persist with a danger toast', async () => {
    const result = renderRouter(
      { _layout: RootLayout, ...rootLayoutRoutes({ results: SettingsProbe }) },
      { initialUrl: '/results' },
    );
    await result;

    const toggle = await screen.findByTestId(
      'probe-toggle-sfx',
      {},
      { timeout: 10_000 },
    );
    // The deliberate persist-failure diagnostic is scoped to this test.
    await expectConsoleNoise(
      /\[startup\] failed to persist sensory settings/,
      async () => {
        await fireEvent.press(toggle);
        await screen.findByTestId('toast', {}, { timeout: 5000 });
      },
    );
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveTextContent(/Couldn't save your settings/);
    expect(toast).toHaveTextContent(/may reset when you restart/);
  });
});
