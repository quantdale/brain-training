/**
 * useWorkout hook tests (006R task 6.2 / 6.5).
 *
 * Exercises the durable workout context end-to-end against the real
 * AppDatabase (node-backed via the jest setup's expo→node adapter): the
 * instance loads/creates on mount, reroll persists the attempt count and is
 * transactional, and advance moves the resume index and persists it.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getDb, initDatabase, WorkoutWriteConflictError } from '@/db';
import { registry } from '@/registry/registry.generated';
import { registerGameDefinitions } from '@/registry/registry';
import { localDateString } from '@/workout/today';
import { useWorkout } from '@/workout/use-workout';

describe('useWorkout (task 6.2 / 6.5)', () => {
  beforeEach(async () => {
    await initDatabase();
    // The root layout normally registers the catalog during bootstrap; the
    // hook depends on it for selection, so register it here.
    registerGameDefinitions(registry);
  });

  it('loads/creates today’s persisted instance on mount', async () => {
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );

    await waitFor(() => expect(result.current.instance).not.toBeNull());
    expect(result.current.instance?.status).toBe('active');
    expect(result.current.instance?.gameIds.length).toBeGreaterThan(0);
    expect(result.current.currentGameId).toBe(result.current.instance?.gameIds[0] ?? null);
  });

  it('persists reroll attempts and debits currency on the paid reroll', async () => {
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 1000 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    // Seed the coin ledger so the paid reroll can actually debit.
    await getDb().ledger.append({ amount: 1000, reason: 'seed' });

    // First reroll is free (constitution §14); second reroll costs 25 coins.
    await act(async () => {
      await result.current.reroll();
    });
    await act(async () => {
      await result.current.reroll();
    });

    await waitFor(() => expect(result.current.instance!.rerollAttempt).toBe(2));

    // Persisted in the store, not just local state.
    const persisted = await getDb().workouts.getByDate(localDateString());
    expect(persisted?.rerollAttempt).toBe(2);
    // Still a full four-game selection after reroll.
    expect(persisted?.gameIds).toHaveLength(4);
    // First reroll free; second reroll cost 25 (balance 1000 - 25).
    expect(await getDb().ledger.getBalance()).toBe(975);
  });

  it('advances the resume index and persists it', async () => {
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    // 056: the hook no longer exposes the unconditional `advance()` bypass;
    // explicit progress moves through the db primitive, and the hook
    // re-reads via `refresh()`.
    await act(async () => {
      await getDb().workouts.advance(localDateString());
      await result.current.refresh();
    });
    await act(async () => {
      await getDb().workouts.advance(localDateString());
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.instance!.currentIndex).toBe(2));

    const persisted = await getDb().workouts.getByDate(localDateString());
    expect(persisted?.currentIndex).toBe(2);
  });

  it('059: a conflicted reroll refreshes and propagates instead of silently overwriting', async () => {
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());

    // First reroll is free: force the CAS to lose once.
    const apply = jest.spyOn(getDb().workouts, 'applyReroll');
    apply.mockRejectedValueOnce(
      new WorkoutWriteConflictError(localDateString()),
    );
    try {
      await act(async () => {
        await expect(result.current.reroll()).rejects.toThrow(
          WorkoutWriteConflictError,
        );
      });
    } finally {
      apply.mockRestore();
    }
    // The hook re-read the true row (still attempt 0) and stayed usable:
    // a retry from the fresh read commits.
    await waitFor(() =>
      expect(result.current.instance!.rerollAttempt).toBe(0),
    );
    await act(async () => {
      await result.current.reroll();
    });
    await waitFor(() =>
      expect(result.current.instance!.rerollAttempt).toBe(1),
    );
  });
});
