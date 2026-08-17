/**
 * App-shell smoke test — renders the real route tree (expo-router
 * testing-library) and asserts each screen's stable content testIDs, the
 * Games empty state, tab navigation, and the `game/[id]` NotReady fallbacks.
 *
 * Notes on test strategy:
 * - The native tab bar (NativeTabs) is real native UI: trigger testIDs map to
 *   native view tags/accessibility identifiers and are NOT visible in the JS
 *   render tree, so tab testID presence is asserted two ways instead: the tab
 *   model unit test (`src/constants/__tests__/tabs.test.ts`) and the web tab
 *   bar render test below (web tab buttons are plain Pressables).
 * - The `game/[id]` route has no tab trigger, so it is exercised through an
 *   in-memory router context (no tab host) with an initial URL.
 */

// Jest globals imported explicitly (repo has no @types/jest; see orchestrator report).
import { beforeEach, describe, expect, it } from '@jest/globals';
import { router } from 'expo-router';
import { act, renderRouter, screen, within } from 'expo-router/testing-library';

import GameScreen from '@/app/game/[id]';
import AppTabsWeb from '@/components/app-tabs.web';
import { registerGameDefinitions } from '@/registry/registry';

/**
 * Render the shell and wait for it to settle.
 *
 * NOTE: expo-router's `renderRouter` returns the promise of RNTL's render
 * (RNTL v14 render is async) without awaiting it internally, so callers must
 * await it before querying `screen`. The returned object carries the router
 * helpers (`getPathname`, ...) attached to the promise itself, so this helper
 * deliberately returns the promise rather than its resolution value.
 */
function renderShell(initialUrl: string): ReturnType<typeof renderRouter> {
  return renderRouter('./src/app', { initialUrl });
}

describe('app shell', () => {
  beforeEach(() => {
    registerGameDefinitions([]);
  });

  it('renders the native tab shell with the home dashboard slots', async () => {
    await renderShell('/');

    // Tab shell + dashboard slots (testIDs per packet 001-a).
    expect(screen.getByTestId('home-workout-cta')).toBeOnTheScreen();
    expect(screen.getByTestId('home-stat-streak')).toBeOnTheScreen();
    expect(screen.getByTestId('home-stat-xp')).toBeOnTheScreen();
    expect(screen.getByTestId('home-stat-level')).toBeOnTheScreen();
    expect(screen.getByTestId('home-recent-games')).toBeOnTheScreen();
  });

  it('renders the web tab bar with the four stable tab testIDs', async () => {
    const result = renderRouter(
      {
        _layout: () => <AppTabsWeb />,
        index: () => null,
        games: () => null,
        progress: () => null,
        profile: () => null,
      },
      { initialUrl: '/' },
    );
    await result;

    expect(screen.getByTestId('tab-home')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-games')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-progress')).toBeOnTheScreen();
    expect(screen.getByTestId('tab-profile')).toBeOnTheScreen();
  });

  it('shows the games empty state until games register', async () => {
    await renderShell('/games');

    expect(screen.getByTestId('games-empty')).toBeOnTheScreen();
  });

  it('renders registered games as library cards', async () => {
    registerGameDefinitions([
      {
        id: 'memory-match',
        name: 'Memory Match',
        primaryCategory: 'Memory',
        description: 'A memory game',
        sdkVersion: '0.1.0',
        gameVersion: '1.0.0',
        generatorVersion: '1',
        contentVersion: null,
        hasTutorial: true,
      },
    ]);
    await renderShell('/games');

    expect(screen.getByTestId('games-grid')).toBeOnTheScreen();
    expect(screen.getByTestId('game-card-memory-match')).toBeOnTheScreen();
    // Scoped: the Home tab (also mounted) renders the game in Today's Workout.
    expect(within(screen.getByTestId('games-grid')).getByText('Memory Match')).toBeOnTheScreen();
  });

  it('renders the NotReady fallback for an unknown game id', async () => {
    const result = renderRouter({ 'game/[id]': GameScreen }, { initialUrl: '/game/does-not-exist' });
    await result;

    expect(screen.getByTestId('game-title')).toHaveTextContent('Game');
    expect(screen.getByTestId('game-not-ready-not-found')).toBeOnTheScreen();
  });

  it('renders the game detail fallback for an unknown game id', async () => {
    const result = renderShell('/game-detail/nope');
    await result;

    expect(screen.getByTestId('game-detail-title')).toBeOnTheScreen();
    expect(screen.getByTestId('game-detail-back')).toBeOnTheScreen();
  });

  it('renders the results empty state without persisted sessions', async () => {
    const result = renderShell('/results');
    await result;

    expect(screen.getByTestId('results-title')).toBeOnTheScreen();
    expect(screen.getByTestId('results-empty')).toBeOnTheScreen();
  });

  it('renders a registered game with a not-implemented fallback', async () => {
    registerGameDefinitions([
      {
        id: 'memory-match',
        name: 'Memory Match',
        primaryCategory: 'Memory',
        description: 'A memory game',
        sdkVersion: '0.1.0',
        gameVersion: '1.0.0',
        generatorVersion: '1',
        contentVersion: null,
        hasTutorial: true,
      },
    ]);
    const result = renderRouter({ 'game/[id]': GameScreen }, { initialUrl: '/game/memory-match' });
    await result;

    expect(screen.getByTestId('game-title')).toHaveTextContent('Memory Match');
    expect(screen.getByTestId('game-category')).toBeOnTheScreen();
    expect(screen.getByTestId('game-not-ready-back-to-library')).toBeOnTheScreen();
  });

  it('renders the progress summary placeholder', async () => {
    await renderShell('/progress');

    expect(screen.getByTestId('progress-summary')).toBeOnTheScreen();
  });

  it('renders profile identity and settings toggles', async () => {
    await renderShell('/profile');

    expect(screen.getByTestId('profile-identity')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-sfx')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-music')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-haptics')).toBeOnTheScreen();
  });

  it('navigates between tabs via the router', async () => {
    // Keep the renderRouter promise object (it carries the pathname helpers).
    const result = renderShell('/');
    await result;

    await act(async () => {
      router.navigate('/games');
    });
    expect(screen.getByTestId('games-empty')).toBeOnTheScreen();
    expect(result.getPathname()).toBe('/games');
  });
});
