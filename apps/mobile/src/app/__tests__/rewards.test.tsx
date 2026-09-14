/**
 * Rewards failure-path tests (campaign 027 hardening).
 *
 * Pins what the /rewards screen does when a claim WRITE fails:
 * - a single claim whose canonical write throws surfaces a danger toast,
 *   keeps the item claimable and never queues a celebration (Campaign 027
 *   fixed the console-only swallow, src/app/rewards.tsx);
 * - claim-all has NO per-item error isolation (`claimAllRewards` loops raw,
 *   src/rewards/inbox.ts) — a mid-loop throw aborts the pass, the earlier
 *   claim stays durable, the screen refreshes and shows the failure toast.
 *
 * The inbox item collection is real (`collectClaimableRewards`); only the
 * canonical claim primitive (`claimAchievementReward`) is mocked to inject the
 * write failure, and `@/db` serves a fake repository surface. This mirrors the
 * mocking pattern of data-management.test.tsx / results-workout-cta.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from 'expo-router/testing-library';

import RewardsScreen from '@/app/rewards';
import { ToastHost, resetToastQueueForTests } from '@/components/ui';
import {
  ACHIEVEMENT_DEFINITIONS_V1,
  claimAchievementReward,
  type AchievementClaimResult,
} from '@/achievements';
import {
  COSMETIC_DEFINITIONS,
  equipCosmeticPersisted,
  purchaseCosmetic,
} from '@/cosmetics';
import { refreshProgression } from '@/progression';
import type { AchievementUnlock, AppDatabase } from '@/db';

const ACH_FIRST = ACHIEVEMENT_DEFINITIONS_V1[0]; // ach-first
const ACH_SECOND = ACHIEVEMENT_DEFINITIONS_V1[1]; // ach-25

/** First purchasable cosmetic (cos-frame-azure) — the buy-path fixture. */
const PURCHASEABLE = COSMETIC_DEFINITIONS.find(
  (def) => def.unlock.type === 'purchase',
)!;

/** Test-controlled db surface served by the mocked `@/db` module. */
const mockDbState: {
  db: AppDatabase | null;
  unlockRows: AchievementUnlock[];
  /** Ledger balance the cosmetics economy sees. */
  balance: number;
  /** Profile settings the ownership resolution reads. */
  settings: Record<string, unknown>;
} = { db: null, unlockRows: [], balance: 0, settings: {} };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return { ...actual, getDb: () => mockDbState.db };
});

jest.mock('@/achievements', () => {
  const actual = jest.requireActual('@/achievements') as Record<string, unknown>;
  return { ...actual, claimAchievementReward: jest.fn() };
});

jest.mock('@/cosmetics', () => {
  const actual = jest.requireActual('@/cosmetics') as Record<string, unknown>;
  return {
    ...actual,
    purchaseCosmetic: jest.fn(),
    equipCosmeticPersisted: jest.fn(),
  };
});

jest.mock('@/rewards/history', () => ({
  loadRewardHistory: jest.fn(async () => []),
}));

// The screen syncs progression before collecting the inbox (frontier audit
// `progression-refresh-on-surfaces`). The sync engine itself is pinned by the
// progression suite; here only the load-path wiring is pinned.
jest.mock('@/progression', () => {
  const actual = jest.requireActual('@/progression') as Record<string, unknown>;
  return { ...actual, refreshProgression: jest.fn(async () => undefined) };
});

const mockedClaimAchievement = jest.mocked(claimAchievementReward);
const mockedPurchase = jest.mocked(purchaseCosmetic);
const mockedEquip = jest.mocked(equipCosmeticPersisted);
const mockedRefreshProgression = jest.mocked(refreshProgression);

/** Minimal repository surface used by loadRewards + collectClaimableRewards. */
function makeDb(): AppDatabase {
  return {
    ledger: { getBalance: async () => mockDbState.balance },
    profile: { get: async () => ({ settings: mockDbState.settings }) },
    achievements: { listUnlocks: async () => mockDbState.unlockRows },
    quests: { listProgressForQuest: async () => [] },
    sessions: { getDistinctActivityDates: async () => [] },
  } as unknown as AppDatabase;
}

