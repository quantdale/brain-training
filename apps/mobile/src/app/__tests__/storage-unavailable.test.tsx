/**
 * Storage-unavailable recovery test (006R task 8.4).
 *
 * The root layout MUST surface a recoverable storage-unavailable screen with
 * retry/diagnostic options when the canonical DB fails to initialize, rather
 * than silently rendering the normal app (which would only fail on first save).
 *
 * Campaign 027 hardening adds the recovery half of the contract: after a
 * retry that re-initialises successfully, the app must leave the recoverable
 * screen and render its normal shell. The failure is injected through the same
 * init seam the original tests use; the SUCCESS path delegates to the real
 * `initDatabase` (jest/setup.js routes the Expo backend to the in-memory node
 * adapter), so the recovered shell is genuinely bootstrapped, not faked.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import RootLayout from '@/app/_layout';
import { initDatabase } from '@/db';
import { expectConsoleNoise, rootLayoutRoutes } from '@/test-utils';

/** Test-controlled init seam: fails by default until a test flips it. */
const mockDbLifecycle = { failInit: true };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    initDatabase: jest.fn((options?: unknown) => {
      if (mockDbLifecycle.failInit) {
        return Promise.reject(new Error('storage boom'));
      }
      return (actual.initDatabase as (options?: unknown) => Promise<unknown>)(
        options,
      );
    }),
    getDb: jest.fn(() => {
      if (mockDbLifecycle.failInit) {
        throw new Error('Database not initialized');
      }
      return (actual.getDb as () => unknown)();
    }),
  };
});

function initCallCount(): number {
  return (initDatabase as unknown as { mock: { calls: unknown[] } }).mock.calls
    .length;
}

beforeEach(() => {
  mockDbLifecycle.failInit = true;
});

describe('storage-unavailable recovery (task 8.4)', () => {
  it('renders the recoverable storage-unavailable screen when init fails', async () => {
    // The injected storage failure logs its classified diagnostic by design;
    // scope it to this test instead of letting it read as unexpected noise.
    await expectConsoleNoise(/\[bootstrap\] stage failed.*"stage":"database"/, async () => {
      const result = renderRouter(
        { _layout: RootLayout, ...rootLayoutRoutes({}) },
        { initialUrl: '/results' },
      );
      await result;
    });

    // Recoverable state is shown with diagnostic detail, not the normal app.
    expect(await screen.findByTestId('storage-unavailable')).toBeOnTheScreen();
    expect(screen.getByTestId('storage-unavailable-message')).toBeOnTheScreen();
    expect(screen.getByTestId('storage-unavailable-detail')).toHaveTextContent('storage boom');
    expect(screen.getByTestId('storage-unavailable-retry')).toBeOnTheScreen();

    // The normal app shell must not be rendered (no silent healthy-looking app).
    expect(screen.queryByTestId('home-workout-cta')).toBeNull();

    // Init was attempted (at least once; React may mount effects twice in dev).
    expect(initCallCount()).toBeGreaterThanOrEqual(1);
  });

  it('re-attempts initialization when the retry control is pressed', async () => {
    await expectConsoleNoise(
      /\[bootstrap\] stage failed.*"stage":"database"/,
      async () => {
        const result = renderRouter(
          { _layout: RootLayout, ...rootLayoutRoutes({}) },
          { initialUrl: '/results' },
        );
        await result;
      },
      { max: 3 },
    );

    await screen.findByTestId('storage-unavailable');
    const before = initCallCount();
    expect(before).toBeGreaterThanOrEqual(1);

    // The retry attempt fails again and logs its expected diagnostic.
    await expectConsoleNoise(/\[bootstrap\] stage failed.*"stage":"database"/, async () => {
      await fireEvent.press(screen.getByTestId('storage-unavailable-retry'));
    });

    // Retry re-invokes the bootstrap/init path.
    expect(initCallCount()).toBe(before + 1);
    // Still in the recoverable state (init keeps failing in this test).
    expect(screen.getByTestId('storage-unavailable')).toBeOnTheScreen();
  });

  it('renders the normal app shell after a retry re-initialises successfully', async () => {
    await expectConsoleNoise(
      /\[bootstrap\] stage failed.*"stage":"database"/,
      async () => {
        const result = renderRouter(
          {
            _layout: RootLayout,
            ...rootLayoutRoutes({ results: () => <View testID="normal-shell-route" /> }),
          },
          { initialUrl: '/results' },
        );
        await result;
      },
      { max: 2 },
    );

    await screen.findByTestId('storage-unavailable');
    const before = initCallCount();

    // Recovery: the next init attempt runs the real database bootstrap.
    mockDbLifecycle.failInit = false;
    await fireEvent.press(screen.getByTestId('storage-unavailable-retry'));

    // The recoverable screen is gone and the real navigator mounted the
    // requested route inside the normal shell.
    expect(
      await screen.findByTestId('normal-shell-route', {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('storage-unavailable')).toBeNull();
    expect(initCallCount()).toBe(before + 1);
  });
});
