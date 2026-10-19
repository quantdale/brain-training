/**
 * Real tutorial → Start regression, using the production route shell and game.
 * These are wiring/interaction guards: RNTL does not run Yoga, scale native
 * glyphs, dispatch Android scrolling, or establish screenshot reachability.
 * The matching emulator profiles supply that separate native evidence.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { resetReducedMotionStoreForTests } from '@/components/a11y/reduced-motion';
import { ScreenShell } from '@/components/screen-shell';
import { SettingsProvider } from '@/components/settings/settings-provider';
import type { CompleteSessionInput } from '@/db';
import { generateRound } from '@/games/logic-order-path/generator';
import { ORDER_PATH_DIFFICULTY_PARAMS } from '@/games/logic-order-path/difficulty';
import OrderPathScreen from '@/games/logic-order-path/screen';
import type { SessionPersistence } from '@/games/logic-order-path/session';
import { GAME_ID } from '@/games/logic-order-path/types';
import { createFakeClock, createInMemoryTutorialStore, createRng, testId } from '@/sdk';
import { Colors } from '@/theme/tokens';
import { WorkoutSessionLaunchProvider } from '@/workout/session-launch-context';

const mockViewport = { width: 411, height: 914, scale: 2.625, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockViewport,
}));

jest.mock('expo-router', () => ({
  useSegments: () => ['game', '[id]'],
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn(), canGoBack: () => false }),
}));

const SEED = 'tutorial-start-flow';
type Theme = 'light' | 'dark';
const profiles = [
  { viewport: 'default', width: 411, height: 914 },
  { viewport: 'compact', width: 320, height: 533 },
].flatMap((viewport) => [1, 2].flatMap((fontScale) =>
  (['light', 'dark'] as const).flatMap((theme) => [false, true].map((reducedMotion) => ({
    ...viewport, fontScale, theme, reducedMotion,
  }))),
));

function makePersister() {
  const completeSession = jest.fn(async (input: CompleteSessionInput) => ({
    session: input.session,
    ledgerEntry: null,
    balance: 0,
    rating: null,
    completionOutcome: null,
  }));
  return { completeSession } satisfies SessionPersistence;
}

async function renderGame(theme: Theme, store = createInMemoryTutorialStore()) {
  const clock = createFakeClock();
  const persister = makePersister();
  const view = await render(
    <SafeAreaInsetsContext.Provider value={{ top: 24, bottom: 24, left: 0, right: 0 }}>
      <SettingsProvider initialThemeId={theme}>
        <WorkoutSessionLaunchProvider provenance={null}>
          <ScreenShell>
            <OrderPathScreen clock={clock} tutorialStore={store}
              sessionSeed={SEED} persistSession={persister} />
          </ScreenShell>
        </WorkoutSessionLaunchProvider>
      </SettingsProvider>
    </SafeAreaInsetsContext.Provider>,
  );
  // Flush the real shared reduced-motion hook's asynchronous native seed.
  await act(async () => {});
  return { view, store, persister };
}

function expectTutorialOwnsIntroduction() {
  expect(screen.getByTestId(testId(GAME_ID, 'tutorial'))).toBeOnTheScreen();
  // Hidden accessibility descendants still paint and intercept touches. An
  // open tutorial must replace Start, rather than merely hiding its a11y node.
  expect(screen.queryByTestId(testId(GAME_ID, 'start'), { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByTestId(testId(GAME_ID, 'help'), { includeHiddenElements: true })).toBeNull();
}

async function completeAndPlay() {
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-done')));
  expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'), { includeHiddenElements: true })).toBeNull();
  const start = screen.getByTestId(testId(GAME_ID, 'start'));
  expect(start).toBeEnabled();
  await fireEvent.press(start);
  expect(screen.getByTestId(testId(GAME_ID, 'round', '1'))).toBeOnTheScreen();
  expect(screen.queryByTestId(testId(GAME_ID, 'start'), { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'), { includeHiddenElements: true })).toBeNull();

  // A real first legal move proves the launch entered an interactive round.
  const round = generateRound({
    rng: createRng(SEED), roundIndex: 0,
    itemCount: ORDER_PATH_DIFFICULTY_PARAMS.normal.itemCount,
    edgeDensityTarget: ORDER_PATH_DIFFICULTY_PARAMS.normal.edgeDensityTarget,
    prevSolution: null,
  });
  const item = screen.getByTestId(testId(GAME_ID, 'item', round.solution[0]));
  expect(item).toBeEnabled();
  await fireEvent.press(item);
  expect(screen.getByTestId(testId(GAME_ID, 'placed', '0'))).toHaveTextContent(`1. ${round.solution[0]}`);
}

describe('tutorial completion hands control back to a playable Start action', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'android');
    resetReducedMotionStoreForTests();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    Object.assign(mockViewport, { width: 411, height: 914, fontScale: 1 });
  });

  afterEach(() => {
    resetReducedMotionStoreForTests();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(profiles)(
    '$viewport $width×$height font$fontScale $theme reducedMotion=$reducedMotion: first play and replay both reach gameplay',
    async ({ width, height, fontScale, theme, reducedMotion }) => {
      Object.assign(mockViewport, { width, height, fontScale });
      jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(reducedMotion);
      const first = await renderGame(theme);
      expect(StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'tutorial')).props.style).backgroundColor)
        .toBe(Colors[theme].surface);
      expectTutorialOwnsIntroduction();
      await completeAndPlay();
      expect(first.store.getTutorialState(GAME_ID)).toEqual(expect.objectContaining({ completed: true, replayRequested: false }));
      expect(first.persister.completeSession).not.toHaveBeenCalled();
      await first.view.unmount();

      const replay = await renderGame(theme, first.store);
      expect(screen.queryByTestId(testId(GAME_ID, 'tutorial'), { includeHiddenElements: true })).toBeNull();
      await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'help')));
      expectTutorialOwnsIntroduction();
      await completeAndPlay();
      expect(replay.store.getTutorialState(GAME_ID)).toEqual(expect.objectContaining({ completed: true, replayRequested: false }));
      expect(replay.persister.completeSession).not.toHaveBeenCalled();
      await replay.view.unmount();
    },
  );

  it('keeps tutorial controls in the route scroll flow, with no absolute overlay ancestor', async () => {
    const { view } = await renderGame('light');
    let ancestor = screen.getByTestId(testId(GAME_ID, 'tutorial')).parent;
    let foundShellScroll = false;
    const positions: unknown[] = [];
    while (ancestor !== null) {
      if (ancestor.props.contentContainerStyle !== undefined) {
        foundShellScroll = true;
        break;
      }
      positions.push(StyleSheet.flatten(ancestor.props.style)?.position);
      ancestor = ancestor.parent;
    }
    expect(foundShellScroll).toBe(true);
    expect(positions).not.toContain('absolute');
    await view.unmount();
  });

  it('lets the intrinsic tutorial grow within the scrolling route instead of clipping at a percent height cap', async () => {
    Object.assign(mockViewport, { width: 320, height: 533, fontScale: 2 });
    const { view } = await renderGame('dark');
    const style = StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'tutorial')).props.style);
    expect(typeof style.maxHeight === 'string' && style.maxHeight.endsWith('%')).toBe(false);
    await view.unmount();
  });
});