/** Same sanitisation the screen applies to composite inbox keys. */
function fragment(key: string): string {
  return key.replace(/[^a-zA-Z0-9]+/g, '-');
}

async function renderRewards() {
  mockDbState.db = makeDb();
  await renderRouter(
    {
      rewards: () => (
        <>
          <ToastHost />
          <RewardsScreen />
        </>
      ),
    },
    { initialUrl: '/rewards' },
  );
  jest.useRealTimers();
  await screen.findByTestId('rewards-title', {}, { timeout: 10_000 });
}

/** The failure toast is the user-visible surface; no celebration plays. */
async function expectFailureToast(title: string) {
  const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
  expect(toast).toHaveTextContent(new RegExp(title));
  expect(screen.queryByTestId('reward-celebration')).toBeNull();
  expect(screen.queryByTestId('rewards-error')).toBeNull();
}

beforeEach(() => {
  jest.clearAllMocks();
  resetToastQueueForTests();
  mockDbState.unlockRows = [];
  mockDbState.balance = 0;
  mockDbState.settings = {};
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('rewards claim failure paths', () => {
  it('surfaces a single claim write failure and leaves the item unclaimed', async () => {
    mockDbState.unlockRows = [
      { achievementId: ACH_FIRST.id, unlockedAt: 0, claimedAt: null },
    ];
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedClaimAchievement.mockRejectedValue(new Error('claim write boom'));

    await renderRewards();
    const claimTestId = `reward-claim-${fragment(`achievement:${ACH_FIRST.id}`)}`;
    const itemTestId = `rewards-item-${fragment(`achievement:${ACH_FIRST.id}`)}`;
    await fireEvent.press(await screen.findByTestId(claimTestId));

    await waitFor(() =>
      expect(mockedClaimAchievement).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: ACH_FIRST.id }),
        expect.any(Date),
      ),
    );
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[rewards] claim failed',
        expect.any(Error),
      ),
    );

    // Re-read rendered state: the item is still claimable after the failure,
    // and the danger toast tells the player nothing was lost.
    expect(screen.getByTestId(itemTestId)).toBeOnTheScreen();
    expect(screen.getByTestId(claimTestId)).toBeOnTheScreen();
    await expectFailureToast("Couldn't claim that reward");
  });

  it('aborts claim-all on a mid-loop throw: first claim durable, failure surfaced', async () => {
    mockDbState.unlockRows = [
      { achievementId: ACH_FIRST.id, unlockedAt: 0, claimedAt: null },
      { achievementId: ACH_SECOND.id, unlockedAt: 0, claimedAt: null },
    ];
    const claimed = new Set<string>();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedClaimAchievement.mockImplementation(
      async (_db, def): Promise<AchievementClaimResult> => {
        if (def.id === ACH_SECOND.id) {
          throw new Error('second claim boom');
        }
        claimed.add(def.id);
        return { status: 'claimed' };
      },
    );

    await renderRewards();
    await fireEvent.press(await screen.findByTestId('rewards-claim-all'));

    // The pass reached both items in order: the first claim committed, the
    // second threw and aborted claimAllRewards before it could report.
    await waitFor(() => expect(mockedClaimAchievement).toHaveBeenCalledTimes(2));
    expect(mockedClaimAchievement.mock.calls.map(([, def]) => def.id)).toEqual([
      ACH_FIRST.id,
      ACH_SECOND.id,
    ]);
    expect(claimed.has(ACH_FIRST.id)).toBe(true);

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[rewards] claim-all failed',
        expect.any(Error),
      ),
    );

    // The screen refreshes after the failure (durable claims resync) and the
    // danger toast reports it; the failed pass is never presented as success.
    expect(
      screen.getByTestId(`reward-claim-${fragment(`achievement:${ACH_FIRST.id}`)}`),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(`reward-claim-${fragment(`achievement:${ACH_SECOND.id}`)}`),
    ).toBeOnTheScreen();
    await expectFailureToast("Couldn't claim rewards");
  });
});

