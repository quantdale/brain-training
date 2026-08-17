/**
 * Storage-unavailable recovery test (006R task 8.4).
 *
 * The root layout MUST surface a recoverable storage-unavailable screen with
 * retry/diagnostic options when the canonical DB fails to initialize, rather
 * than silently rendering the normal app (which would only fail on first save).
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import { initDatabase } from '@/db';

jest.mock('@/db', () => ({
  initDatabase: jest.fn().mockImplementation(() => Promise.reject(new Error('storage boom'))),
  getDb: jest.fn(() => {
    throw new Error('Database not initialized');
  }),
}));

function initCallCount(): number {
  return (initDatabase as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
}

describe('storage-unavailable recovery (task 8.4)', () => {
  it('renders the recoverable storage-unavailable screen when init fails', async () => {
    const result = renderRouter({ _layout: RootLayout, index: () => null }, { initialUrl: '/' });
    await result;

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
    const result = renderRouter({ _layout: RootLayout, index: () => null }, { initialUrl: '/' });
    await result;

    await screen.findByTestId('storage-unavailable');
    const before = initCallCount();
    expect(before).toBeGreaterThanOrEqual(1);

    await fireEvent.press(screen.getByTestId('storage-unavailable-retry'));

    // Retry re-invokes the bootstrap/init path.
    expect(initCallCount()).toBe(before + 1);
    // Still in the recoverable state (init keeps failing in this test).
    expect(screen.getByTestId('storage-unavailable')).toBeOnTheScreen();
  });
});
