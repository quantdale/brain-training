/**
 * Profile streak-item purchase failure paths (campaign 027 hardening).
 *
 * Pins the profile economy UX when a purchase cannot complete:
 * - below cost: the price button is disabled and the gated handler never
 *   reaches the economy (balance and inventory unchanged);
 * - the repository rejects with `InsufficientFundsError` despite the UI gate
 *   (concurrent spend race): the user sees the "Not enough coins"
 *   celebration and neither balance nor inventory moves;
 * - any other repository rejection is surfaced as a danger toast and the
 *   inventory stays unchanged.
 *
 * Campaign 034 moves achievement, quest and streak-milestone claim actions to
 * the Rewards owner. Profile keeps read-only motivation status and a single
 * Rewards entry point; canonical claim failure coverage lives in rewards.test.
 *
 * Renders the REAL ProfileScreen wrapped in SettingsProvider (the provider
 * the app shell supplies), with `@/db` serving a fake repository surface and
 * the progression sync mocked so the loader is deterministic. Mirrors the
 * mocking pattern of data-management.test.tsx / visual-baselines.test.tsx.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  act,
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';

import ProfileScreen from '@/app/(tabs)/profile';
import { SettingsProvider } from '@/components/settings/settings-provider';
import { ToastHost, resetToastQueueForTests } from '@/components/ui';
import {
  AppDatabase,
  InsufficientFundsError,
  purchaseStreakItem,
  type AchievementUnlock,
  type QuestProgress,
  type SQLiteAdapter,
} from '@/db';
import { createMigratedDb } from '@/db/__tests__/helpers';
import { applyOwnedStreakItem } from '@/streaks';
import { expectConsoleNoise } from '@/test-utils';

const FREEZE_COST = 100;
const T0 = 1_700_000_000_000;

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
  /** When set, a load read rejects with this error (profile load failure). */
  loadError: Error | null;
} = {
  db: null,
  balance: 0,
  settings: {},
  unlockRows: [],
  questRows: [],
  activityDates: [],
  updateError: null,
  loadError: null,
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
    refreshProgression: jest.fn(async () => ({
      sessions: [],
      lifetime: { sessionCount: 0, totalXp: 0 },
    })),
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
    quests: {
      listProgressForPeriod: async () => mockDbState.questRows,
      // Rewards' authoritative count scans every persisted quest period.
      listProgressForQuest: async (questId: string) =>
        mockDbState.questRows.filter((row) => row.questId === questId),
    },
    sessions: {
      getTotalXp: async () => 0,
      listLightweight: async () => [],
      getDistinctActivityDates: async () => {
        if (mockDbState.loadError) {
          throw mockDbState.loadError;
        }
        return mockDbState.activityDates;
      },
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
  mockDbState.loadError = null;
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
    mockedPurchase.mockRejectedValue(new Error('db write boom'));
    await renderProfile();

    const buy = await findLoadedBuyButton(FREEZE_COST);
    await expectConsoleNoise(
      /\[profile\] streak item purchase failed/,
      async () => {
        await fireEvent.press(buy);
        await waitFor(() => expect(mockedPurchase).toHaveBeenCalledTimes(1));
        // Campaign 027: the failure is user-visible now (toast), no
        // celebration plays, and the inventory is unchanged.
        expect(
          await screen.findByTestId('toast', {}, { timeout: 5000 }),
        ).toHaveTextContent(/Purchase failed/);
      },
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

describe('profile ownership grouping (campaign 034)', () => {
  it('keeps claim actions in Rewards and exposes one Profile entry point', async () => {
    mockDbState.unlockRows = [
      { achievementId: 'ach-first', unlockedAt: 0, claimedAt: null },
    ];
    await renderProfile();

    expect(screen.getByTestId('profile-rewards')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-rewards-entry')).toBeOnTheScreen();
    expect(screen.getByTestId('profile-rewards-pending')).toHaveTextContent(
      '1 ready',
    );
    expect(
      screen.getByText(/Unlocked — available in Rewards/),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('achievement-claim-ach-first')).toBeNull();
    expect(screen.queryByTestId('quest-claim')).toBeNull();
    expect(screen.queryByTestId('milestone-claim-mil-3')).toBeNull();
  });

  it('surfaces a theme persist rejection with a danger toast (sweep)', async () => {
    mockDbState.updateError = new Error('theme persist boom');
    await renderProfile();

    await expectConsoleNoise(/\[profile\] theme persist failed/, async () => {
      await fireEvent.press(
        await screen.findByTestId('profile-settings-theme-dark'),
      );
      const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
      expect(toast).toHaveTextContent(/Couldn't save your theme/);
    });
  });
});

describe('profile load failure honesty (frontier audit)', () => {
  it('shows error + retry instead of a zeroed new-player profile, and retry recovers', async () => {
    mockDbState.loadError = new Error('profile load boom');
    await renderProfile();

    // The failure is not presented as a fresh zeroed identity.
    expect(await screen.findByTestId('profile-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-identity')).toBeNull();

    // Recovery: the retry control re-runs the load; clearing the injected
    // failure lets the real content render.
    mockDbState.loadError = null;
    await fireEvent.press(screen.getByTestId('profile-error-action'));

    expect(
      await screen.findByTestId('profile-identity', {}, { timeout: 10_000 }),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('profile-error')).toBeNull();
  });
});

describe('065: stable streak-item purchase intent key', () => {
  it('reuses the same operationId when a failed purchase is retried', async () => {
    mockDbState.balance = FREEZE_COST;
    mockedPurchase
      .mockRejectedValueOnce(new Error('post-commit bridge failure'))
      .mockResolvedValueOnce(undefined as never);
    await renderProfile();

    const buy = await findLoadedBuyButton(FREEZE_COST);
    await expectConsoleNoise(
      /\[profile\] streak item purchase failed/,
      async () => {
        await fireEvent.press(buy);
        // The rejection is user-visible before the retry: the intent key must
        // survive the failure, not be regenerated.
        await screen.findByTestId('toast', {}, { timeout: 5000 });
        await fireEvent.press(buy);
        await waitFor(() => expect(mockedPurchase).toHaveBeenCalledTimes(2));
      },
    );

    const [first, second] = mockedPurchase.mock.calls.map(([, input]) => input);
    expect(first.operationId).toEqual(expect.any(String));
    expect(first.operationId).not.toBe('');
    expect(second.operationId).toBe(first.operationId);
  });

  it('ignores a double-tap while in flight, then reuses the pending key on retry', async () => {
    mockDbState.balance = FREEZE_COST;
    let rejectFirstAttempt: ((error: Error) => void) | undefined;
    mockedPurchase
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectFirstAttempt = reject;
        }) as never,
      )
      .mockResolvedValueOnce(undefined as never);
    await renderProfile();

    const buy = await findLoadedBuyButton(FREEZE_COST);
    await fireEvent.press(buy);
    expect(mockedPurchase).toHaveBeenCalledTimes(1);

    // A second tap while the first attempt is still pending must not open a
    // second economy call with a fresh key.
    await fireEvent.press(buy);
    expect(mockedPurchase).toHaveBeenCalledTimes(1);

    await expectConsoleNoise(
      /\[profile\] streak item purchase failed/,
      async () => {
        await act(async () => {
          rejectFirstAttempt?.(new Error('post-commit bridge failure'));
        });
        await screen.findByTestId('toast', {}, { timeout: 5000 });
        // Retry the same intent through the real UI path.
        await fireEvent.press(buy);
        await waitFor(() => expect(mockedPurchase).toHaveBeenCalledTimes(2));
      },
    );

    expect(mockedPurchase.mock.calls[1][1].operationId).toBe(
      mockedPurchase.mock.calls[0][1].operationId,
    );
  });
});

describe('065: purchase retry is idempotent at the repository boundary', () => {
  it('debits once when a committed purchase reports failure and the same key retries', async () => {
    // Real economy function over a real migrated database: the first attempt
    // commits its transaction but reports failure afterwards (the bridge/JS
    // failure the UI cannot distinguish from a rollback). The retry must hit
    // the same operation key and return the committed entry without a second
    // debit or grant.
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter, { now: () => T0 });
    await db.profile.ensureExists();
    await db.ledger.append({ amount: 100, reason: 'seed' });

    let failNextCommitReport = true;
    const flaky = new Proxy(db, {
      get(target, property, receiver) {
        if (property === 'transaction') {
          return async (fn: (txn: SQLiteAdapter) => Promise<unknown>) => {
            const result = await target.transaction(fn);
            if (failNextCommitReport) {
              failNextCommitReport = false;
              throw new Error('post-commit bridge failure');
            }
            return result;
          };
        }
        const value = Reflect.get(target, property, receiver) as unknown;
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) as AppDatabase;

    const realPurchase = (
      jest.requireActual('@/db') as { purchaseStreakItem: typeof purchaseStreakItem }
    ).purchaseStreakItem;
    const intent = {
      kind: 'freeze' as const,
      cost: 10,
      operationId: 'streak-item:intent-1',
      reason: 'streak-item-freeze',
    };

    await expect(realPurchase(flaky, intent)).rejects.toThrow(
      /post-commit bridge failure/,
    );
    // The debit committed even though the caller saw a rejection.
    expect(await db.ledger.getBalance()).toBe(90);

    const retried = await realPurchase(db, intent);
    expect(retried.inventory.freeze).toBe(1);
    expect(await db.ledger.getBalance()).toBe(90);
    expect(await db.ledger.list()).toHaveLength(2); // seed + exactly one debit

    await adapter.close();
  });
});
