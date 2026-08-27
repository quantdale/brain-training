/**
 * Full workout lifecycle (Queue A/B hardening): selection → persistence →
 * resume → launch → completion → advance → final completion → reroll
 * economics → date rollover → app restart → partial completion.
 *
 * These tests run the REAL hook against the REAL AppDatabase (node-backed
 * in-memory sqlite via the jest setup) and the REAL generated registry, so
 * every transition below is exercised end-to-end rather than mocked:
 *
 *  - kill/relaunch mid-workout resumes at the persisted position,
 *  - the fourth completion flips the instance to `completed` exactly once and
 *    further advances/re-views are idempotent,
 *  - rerolls persist attempts, keep the completed prefix immutable, stay free
 *    the first time, escalate coins after, respect the daily cap, and are
 *    REFUSED on a completed workout (no pointless debit),
 *  - date rollover leaves yesterday's partial row untouched and starts a fresh
 *    active instance for the new local date,
 *  - stored instances referencing retired game ids are reconciled on load
 *    (dropped / regenerated) instead of crashing or launching a dead game.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getDb, initDatabase } from '@/db';
import { registry } from '@/registry/registry.generated';
import { registerGameDefinitions } from '@/registry/registry';
import { nextWorkoutGameId, shouldAdvanceWorkout } from '@/workout/advance';
import { localDateString } from '@/workout/today';
import { MAX_REROLLS_PER_DAY } from '@/workout/reroll';
import { useWorkout } from '@/workout/use-workout';

/**
 * Injectable local calendar date for the rollover suite: `@/workout/today` is
 * partially mocked so ONLY `localDateString` reads this holder (selection,
 * chain math and date arithmetic stay real). This avoids fake timers entirely
 * while keeping every transition deterministic.
 */
const mockClock = { today: '2026-08-20' };
jest.mock('@/workout/today', () => {
  const actual = jest.requireActual<typeof import('@/workout/today')>(
    '@/workout/today',
  );
  return {
    ...actual,
    localDateString: () => mockClock.today,
  };
});

