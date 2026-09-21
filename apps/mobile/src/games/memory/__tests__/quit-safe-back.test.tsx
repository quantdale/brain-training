/**
 * Phase-2 hardening (058 follow-up): the game exit path must survive a cold
 * deep-link landing (`braintraining://game/memory`) where the navigation stack
 * is empty. A bare `router.back()` no-ops there and GameHost's hardware-back
 * pause intercept then consumes the physical back press — the player is
 * stranded. `quitToLibrary` must route through the shared
 * `useSafeBack('/games')` fallback while still abandoning the active session.
 *
 * The hook-level decision table lives in
 * `components/ui/__tests__/back-link.test.tsx`; this file proves one real game
 * screen wires its quit path to it end to end.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createFakeClock, createInMemoryTutorialStore, SessionLifecycle, testId } from '@/sdk';

import MemoryScreen from '../screen';
import { GAME_ID } from '../types';

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  navigate: jest.fn(),
  canGoBack: jest.fn<() => boolean>(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

/** Tutorial store that already completed the tutorial (skips first-play). */
function completedStore() {
  const store = createInMemoryTutorialStore();
  store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
  return store;
}

/** Renders the intro, starts a live session, then pauses it (overlay visible). */
async function renderPausedSession() {
  await render(
    <MemoryScreen
      clock={createFakeClock(0)}
      tutorialStore={completedStore()}
      sessionSeed="quit-safe-back"
    />,
  );
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'pause')));
  expect(screen.getByTestId('memory.pause-overlay')).toBeOnTheScreen();
}

describe('MemoryScreen quit path (safe back)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRouter.back.mockClear();
    mockRouter.replace.mockClear();
    mockRouter.canGoBack.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('cold deep link (empty stack): replaces to the Games library and abandons the session', async () => {
    // The lifecycle is created inside the screen; spying on the prototype is
    // the observable seam proving the abandon/cleanup still runs.
    const abandon = jest.spyOn(SessionLifecycle.prototype, 'abandon');
    mockRouter.canGoBack.mockReturnValue(false);

    await renderPausedSession();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'quit')));

    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/games');
    expect(abandon).toHaveBeenCalledTimes(1);
  });

  it('pushed route (non-empty stack): backs out and never replaces', async () => {
    mockRouter.canGoBack.mockReturnValue(true);

    await renderPausedSession();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'quit')));

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
