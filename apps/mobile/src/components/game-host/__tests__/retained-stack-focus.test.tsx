import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, Text } from 'react-native';
import { createFakeClock } from '@/sdk';
import { GameHost } from '../game-host';
import { useGameSession, type GameSessionController } from '../use-game-session';

const clock = createFakeClock(0);
let current: GameSessionController;
let unmounts = 0;
function Game() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [paused, setPaused] = useState(false);
  const session = useGameSession({ gameId: id, clock, onPause: () => setPaused(true) });
  useEffect(() => {
    current = session;
    session.begin();
    return () => { unmounts += 1; };
    // Only the stable begin callback controls session creation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.begin]);
  return <GameHost gameId={id} view="session" paused={paused} interceptBack difficulty="normal"
    onSelectDifficulty={() => undefined} onStart={() => undefined} onHelp={() => undefined}
    onPause={() => { session.requestPause(); }}
    onResume={() => { if (session.resumeIfPaused()) setPaused(false); }} onQuit={() => undefined}>
    <Text testID="challenge">Challenge</Text>
  </GameHost>;
}

describe('GameHost and useGameSession retained Stack focus ownership', () => {
  const handlers = new Set<Parameters<typeof BackHandler.addEventListener>[1]>();
  let backSpy: ReturnType<typeof jest.spyOn>;
  beforeEach(() => {
    unmounts = 0;
    handlers.clear();
    backSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.add(handler);
      return { remove: () => { handlers.delete(handler); } };
    });
  });
  afterEach(() => backSpy.mockRestore());
  async function back() {
    let consumed = false;
    await act(async () => {
      for (const handler of [...handlers].reverse()) {
        if (handler({ type: 'hardwareBackPress', timeStamp: 0 })) { consumed = true; break; }
      }
      if (!consumed && router.canGoBack()) router.back();
    });
    return consumed;
  }

  it('blur freezes a retained session, releases Back, and return requires explicit Resume', async () => {
    const rendered = renderRouter({
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: 'none' }} />,
      index: () => <Text>Home</Text>, 'game/[id]': Game, about: () => <Text>About</Text>,
    });
    await rendered;
    jest.useRealTimers();
    const rootHandlers = new Set(handlers);
    await act(async () => { router.push('/game/memory'); });
    const gameHandlers = [...handlers].filter((handler) => !rootHandlers.has(handler));
    expect(gameHandlers).toHaveLength(1);
    const retained = current;
    clock.advance(100);
    expect(current.elapsedMs()).toBe(100);
    await act(async () => { router.push('/about'); });
    expect(unmounts).toBe(0);
    expect(current.status()).toBe('paused');
    clock.advance(1000);
    expect(current.elapsedMs()).toBe(100);
    expect(gameHandlers.every((handler) => !handlers.has(handler))).toBe(true);
    // NavigationContainer itself may consume this event to pop About. The
    // hidden game's handler is absent, and the actual Stack must go back.
    await back();
    expect(rendered.getPathname()).toBe('/game/memory');
    expect(current).toBe(retained);
    clock.advance(1000);
    expect(current.elapsedMs()).toBe(100);
    await fireEvent.press(screen.getByTestId('memory.resume'));
    clock.advance(50);
    expect(current.elapsedMs()).toBe(150);
    expect(await back()).toBe(true); // focused active-screen behavior retained
    expect(current.status()).toBe('paused');
    expect(await back()).toBe(true); // paused overlay still owns Back
    expect(rendered.getPathname()).toBe('/game/memory');
  });
});