describe('workout lifecycle (real db + real registry)', () => {
  beforeEach(async () => {
    mockClock.today = '2026-08-20';
    await initDatabase();
    // The root layout normally registers the catalog during bootstrap; the
    // hook depends on it for selection, so register it here.
    registerGameDefinitions(registry);
  });

  it('selection → persistence: mounting creates today’s instance exactly once', async () => {
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    const first = result.current.instance!;
    expect(first.date).toBe(localDateString());
    expect(first.status).toBe('active');
    expect(first.currentIndex).toBe(0);
    expect(first.gameIds.length).toBeGreaterThan(0);

    // Remount (fresh hook, same db): same persisted instance, not a re-seed.
    const second = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(second.result.current.instance).not.toBeNull());
    expect(second.result.current.instance!.gameIds).toEqual(first.gameIds);
    expect(second.result.current.instance!.createdAt).toBe(first.createdAt);
  });

  it('completion → advance → final completion, then idempotent forever', async () => {
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());
    const ids = result.current.instance!.gameIds;

    // Play the whole day: each session carries the exact CURRENT resume leg.
    for (let i = 0; i < ids.length; i += 1) {
      const session = {
        gameId: ids[i],
        workoutProvenance: {
          instanceKey: result.current.instance!.date,
          legIndex: i,
          gameId: ids[i],
        },
      };
      expect(result.current.status).toBe('active');
      expect(
        shouldAdvanceWorkout(session, result.current.instance),
      ).toBe(true);
      await act(async () => {
        await result.current.advance();
      });
      if (i < ids.length - 1) {
        expect(result.current.instance!.currentIndex).toBe(i + 1);
        expect(nextWorkoutGameId(result.current.instance)).toBe(ids[i + 1]);
      }
    }

    // Final completion: exhausted list, completed status, counted once.
    expect(result.current.status).toBe('completed');
    expect(result.current.instance!.currentIndex).toBe(ids.length);
    expect(nextWorkoutGameId(result.current.instance)).toBeNull();
    expect(await getDb().workouts.countCompleted()).toBe(1);

    // Idempotency: extra advances and re-viewed sessions change nothing.
    await act(async () => {
      await result.current.advance();
    });
    expect(result.current.instance!.currentIndex).toBe(ids.length);
    expect(result.current.instance!.status).toBe('completed');
    expect(await getDb().workouts.countCompleted()).toBe(1);
    expect(
      shouldAdvanceWorkout(
        {
          gameId: ids[ids.length - 1],
          workoutProvenance: {
            instanceKey: result.current.instance!.date,
            legIndex: ids.length - 1,
            gameId: ids[ids.length - 1],
          },
        },
        result.current.instance,
      ),
    ).toBe(false);
  });

  it('kill/relaunch mid-workout resumes at the persisted position (partial completion)', async () => {
    // Session 1: play two games, then the process dies. The "relaunched"
    // process shares nothing in memory — hook B only reads persisted state.
    const first = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(first.result.current.instance).not.toBeNull());
    const ids = first.result.current.instance!.gameIds;
    await act(async () => {
      await first.result.current.advance();
      await first.result.current.advance();
    });

    // Relaunch: a brand-new hook over the SAME store resumes mid-workout.
    const relaunched = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() =>
      expect(relaunched.result.current.instance).not.toBeNull(),
    );
    const resumed = relaunched.result.current.instance!;
    expect(resumed.gameIds).toEqual(ids); // no re-selection on restart
    expect(resumed.currentIndex).toBe(2);
    expect(resumed.status).toBe('active');
    expect(relaunched.result.current.currentGameId).toBe(ids[2]);
    expect(relaunched.result.current.progress).toEqual({ current: 2, total: ids.length });
  });

  it('reroll after partial completion: prefix immutable, played game excluded, first free then escalating', async () => {
    await getDb().ledger.append({ amount: 1_000, reason: 'seed' });
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 1_000 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());
    const ids = result.current.instance!.gameIds;

    // Complete game 1, then take the FREE first reroll.
    await act(async () => {
      await result.current.advance();
    });
    await act(async () => {
      await result.current.reroll();
    });
    let inst = result.current.instance!;
    expect(inst.rerollAttempt).toBe(1);
    expect(inst.gameIds[0]).toBe(ids[0]); // completed prefix immutable
    expect(inst.gameIds.slice(1)).not.toContain(ids[0]); // never reintroduced
    expect(await getDb().ledger.getBalance()).toBe(1_000); // first reroll free

    // Second reroll costs 25 coins, atomically debited with the transition.
    await act(async () => {
      await result.current.reroll();
    });
    inst = result.current.instance!;
    expect(inst.rerollAttempt).toBe(2);
    expect(await getDb().ledger.getBalance()).toBe(975);
    // Persisted, not just local state.
    const persisted = await getDb().workouts.getByDate(localDateString());
    expect(persisted?.rerollAttempt).toBe(2);
    expect(persisted?.gameIds[0]).toBe(ids[0]);
  });

  it('reroll respects the daily cap and stops debiting at the cap', async () => {
    await getDb().ledger.append({ amount: 10_000, reason: 'seed' });
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 10_000 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    for (let i = 0; i < MAX_REROLLS_PER_DAY; i += 1) {
      await act(async () => {
        await result.current.reroll();
      });
    }
    expect(result.current.instance!.rerollAttempt).toBe(MAX_REROLLS_PER_DAY);
    // Free + 25 + 50 + 75 + 100 = 250 total debited.
    expect(await getDb().ledger.getBalance()).toBe(10_000 - 250);

    // Cap reached: further calls are no-ops (no attempt bump, no debit).
    await act(async () => {
      await result.current.reroll();
    });
    expect(result.current.instance!.rerollAttempt).toBe(MAX_REROLLS_PER_DAY);
    expect(await getDb().ledger.getBalance()).toBe(10_000 - 250);
  });

  it('reroll is REFUSED on a completed workout (no attempt bump, no debit)', async () => {
    await getDb().ledger.append({ amount: 1_000, reason: 'seed' });
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 1_000 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());
    const ids = result.current.instance!.gameIds;

    // Finish the whole day.
    for (let i = 0; i < ids.length; i += 1) {
      await act(async () => {
        await result.current.advance();
      });
    }
    expect(result.current.status).toBe('completed');

    // A reroll now would replace nothing yet still debit — the hook refuses.
    await act(async () => {
      await result.current.reroll();
    });
    expect(result.current.instance!.rerollAttempt).toBe(0);
    expect(result.current.instance!.gameIds).toEqual(ids);
    expect(result.current.instance!.status).toBe('completed');
    expect(await getDb().ledger.getBalance()).toBe(1_000);
  });

  it('catalog drift: stored instance with a retired id is repaired on load', async () => {
    const registeredIds = registry.map((g) => g.id);
    const [a, b, c] = registeredIds;
    const ghost = 'ghost-retired-game';

    // Persist an instance that references a game the catalog no longer has,
    // with progress already past the first game.
    const workouts = getDb().workouts;
    await workouts.getOrCreate(localDateString(), {
      gameIds: [a, b, ghost, c],
      seedVersion: 1,
    });
    await workouts.advance(localDateString()); // resume point now at b

    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    const inst = result.current.instance!;
    expect(inst.gameIds).toEqual([a, b, c]); // ghost dropped, order kept
    expect(inst.currentIndex).toBe(1); // resume lands on the same game b
    expect(result.current.currentGameId).toBe(b);
    expect(result.current.progress).toEqual({ current: 1, total: 3 });
  });

  it('catalog drift: fully-stale instance regenerates a fresh selection', async () => {
    const workouts = getDb().workouts;
    await workouts.getOrCreate(localDateString(), {
      gameIds: ['ghost-1', 'ghost-2', 'ghost-3', 'ghost-4'],
      seedVersion: 1,
    });

    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    const inst = result.current.instance!;
    const registered = new Set(registry.map((g) => g.id));
    for (const id of inst.gameIds) {
      expect(registered.has(id)).toBe(true); // every slot is a live game
    }
    expect(new Set(inst.gameIds).size).toBe(inst.gameIds.length);
    expect(inst.status).toBe('active');
    expect(inst.currentIndex).toBe(0);
  });
});

