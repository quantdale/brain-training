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
import { claimAchievementReward } from '@/achievements';
import {
  InsufficientFundsError,
  purchaseStreakItem,
  type AchievementUnlock,
  type AppDatabase,
  type QuestProgress,
} from '@/db';
import {
  applyQuestReward,
  currentPeriodKey,
  QUEST_DEFINITIONS_V1,
  selectActiveQuests,
} from '@/quests';
import {
  applyOwnedStreakItem,
  claimStreakMilestoneReward,
  previousDate,
} from '@/streaks';
import { localDateString } from '@/workout/today';

const FREEZE_COST = 100;

/** Test-controlled db surface served by the mocked `@/db` module. */
const mockDbState: {
  db: AppDatabase | null;
  balance: number;
  settings: Record<string, unknown>;
  /** Unlocked-but-unclaimed achievement rows the claim UI reads. */
  unlockRows: AchievementUnlock[];
  /** Quest progress rows the claim UI reads for the active period. */
  questRows: QuestProgress[];
  /** Local activity dates driving streak milestones. */
  activityDates: string[];
  /** When set, `profile.update` rejects with this error (theme persist). */
  updateError: Error | null;
} = {
  db: null,
  balance: 0,
  settings: {},
  unlockRows: [],
  questRows: [],
  activityDates: [],
  updateError: null,
};

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

jest.mock('@/achievements', () => {
  const actual = jest.requireActual('@/achievements') as Record<string, unknown>;
  return { ...actual, claimAchievementReward: jest.fn() };
});

jest.mock('@/quests', () => {
  const actual = jest.requireActual('@/quests') as Record<string, unknown>;
  return { ...actual, applyQuestReward: jest.fn() };
});

const mockedPurchase = jest.mocked(purchaseStreakItem);
const mockedClaimAchievement = jest.mocked(claimAchievementReward);
const mockedClaimMilestone = jest.mocked(claimStreakMilestoneReward);
const mockedApplyQuest = jest.mocked(applyQuestReward);

jest.mock('@/streaks', () => {
  const actual = jest.requireActual('@/streaks') as Record<string, unknown>;
  return {
    ...actual,
    applyOwnedStreakItem: jest.fn(),
    claimStreakMilestoneReward: jest.fn(),
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
    profile: {
      get: async () => ({ settings: mockDbState.settings }),
      // The theme-persist path writes here; tests can inject a rejection.
      update: jest.fn(async () => {
        if (mockDbState.updateError) {
          throw mockDbState.updateError;
        }
      }),
    },
    achievements: { listUnlocks: async () => mockDbState.unlockRows },
    quests: { listProgressForPeriod: async () => mockDbState.questRows },
    sessions: {
      getTotalXp: async () => 0,
      listLightweight: async () => [],
      getDistinctActivityDates: async () => mockDbState.activityDates,
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
  mockDbState.unlockRows = [];
  mockDbState.questRows = [];
  mockDbState.activityDates = [];
  mockDbState.updateError = null;
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

describe('profile claim rejection paths (campaign 028)', () => {
  it('surfaces an achievement claim rejection and leaves the reward claimable', async () => {
    mockDbState.unlockRows = [
      { achievementId: 'ach-first', unlockedAt: 0, claimedAt: null },
    ];
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedClaimAchievement.mockRejectedValue(new Error('achievement claim boom'));
    await renderProfile();

    await fireEvent.press(
      await screen.findByTestId('achievement-claim-ach-first'),
    );

    await waitFor(() => expect(mockedClaimAchievement).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[profile] achievement claim failed',
        expect.any(Error),
      ),
    );

    // Campaign 028: the rejection is user-visible now, no celebration plays.
    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't claim that achievement/);
    expect(screen.queryByTestId('reward-celebration')).toBeNull();
    // Unchanged: the unlock is still unclaimed, so the claim action remains.
    expect(screen.getByTestId('achievement-claim-ach-first')).toBeOnTheScreen();
    expect(screen.getByText(/Unlocked — claim your reward/)).toBeOnTheScreen();
  });

  it('surfaces a streak-milestone claim rejection and leaves it claimable', async () => {
    const today = localDateString();
    mockDbState.activityDates = [
      today,
      previousDate(today),
      previousDate(previousDate(today)),
    ];
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedClaimMilestone.mockRejectedValue(new Error('milestone claim boom'));
    await renderProfile();

    await fireEvent.press(await screen.findByTestId('milestone-claim-mil-3'));

    await waitFor(() => expect(mockedClaimMilestone).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[profile] milestone claim failed',
        expect.any(Error),
      ),
    );

    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't claim that reward/);
    expect(screen.queryByTestId('reward-celebration')).toBeNull();
    expect(screen.getByTestId('milestone-claim-mil-3')).toBeOnTheScreen();
  });

  it('surfaces a quest claim rejection and leaves it claimable', async () => {
    const now = new Date();
    const quest = selectActiveQuests(QUEST_DEFINITIONS_V1, now)[0];
    mockDbState.questRows = [
      {
        questId: quest.id,
        period: currentPeriodKey(quest.kind, now),
        progress: 999,
        completedAt: now.getTime(),
        claimedAt: null,
      },
    ];
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedApplyQuest.mockRejectedValue(new Error('quest claim boom'));
    await renderProfile();

    const claimTestId = `quest-claim-${quest.id}`;
    await fireEvent.press(await screen.findByTestId(claimTestId));

    await waitFor(() => expect(mockedApplyQuest).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[profile] quest claim failed',
        expect.any(Error),
      ),
    );

    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't claim that quest/);
    expect(screen.queryByTestId('reward-celebration')).toBeNull();
    expect(screen.getByTestId(claimTestId)).toBeOnTheScreen();
  });

  it('surfaces a theme persist rejection with a danger toast (sweep)', async () => {
    mockDbState.updateError = new Error('theme persist boom');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderProfile();

    await fireEvent.press(await screen.findByTestId('profile-settings-theme-dark'));

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[profile] theme persist failed',
        expect.any(Error),
      ),
    );
    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't save your theme/);
  });
});
