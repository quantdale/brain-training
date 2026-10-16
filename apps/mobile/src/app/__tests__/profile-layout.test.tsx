import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import * as ReactNative from 'react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import { ACHIEVEMENT_DEFINITIONS_V1 } from '@/achievements';
import { SettingsProvider } from '@/components/settings/settings-provider';
import { QUEST_DEFINITIONS_V1 } from '@/quests';

// Mock the actual hook module so both the route's named import and shared
// primitives read the requested viewport, rather than spying on a namespace copy.
const mockViewport = { width: 390, height: 844, scale: 1, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockViewport,
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
  useFocusEffect: () => {}, useSegments: () => ['(tabs)'],
}));

const mockProfileUpdate = jest.fn(async (_input: unknown) => {});
jest.mock('@/db', () => {
  const actual = jest.requireActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => ({ profile: { update: mockProfileUpdate } }) };
});

const BEST = ACHIEVEMENT_DEFINITIONS_V1.find((definition) => definition.id === 'ach-best-90')!;
const QUEST = QUEST_DEFINITIONS_V1[0];
const RAW_PROGRESS = 0.5599999999999999;
const mockData = {
  displayName: 'Alex Rivera', balance: 300, totalXp: 120,
  claimableRewardCount: 1, inventory: { freeze: 1, shield: 0, recovery: 0 },
  profileSettings: {}, questRows: new Map(),
  questEvals: [{ questId: QUEST.id, periodKey: 'fixture', progress: 1.23456789, goal: 3, completed: false }],
  unlocks: new Map(), currentStreak: 0, longestStreak: 0, atRisk: false,
  streakState: { current: 0, longest: 0, lastActiveDate: null, atRisk: false, frozenDays: 0 },
  weekDays: [], milestoneRows: [],
  cosmeticProgression: { claimedAchievements: new Set(), claimedQuests: new Set(), longestStreak: 0 },
  achievementProgress: new Map([[BEST.id, { progress: RAW_PROGRESS, goal: 0.9, ratio: RAW_PROGRESS / 0.9 }]]),
  equippedCosmetics: [{ slot: 'avatarFrame', name: 'Classic Frame' }],
};
jest.mock('@/hooks/use-db-data', () => ({
  useDbData: () => ({ data: mockData, status: 'success', loaded: true, hasData: true, retry: jest.fn() }),
}));

async function renderProfile() {
  await render(<SettingsProvider><ProfileScreen /></SettingsProvider>);
}

function streakRail() {
  const strip = screen.getByTestId('profile-streak-week');
  return strip.parent;
}

