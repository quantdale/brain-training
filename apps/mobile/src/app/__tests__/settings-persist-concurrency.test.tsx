/**
 * Regression probe for rapid sensory-toggle writes.
 *
 * The native SQLite backend permits one writer at a time. Two real Switch
 * events can arrive before the first fire-and-forget profile update settles;
 * this test makes that timing deterministic and asserts that RootLayout
 * serializes the existing persistence seam.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Pressable } from 'react-native';

import RootLayout from '@/app/_layout';
import { useSettings } from '@/components/settings/settings-provider';

let mockActiveWrites = 0;
const mockProfileUpdate = jest.fn(async () => {
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
      const db = (actual.getDb as () => { profile: Record<string, unknown> })();
      return {
        ...db,
        profile: {
          ...db.profile,
          update: mockProfileUpdate,
        },
      };
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

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes rapid SFX and haptics writes through the real root seam', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = renderRouter(
      { _layout: RootLayout, index: RapidToggleProbe },
      { initialUrl: '/' },
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
    expect(errorSpy).not.toHaveBeenCalledWith(
      '[startup] failed to persist sensory settings',
      expect.any(Error),
    );
  });
});