describe('rewards cosmetic action failure paths (campaign 028)', () => {
  const BUY_ID = `cosmetic-buy-${PURCHASEABLE.id}`;
  const AZURE_OWNED_SETTINGS = {
    cosmetics: { owned: [PURCHASEABLE.id], equipped: {} },
  };

  it('surfaces a purchase rejection: danger toast, nothing bought or spent, retryable', async () => {
    const price = PURCHASEABLE.price ?? 0;
    mockDbState.balance = price;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedPurchase.mockRejectedValue(new Error('purchase boom'));

    await renderRewards();
    // The spend requires a confirming second tap: first press arms it.
    await fireEvent.press(await screen.findByTestId(BUY_ID));
    await waitFor(() =>
      expect(screen.getByTestId(BUY_ID).props.accessibilityLabel).toMatch(
        /Confirm purchase/,
      ),
    );
    await fireEvent.press(screen.getByTestId(BUY_ID));

    await waitFor(() => expect(mockedPurchase).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[rewards] purchase failed',
        expect.any(Error),
      ),
    );

    // Campaign 028: the rejection is user-visible now, no celebration plays.
    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't purchase that/);
    expect(screen.queryByTestId('reward-celebration')).toBeNull();

    // Unchanged: still locked/purchasable and the balance is untouched.
    expect(screen.getByTestId(BUY_ID)).toBeOnTheScreen();
    expect(screen.getByTestId('rewards-balance')).toHaveTextContent(
      new RegExp(`^${price} coins`),
    );

    // Retryable: the busy guard reset in `finally`, so a re-armed + confirmed
    // attempt reaches the economy again.
    await fireEvent.press(screen.getByTestId(BUY_ID));
    await fireEvent.press(screen.getByTestId(BUY_ID));
    await waitFor(() => expect(mockedPurchase).toHaveBeenCalledTimes(2));
  });

  it('surfaces an equip rejection: danger toast and ownership/equip unchanged', async () => {
    mockDbState.settings = AZURE_OWNED_SETTINGS;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedEquip.mockRejectedValue(new Error('equip boom'));

    await renderRewards();
    const equipTestId = `cosmetic-equip-${PURCHASEABLE.id}`;
    await fireEvent.press(await screen.findByTestId(equipTestId));

    await waitFor(() => expect(mockedEquip).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(
        '[rewards] equip failed',
        expect.any(Error),
      ),
    );

    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't equip that/);
    expect(screen.queryByTestId('reward-celebration')).toBeNull();

    // Unchanged: still owned (Equip still offered) and not equipped.
    const card = screen.getByTestId(`rewards-cosmetic-${PURCHASEABLE.id}`);
    expect(card).toHaveTextContent(/Owned/);
    expect(card).not.toHaveTextContent(/Equipped/);
    expect(screen.getByTestId(equipTestId)).toBeOnTheScreen();
  });

  it('surfaces an equip no-op when ownership was lost between render and tap', async () => {
    mockDbState.settings = AZURE_OWNED_SETTINGS;
    mockedEquip.mockResolvedValue(false);

    await renderRewards();
    const equipTestId = `cosmetic-equip-${PURCHASEABLE.id}`;
    await fireEvent.press(await screen.findByTestId(equipTestId));

    await waitFor(() => expect(mockedEquip).toHaveBeenCalledTimes(1));

    // Campaign 028 sweep: `false` is a silent no-op in the old code; it now
    // reports the honest reason (equipping never touches currency).
    const toast = await screen.findByTestId('toast', {}, { timeout: 5000 });
    expect(toast).toHaveTextContent(/Couldn't equip that/);
    expect(toast).toHaveTextContent(/no longer owned/);
    expect(screen.queryByTestId('reward-celebration')).toBeNull();
    expect(screen.getByTestId(equipTestId)).toBeOnTheScreen();
  });
});

describe('rewards progression refresh wiring', () => {
  it('syncs progression before reading the inbox', async () => {
    await renderRewards();

    expect(mockedRefreshProgression).toHaveBeenCalled();
  });
});
