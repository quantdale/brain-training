import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import GameScreen from '@/app/game/[id]';
import { getValidatedGameModule } from '@/registry/registry';
import { expectConsoleNoise } from '@/test-utils';

jest.mock('@/registry/registry.generated', () => ({
  registry: [], gameScreenLoaders: { memory: () => Promise.resolve({}), 'memory-reopen': () => Promise.resolve({}) },
}));
jest.mock('@/registry/registry', () => ({
  getGameDefinition: (id: string) => ({ id, name: id, primaryCategory: 'Memory' }),
  getValidatedGameModule: jest.fn(),
}));
jest.mock('@/hooks/use-persistent-tutorial-store', () => ({
  usePersistentTutorialStore: () => ({}),
}));
const load = jest.mocked(getValidatedGameModule);
let mounts = 0;
function LoadedGame() {
  // A stable successful lazy identity must not remount on route rerender.
  const [identity] = useState(() => ++mounts);
  return <Text testID="loaded-game">{identity}</Text>;
}
const moduleSurface = { default: LoadedGame } as unknown as Awaited<ReturnType<typeof getValidatedGameModule>>;
beforeEach(() => { load.mockReset(); mounts = 0; });

describe('game route lazy rejection recovery', () => {
  it('retries a transient import once, then preserves the successful identity on rerender and reopening', async () => {
    load.mockRejectedValueOnce(new Error('transient import')).mockResolvedValue(moduleSurface);
    await expectConsoleNoise(/transient import|game-route|error occurred|ErrorBoundary/i, async () => {
      await renderRouter({ 'game/[id]': GameScreen, index: () => <Text>Home</Text> }, { initialUrl: '/game/memory' });
      jest.useRealTimers();
      await screen.findByTestId('error-boundary-retry');
      await fireEvent.press(screen.getByTestId('error-boundary-retry'));
      expect(await screen.findByTestId('loaded-game')).toHaveTextContent('1');
      expect(load).toHaveBeenCalledTimes(2);
      await act(async () => { router.setParams({ unused: 'rerender' }); });
      expect(screen.getByTestId('loaded-game')).toHaveTextContent('1');
      expect(load).toHaveBeenCalledTimes(2);
      await act(async () => { router.replace('/'); });
      await act(async () => { router.push('/game/memory'); });
      expect(await screen.findByTestId('loaded-game')).toBeOnTheScreen();
      expect(load).toHaveBeenCalledTimes(2);
    }, { max: 10 });
  });

  it('can reopen a rejected game without reusing its poisoned lazy type', async () => {
    load.mockRejectedValueOnce(new Error('transient reopen import')).mockResolvedValue(moduleSurface);
    await expectConsoleNoise(/transient reopen import|game-route|error occurred|ErrorBoundary/i, async () => {
      await renderRouter({ 'game/[id]': GameScreen, index: () => <Text>Home</Text> }, { initialUrl: '/game/memory-reopen' });
      jest.useRealTimers();
      await screen.findByTestId('error-boundary-retry');
    }, { max: 4 });
    await act(async () => { router.replace('/'); });
    await act(async () => { router.push('/game/memory-reopen'); });
    expect(await screen.findByTestId('loaded-game')).toBeOnTheScreen();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
