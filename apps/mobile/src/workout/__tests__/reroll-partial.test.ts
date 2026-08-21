/**
 * Reroll-after-partial-completion regression (campaign 011 W07).
 *
 * Defect being pinned: `useWorkout().reroll()` handed `applyReroll` a
 * fresh-only id list (the played prefix went in as the selector `exclude`),
 * while `WorkoutRepository.applyReroll` is POSITION-based — it replaces
 * `[currentIndex, len)` with `newGameIds.slice(currentIndex)`. The double
 * offset silently dropped the FIRST freshly-selected game(s) on every reroll
 * taken after at least one completion, so the persisted tail diverged from
 * the deterministic seeded selection (provenance violation) and the player
 * lost variety.
 *
 * These tests run the REAL hook against the REAL node-sqlite database and the
 * REAL generated registry (same harness as lifecycle.test.ts) and compare the
 * persisted instance against the same pure-selector inputs the hook consumes.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getDb, initDatabase } from '@/db';
import { registry } from '@/registry/registry.generated';
import { registerGameDefinitions } from '@/registry/registry';
import {
  eligibleGameIds,
  eligibleGames,
} from '@/workout/reconcile';
import { localDateString } from '@/workout/today';
import { nextWorkoutAfterReroll } from '@/workout/reroll';
import { useWorkout } from '@/workout/use-workout';

describe('reroll after partial completion keeps every fresh game', () => {
  beforeEach(async () => {
    await initDatabase();
    registerGameDefinitions(registry);
    await getDb().ledger.append({ amount: 1_000, reason: 'seed' });
  });

  for (const completionsBeforeReroll of [1, 2]) {
    it(`advances ${completionsBeforeReroll} game(s), rerolls, and persists exactly the seeded fresh tail`, async () => {
      const date = localDateString();
      const { result } = await renderHook(() =>
        useWorkout({ domainRatings: [], recentGameIds: [], balance: 1_000 }),
      );
      await waitFor(() => expect(result.current.instance).not.toBeNull());

      const original = result.current.instance!;
      const total = original.gameIds.length;
      expect(total).toBeGreaterThanOrEqual(2);

      // Complete the first k games durably.
      for (let i = 0; i < completionsBeforeReroll; i += 1) {
        await act(async () => {
          await result.current.advance();
        });
      }
      expect(result.current.instance!.currentIndex).toBe(
        completionsBeforeReroll,
      );

      // Mirror the production reroll formula BEFORE calling reroll so the
      // expectation cannot drift with the implementation under repair.
      const current = (await getDb().workouts.getByDate(date))!;
      const playedPrefix = current.gameIds.slice(0, current.currentIndex);
      const selection = nextWorkoutAfterReroll(
        // Same inputs the hook passes: eligible catalog, no ratings/recents.
        eligibleGames(),
        date,
        [],
        [],
        current.rerollAttempt,
        playedPrefix,
      );
      const remainingSlots = Math.max(
        0,
        current.gameIds.length - current.currentIndex,
      );
      const expectedTail = selection
        .map((game) => game.id)
        .filter((id) => !new Set(playedPrefix).has(id))
        .slice(0, remainingSlots);

      await act(async () => {
        await result.current.reroll();
      });

      const after = result.current.instance!;
      // Total length never changes across a reroll (progress display stays
      // coherent) and the completed prefix stays immutable.
      expect(after.gameIds).toHaveLength(total);
      expect(after.gameIds.slice(0, current.currentIndex)).toEqual(
        playedPrefix,
      );
      expect(after.currentIndex).toBe(completionsBeforeReroll);
      // THE PIN: the unplayed tail is exactly the seeded fresh selection
      // truncated to the remaining slots — nothing dropped, nothing shifted.
      expect(after.gameIds.slice(current.currentIndex)).toEqual(expectedTail);
      // No already-played game may re-enter the unplayed tail.
      for (const id of after.gameIds.slice(current.currentIndex)) {
        expect(playedPrefix).not.toContain(id);
      }
      // Persisted, not just local state.
      const persisted = (await getDb().workouts.getByDate(date))!;
      expect(persisted.gameIds).toEqual(after.gameIds);
    });
  }

  it('reroll before any completion replaces the whole list deterministically', async () => {
    const date = localDateString();
    const { result } = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 1_000 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());
    const before = result.current.instance!;

    await act(async () => {
      await result.current.reroll();
    });
    const after = result.current.instance!;
    expect(after.rerollAttempt).toBe(1);
    expect(after.gameIds).toHaveLength(before.gameIds.length);
    // The rerolled list is the deterministic attempt-1 selection for the same
    // inputs (distinct ids, all eligible) — not a re-run of attempt 0.
    const expected = nextWorkoutAfterReroll(
      eligibleGames(),
      date,
      [],
      [],
      0,
      [],
    );
    expect(after.gameIds).toEqual(expected.map((game) => game.id));
    expect(new Set(after.gameIds).size).toBe(after.gameIds.length);
    const eligible = new Set(eligibleGameIds());
    for (const id of after.gameIds) {
      expect(eligible.has(id)).toBe(true);
    }
  });
});
