/**
 * Regression probe for rapid sensory-toggle writes.
 *
 * The native SQLite backend permits one writer at a time. Two real Switch
 * events can arrive before the first fire-and-forget profile update settles;
 * this test makes that timing deterministic and asserts that RootLayout
 * serializes the existing persistence seam.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Pressable } from 'react-native';

import RootLayout from '@/app/_layout';
import { useSettings } from '@/components/settings/settings-provider';
import { rootLayoutRoutes } from '@/test-utils';

let mockActiveWrites = 0;
const mockProfileUpdate = jest.fn(async (_input: unknown) => {
  if (mockActiveWrites > 0) {
    throw new Error('database is locked');
  }
  mockActiveWrites += 1;
  await new Promise((resolve) => setTimeout(resolve, 20));
  mockActiveWrites -= 1;
});

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => {
      const db = (actual.getDb as () => { profile: object })();
      // Prototype-preserving override (spreading a repository instance would
      // drop its prototype methods). The concurrency probe replaces ONLY the
      // sensory settings write; the bootstrap preference read and the
      // progression fingerprint write stay real so the classified pipeline
      // reaches the ready shell.
      const profile = Object.create(db.profile) as {
        update: (input: { settings?: Record<string, unknown> }) => Promise<void>;
      };
      const realUpdate = (db.profile as { update: (input: unknown) => Promise<void> })
        .update;
      profile.update = jest.fn(async (input: { settings?: Record<string, unknown> }) => {
        const settings = input.settings ?? {};
        if ('sfx' in settings || 'haptics' in settings) {
          return mockProfileUpdate(input);
        }
        return realUpdate.call(db.profile, input);
      });
      return { ...db, profile };
    },
  };
});

function RapidToggleProbe() {
  const { setSetting } = useSettings();
  return (
    <Pressable
      testID="probe-rapid-toggle"
      onPress={() => {
        setSetting('sfx', false);
        setSetting('haptics', false);
      }}
    />
  );
}

describe('sensory settings persistence concurrency', () => {
  beforeEach(() => {
    mockActiveWrites = 0;
    mockProfileUpdate.mockClear();
  });

  it('serializes rapid SFX and haptics writes through the real root seam', async () => {
    const result = renderRouter(
      { _layout: RootLayout, ...rootLayoutRoutes({ results: RapidToggleProbe }) },
      { initialUrl: '/results' },
    );
    await result;
    mockProfileUpdate.mockClear();

    await fireEvent.press(await screen.findByTestId('probe-rapid-toggle'));

    await waitFor(() => expect(mockProfileUpdate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockActiveWrites).toBe(0));
    expect(mockProfileUpdate).toHaveBeenNthCalledWith(1, {
      settings: { sfx: false, haptics: true },
    });
    expect(mockProfileUpdate).toHaveBeenNthCalledWith(2, {
      settings: { sfx: false, haptics: false },
    });
  });
});
