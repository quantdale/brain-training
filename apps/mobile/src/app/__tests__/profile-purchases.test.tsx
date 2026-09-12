/**
 * Profile streak-item purchase failure paths (campaign 027 hardening).
 *
 * Pins the profile economy UX when a purchase cannot complete:
 * - below cost: the price button is disabled and the gated handler never
 *   reaches the economy (balance and inventory unchanged);
 * - the repository rejects with `InsufficientFundsError` despite the UI gate
 *   (concurrent spend race): the user sees the "Not enough coins"
 *   celebration and neither balance nor inventory moves;
 * - any other repository rejection is SWALLOWED (`console.error` only,
 *   src/app/(tabs)/profile.tsx:471-476): no user-visible error exists and the
 *   inventory stays unchanged (defect).
 *
 * Renders the REAL ProfileScreen wrapped in SettingsProvider (the provider
 * the app shell supplies), with `@/db` serving a fake repository surface and
 * the progression sync mocked so the loader is deterministic. Mirrors the
 * mocking pattern of data-management.test.tsx / visual-baselines.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';

import ProfileScreen from '@/app/(tabs)/profile';
import { SettingsProvider } from '@/components/settings/settings-provider';
import { ToastHost, resetToastQueueForTests } from '@/components/ui';
import {
  InsufficientFundsError,
  purchaseStreakItem,
  type AppDatabase,
} from '@/db';
import { applyOwnedStreakItem } from '@/streaks';

const FREEZE_COST = 100;

/** Test-controlled db surface served by the mocked `@/db` module. */
const mockDbState: {
  db: AppDatabase | null;
  balance: number;
  settings: Record<string, unknown>;
} = { db: null, balance: 0, settings: {} };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return {
    ...actual,
    getDb: () => mockDbState.db,
    purchaseStreakItem: jest.fn(),
  };
});

jest.mock('@/progression', () => {
  const actual = jest.requireActual('@/progression') as Record<string, unknown>;
  return {
    ...actual,
    syncQuestProgress: jest.fn(async () => ({
      sessions: [],
      lifetime: { sessionCount: 0, totalXp: 0 },
    })),
    syncAchievements: jest.fn(async () => undefined),
    buildAchievementSnapshot: jest.fn(async () => ({
      sessionCount: 0,
      totalXp: 0,
      domainSessions: {},
      longestStreak: 0,
      perfectSessions: 0,
      distinctGames: 0,
      domainCoverage: 0,
      activeDays: 0,
      accuracySessions: 0,
      bestNormalized: 0,
      workoutsCompleted: 0,
    })),
  };
});

const mockedPurchase = jest.mocked(purchaseStreakItem);

jest.mock('@/streaks', () => {
  const actual = jest.requireActual('@/streaks') as Record<string, unknown>;
  return {
    ...actual,
    applyOwnedStreakItem: jest.fn(),
    // The apply gate is covered by the streak action suites; here it only
    // needs to expose the Apply control so the handler mapping is testable.
    canApplyFreeze: jest.fn(() => true),
    canApplyShield: jest.fn(() => true),
    canApplyRecovery: jest.fn(() => true),
  };
});

const mockedApply = jest.mocked(applyOwnedStreakItem);

/** Minimal repository surface used by loadProfile. */
function makeDb(): AppDatabase {
  return {
    ledger: { getBalance: async () => mockDbState.balance },
    profile: { get: async () => ({ settings: mockDbState.settings }) },
    achievements: { listUnlocks: async () => [] },
    quests: { listProgressForPeriod: async () => [] },
    sessions: {
      getTotalXp: async () => 0,
      listLightweight: async () => [],
      getDistinctActivityDates: async () => [],
    },
    xpAwards: { getTotalAwardedXp: async () => 0 },
  } as unknown as AppDatabase;
}

async function renderProfile() {
  mockDbState.db = makeDb();
  await renderRouter(
    {
      profile: () => (
        <SettingsProvider>
          <ToastHost />
          <ProfileScreen />
        </SettingsProvider>
      ),
    },
    { initialUrl: '/profile' },
  );
  jest.useRealTimers();
  await screen.findByTestId('profile-title', {}, { timeout: 10_000 });
}

