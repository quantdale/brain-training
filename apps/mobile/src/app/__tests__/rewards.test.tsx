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
import type { AchievementUnlock, AppDatabase } from '@/db';

const ACH_FIRST = ACHIEVEMENT_DEFINITIONS_V1[0]; // ach-first
const ACH_SECOND = ACHIEVEMENT_DEFINITIONS_V1[1]; // ach-25

/** Test-controlled db surface served by the mocked `@/db` module. */
const mockDbState: {
  db: AppDatabase | null;
  unlockRows: AchievementUnlock[];
} = { db: null, unlockRows: [] };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return { ...actual, getDb: () => mockDbState.db };
});

jest.mock('@/achievements', () => {
  const actual = jest.requireActual('@/achievements') as Record<string, unknown>;
  return { ...actual, claimAchievementReward: jest.fn() };
});

jest.mock('@/rewards/history', () => ({
  loadRewardHistory: jest.fn(async () => []),
}));

const mockedClaimAchievement = jest.mocked(claimAchievementReward);

/** Minimal repository surface used by loadRewards + collectClaimableRewards. */
function makeDb(): AppDatabase {
  return {
    ledger: { getBalance: async () => 0 },
    profile: { get: async () => ({ settings: {} }) },
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