describe('Profile purpose and progress presentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockViewport, { width: 390, height: 844, scale: 1, fontScale: 1 });
    mockData.currentStreak = 0;
    mockData.longestStreak = 0;
    mockData.inventory = { freeze: 1, shield: 0, recovery: 0 };
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it('exposes preferences before long record lists, with records closed on entry', async () => {
    await renderProfile();
    expect(screen.getByTestId('profile-settings-theme-system')).toBeOnTheScreen();
    expect(screen.getByTestId('settings-sfx')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-data-management')).toBeOnTheScreen();
    expect(screen.queryByTestId(`profile-achievement-${BEST.id}`)).toBeNull();
    expect(screen.queryByTestId(`profile-quest-${QUEST.id}`)).toBeNull();
    const ids = screen.getAllByTestId(/^(theme-card|profile-sensory-card|profile-data-management|profile-achievements-toggle|profile-quests-toggle)$/)
      .map((node) => node.props.testID as string);
    expect(ids.indexOf('theme-card')).toBeLessThan(ids.indexOf('profile-achievements-toggle'));
    expect(ids.indexOf('profile-sensory-card')).toBeLessThan(ids.indexOf('profile-achievements-toggle'));
    expect(ids.indexOf('profile-data-management')).toBeLessThan(ids.indexOf('profile-quests-toggle'));
    expect(screen.getByTestId('profile-achievements-toggle').props.accessibilityState.expanded).toBe(false);
  });

  it('opens records deliberately and uses percent units only for normalized achievements', async () => {
    await renderProfile();
    await fireEvent.press(screen.getByTestId('profile-achievements-toggle'));
    expect(screen.getByTestId('profile-achievements-toggle').props.accessibilityState.expanded).toBe(true);
    const achievement = screen.getByTestId(`profile-achievement-${BEST.id}`);
    expect(within(achievement).getByText('56% / 90%')).toBeOnTheScreen();
    expect(within(achievement).getByLabelText(`${BEST.title}, 56% / 90%`)).toBeOnTheScreen();
    expect(within(achievement).queryByText(/0\.5599999999999999/)).toBeNull();
    expect(mockData.achievementProgress.get(BEST.id)?.progress).toBe(RAW_PROGRESS);
    await fireEvent.press(screen.getByTestId('profile-quests-toggle'));
    const quest = screen.getByTestId(`profile-quest-${QUEST.id}`);
    expect(within(quest).getByText('1.23 / 3')).toBeOnTheScreen();
    expect(within(quest).getByLabelText(`${QUEST.title}, 1.23 / 3`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('profile-achievements-toggle'));
    expect(screen.queryByTestId(`profile-achievement-${BEST.id}`)).toBeNull();
    expect(screen.getByTestId('profile-settings-theme-system')).toBeOnTheScreen();
  });

  it('keeps the existing data and equipped-cosmetic destinations reachable', async () => {
    await renderProfile();
    await fireEvent.press(screen.getByTestId('profile-data-management'));
    expect(mockReplace).toHaveBeenLastCalledWith('/data-management');
    await fireEvent.press(screen.getByTestId('profile-equipped'));
    expect(mockReplace).toHaveBeenLastCalledWith('/rewards');
    await fireEvent.press(screen.getByTestId('profile-cosmetics'));
    expect(mockReplace).toHaveBeenLastCalledWith('/rewards');
  });

  it('reflows compact enlarged text without truncating player identity', async () => {
    Object.assign(mockViewport, { width: 320, height: 640, fontScale: 2 });
    await renderProfile();
    expect(screen.getByTestId('profile-name')).toHaveTextContent('Alex Rivera');
    expect(screen.getByTestId('profile-name').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('profile-metrics')).toHaveStyle({ flexDirection: 'column' });
    expect(streakRail()).toHaveStyle({ flexDirection: 'column', alignItems: 'stretch' });
    expect(screen.getByText('Best 0 days · 1 protection items').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('profile-settings-theme-system')).toBeEnabled();
  });

  it.each([
    { width: 390, fontScale: 1, longest: 2, freeze: 0 },
    { width: 411, fontScale: 1, longest: 2, freeze: 0 },
    { width: 360, fontScale: 1.4, longest: 123456, freeze: 987654 },
  ])('lets the complete streak caption reflow at $width dp / $fontScale text', async ({ width, fontScale, longest, freeze }) => {
    Object.assign(mockViewport, { width, fontScale });
    mockData.currentStreak = 2;
    mockData.longestStreak = longest;
    mockData.inventory = { freeze, shield: 0, recovery: 0 };
    await renderProfile();
    const caption = screen.getByText(`Best ${longest} days · ${freeze} protection items`);
    const rail = streakRail();
    expect(caption.parent).toBe(rail);
    expect(rail).toHaveStyle({ flexDirection: 'row' });
    expect(caption.props.numberOfLines).toBeUndefined();
    expect(caption.props.ellipsizeMode).toBeUndefined();
    // These ordinary widths bypass the explicit compact/2x stack. The real
    // caller must let intrinsic-width siblings flow to separate lines, and
    // bound the text itself when a long count exceeds even a complete line.
    // RNTL does not run Yoga: native pixels remain a separate acceptance gate.
    const railStyle = ReactNative.StyleSheet.flatten(rail?.props.style);
    const captionStyle = ReactNative.StyleSheet.flatten(caption.props.style);
    expect(railStyle.flexDirection === 'column' || railStyle.flexWrap === 'wrap').toBe(true);
    expect(captionStyle.maxWidth === '100%' || captionStyle.width === '100%' || captionStyle.flexShrink === 1).toBe(true);
  });

  it('keeps the streak strip and caption eligible for one row on expanded screens', async () => {
    Object.assign(mockViewport, { width: 720, height: 1280 });
    await renderProfile();
    const caption = screen.getByText('Best 0 days · 1 protection items');
    expect(streakRail()).toHaveStyle({ flexDirection: 'row' });
    const captionStyle = ReactNative.StyleSheet.flatten(caption.props.style);
    expect(captionStyle.width).toBeUndefined();
    expect(captionStyle.flexBasis).toBeUndefined();
    expect(caption.props.numberOfLines).toBeUndefined();
  });
});