/** Exact rendered metric text (value + label) for a coin balance. */
function coinsMetric(balance: number): RegExp {
  return new RegExp(`^${balance}Coins$`);
}

/** The freeze buy control once the loaded balance has been applied. */
async function findLoadedBuyButton(balance: number) {
  await waitFor(() =>
    expect(screen.getByTestId('profile-metric-coins')).toHaveTextContent(
      coinsMetric(balance),
    ),
  );
  return screen.getByTestId('streak-buy-freeze');
}

beforeEach(() => {
  jest.clearAllMocks();
  resetToastQueueForTests();
  mockDbState.balance = 0;
  mockDbState.settings = {};
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('profile streak-item purchase failure paths', () => {
  it('disables a below-cost purchase and never reaches the economy', async () => {
    mockDbState.balance = 50;
    await renderProfile();

    const buy = await findLoadedBuyButton(50);
    expect(buy.props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(buy);

    expect(mockedPurchase).not.toHaveBeenCalled();
    // Balance and owned inventory are unchanged.
    expect(screen.getByTestId('profile-metric-coins')).toHaveTextContent(
      coinsMetric(50),
    );
    expect(screen.getByText('Freeze × 0')).toBeOnTheScreen();
  });

  it('surfaces the insufficient-funds race and leaves balance/inventory unchanged', async () => {
    mockDbState.balance = FREEZE_COST;
    mockedPurchase.mockRejectedValue(
      new InsufficientFundsError(FREEZE_COST, 0),
    );
    await renderProfile();

    const buy = await findLoadedBuyButton(FREEZE_COST);
    expect(buy.props.accessibilityState?.disabled).toBe(false);

    await fireEvent.press(buy);

    // The catch maps InsufficientFundsError onto the user-visible warning beat.
    expect(
      await screen.findByTestId('reward-celebration', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Not enough coins')).toBeOnTheScreen();
    expect(mockedPurchase).toHaveBeenCalledTimes(1);
    expect(mockedPurchase).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: 'freeze', cost: FREEZE_COST }),
    );
    // No spend happened: the loaded balance and inventory are still rendered.
    expect(screen.getByTestId('profile-metric-coins')).toHaveTextContent(
      coinsMetric(FREEZE_COST),
    );
    expect(screen.getByText('Freeze × 0')).toBeOnTheScreen();
  });

  it('surfaces a generic repository rejection with a danger toast', async () => {
    mockDbState.balance = FREEZE_COST;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedPurchase.mockRejectedValue(new Error('db write boom'));
    await renderProfile();

    const buy = await findLoadedBuyButton(FREEZE_COST);
    await fireEvent.press(buy);

    await waitFor(() => expect(mockedPurchase).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[profile] streak item purchase failed',
        expect.any(Error),
      ),
    );

    // Campaign 027: the failure is user-visible now (toast), no celebration
    // plays, and the inventory is unchanged.
    expect(await screen.findByTestId('toast', {}, { timeout: 5000 })).toHaveTextContent(
      /Purchase failed/,
    );
    expect(screen.queryByTestId('reward-celebration')).toBeNull();
    expect(screen.getByText('Freeze × 0')).toBeOnTheScreen();
  });

  it('celebrates a successful apply without the stale no-item warning', async () => {
    mockDbState.balance = 0;
    mockedApply.mockResolvedValue('applied');
    await renderProfile();

    await fireEvent.press(await screen.findByTestId('streak-apply-shield'));

    expect(
      await screen.findByTestId('reward-celebration', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Streak protected!')).toBeOnTheScreen();
    // Regression (Campaign 027): the applied branch also fired "No item to
    // apply", so every successful protection read as a failure too.
    expect(screen.queryByText('No item to apply')).toBeNull();
  });

  it('reports a no-item apply without claiming protection', async () => {
    mockDbState.balance = 0;
    mockedApply.mockResolvedValue('no-item');
    await renderProfile();

    await fireEvent.press(await screen.findByTestId('streak-apply-shield'));

    expect(
      await screen.findByTestId('reward-celebration', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(screen.getByText('No item to apply')).toBeOnTheScreen();
    expect(screen.queryByText('Streak protected!')).toBeNull();
  });
});