describe('date rollover (injected local date)', () => {
  beforeEach(async () => {
    mockClock.today = '2026-08-20';
    await initDatabase();
    registerGameDefinitions(registry);
  });

  it('rollover preserves each day’s partial row and every new day starts fresh', async () => {
    // Evening of Aug 20: play one game of the day's workout.
    const evening = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() =>
      expect(evening.result.current.instance?.date).toBe('2026-08-20'),
    );
    const day1 = evening.result.current.instance!;
    await act(async () => {
      await evening.result.current.advance();
    });
    expect(evening.result.current.instance!.currentIndex).toBe(1);

    // Next day: a relaunch must create a NEW active instance while
    // yesterday's partial row stays exactly as it was left.
    mockClock.today = '2026-08-21';
    const morning = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() =>
      expect(morning.result.current.instance?.date).toBe('2026-08-21'),
    );
    expect(morning.result.current.instance!.currentIndex).toBe(0);
    expect(morning.result.current.instance!.status).toBe('active');
    expect(morning.result.current.instance!.createdAt).not.toBe(day1.createdAt);

    let storedDay1 = await getDb().workouts.getByDate('2026-08-20');
    expect(storedDay1?.currentIndex).toBe(1); // partial progress intact
    expect(storedDay1?.status).toBe('active'); // never silently completed
    expect(storedDay1?.gameIds).toEqual(day1.gameIds);

    // Same continuous screen (no remount) crossing into ANOTHER new day: the
    // [date]-keyed load effect picks up the new local date on re-render.
    mockClock.today = '2026-08-22';
    await act(async () => {
      await morning.rerender(undefined);
    });
    await waitFor(() =>
      expect(morning.result.current.instance?.date).toBe('2026-08-22'),
    );
    expect(morning.result.current.instance!.currentIndex).toBe(0);
    expect(morning.result.current.status).toBe('active');

    storedDay1 = await getDb().workouts.getByDate('2026-08-20');
    expect(storedDay1?.currentIndex).toBe(1);
    const storedDay2 = await getDb().workouts.getByDate('2026-08-21');
    expect(storedDay2?.currentIndex).toBe(0);

    // Three days of partial workouts: nothing counts as completed.
    expect(await getDb().workouts.countCompleted()).toBe(0);
  });
});

describe('repository-level rollover invariants', () => {
  beforeEach(async () => {
    await initDatabase();
  });

  it('getOrCreate on the next date never resurrects or mutates the previous day', async () => {
    const workouts = getDb().workouts;
    await workouts.getOrCreate('2026-08-20', {
      gameIds: ['g1', 'g2', 'g3', 'g4'],
      seedVersion: 1,
    });
    await workouts.advance('2026-08-20');
    await workouts.advance('2026-08-20');

    const nextDay = await workouts.getOrCreate('2026-08-21', {
      gameIds: ['n1', 'n2', 'n3', 'n4'],
      seedVersion: 1,
    });
    expect(nextDay.currentIndex).toBe(0);
    expect(nextDay.status).toBe('active');

    const dayBefore = await workouts.getByDate('2026-08-20');
    expect(dayBefore?.gameIds).toEqual(['g1', 'g2', 'g3', 'g4']);
    expect(dayBefore?.currentIndex).toBe(2);
    expect(dayBefore?.status).toBe('active');
  });
});
