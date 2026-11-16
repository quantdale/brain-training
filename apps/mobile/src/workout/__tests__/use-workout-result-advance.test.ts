import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { GameSessionRecord, WorkoutInstance } from '@/db';
import { registerGameDefinitions } from '@/registry/registry';
import { registry } from '@/registry/registry.generated';
import { expectConsoleNoise } from '@/test-utils';
import { advanceWorkoutForSession, type WorkoutSessionAdvanceResult } from '../session-advance';
import { useWorkoutResultAdvance } from '../use-workout-result-advance';

const mockFind = jest.fn<(session: GameSessionRecord) => Promise<WorkoutInstance | null>>();
jest.mock('@/db', () => ({
  ...jest.requireActual<typeof import('@/db')>('@/db'),
  getDb: () => ({ workouts: { findActiveInstanceForSession: mockFind } }),
}));
jest.mock('../session-advance', () => ({ advanceWorkoutForSession: jest.fn() }));
const advance = jest.mocked(advanceWorkoutForSession);
const gameId = registry[0].id;
const nextGameId = registry[1].id;

function owned(id: string): GameSessionRecord {
  return { id, gameId, gameVersion: 1, generatorVersion: 1, scoringVersion: 1,
    seed: 1, difficulty: {}, normalizedResult: 0.5, rawResult: {}, xp: 7,
    startedAt: 1, completedAt: 2, durationMs: 1,
    workoutProvenance: { instanceKey: `2026-11-16::${id}::short`, legIndex: 0, gameId },
  };
}
function instance(session: GameSessionRecord): WorkoutInstance {
  return { date: session.workoutProvenance!.instanceKey, gameIds: [gameId, nextGameId],
    status: 'active', currentIndex: 0, skippedIndices: [], rerollAttempt: 0,
    seedVersion: 1, createdAt: 0, updatedAt: 0 };
}
function advanced(session: GameSessionRecord): WorkoutSessionAdvanceResult {
  const row = { ...instance(session), currentIndex: 1 };
  return { advanced: true, instance: row, nextGameId, completed: false,
    nextProvenance: { instanceKey: row.date, legIndex: 1, gameId: nextGameId } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const standalone = { ...owned('standalone'), workoutProvenance: undefined };
const empty = { instance: null, nextGameId: null, completed: false, nextProvenance: null, advanceError: null };

beforeEach(() => {
  registerGameDefinitions(registry);
  mockFind.mockReset();
  mockFind.mockImplementation(async (session) => session.workoutProvenance ? instance(session) : null);
  advance.mockReset();
});

describe('useWorkoutResultAdvance session identity', () => {
  it('drops successful workout navigation on owned to standalone switch', async () => {
    const a = owned('a');
    advance.mockResolvedValue(advanced(a));
    const { result, rerender } = await renderHook(({ session }: { session: GameSessionRecord }) => useWorkoutResultAdvance(session), { initialProps: { session: a } });
    await waitFor(() => expect(result.current.nextGameId).toBe(nextGameId));
    await rerender({ session: standalone });
    expect(result.current).toEqual(empty);
  });

  it('starts the new session while an obsolete advance is pending and ignores its later success', async () => {
    const a = owned('a');
    const b = owned('b');
    const pendingA = deferred<WorkoutSessionAdvanceResult>();
    const pendingB = deferred<WorkoutSessionAdvanceResult>();
    advance.mockReturnValueOnce(pendingA.promise).mockReturnValueOnce(pendingB.promise);
    const { result, rerender } = await renderHook(({ session }: { session: GameSessionRecord }) => useWorkoutResultAdvance(session), { initialProps: { session: a } });
    await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
    await rerender({ session: b });
    await waitFor(() => expect(advance).toHaveBeenCalledTimes(2));
    await act(async () => { pendingB.resolve(advanced(b)); });
    expect(result.current.nextProvenance?.instanceKey).toBe(b.workoutProvenance!.instanceKey);
    await act(async () => { pendingA.resolve({ ...advanced(a), completed: true }); });
    expect(result.current.nextProvenance?.instanceKey).toBe(b.workoutProvenance!.instanceKey);
    expect(result.current.completed).toBe(false);
  });

  it('drops a completed workout and an existing error when changing identities', async () => {
    const a = owned('a');
    advance.mockResolvedValueOnce({ ...advanced(a), instance: { ...instance(a), status: 'completed', currentIndex: 2 },
      completed: true, nextGameId: null, nextProvenance: null });
    const { result, rerender } = await renderHook(({ session }: { session: GameSessionRecord }) => useWorkoutResultAdvance(session), { initialProps: { session: a } });
    await waitFor(() => expect(result.current.completed).toBe(true));
    await rerender({ session: standalone });
    expect(result.current).toEqual(empty);
    advance.mockRejectedValueOnce(new Error('current failure'));
    await expectConsoleNoise(/\[results\] workout advance failed/, async () => {
      await rerender({ session: owned('b') });
      await waitFor(() => expect(result.current.advanceError).toBe('Workout progress could not be saved'));
    });
    await rerender({ session: standalone });
    expect(result.current).toEqual(empty);
  });

  it('discards an obsolete advance rejection after switching to standalone', async () => {
    const pending = deferred<WorkoutSessionAdvanceResult>();
    advance.mockReturnValue(pending.promise);
    const { result, rerender } = await renderHook(({ session }: { session: GameSessionRecord }) => useWorkoutResultAdvance(session), { initialProps: { session: owned('a') } });
    await waitFor(() => expect(advance).toHaveBeenCalledTimes(1));
    await rerender({ session: standalone });
    // Older implementations log the obsolete failure; permit that diagnostic,
    // but never permit its error state to leak to the current session.
    await expectConsoleNoise(/\[results\] workout advance failed/, async () => {
      await act(async () => { pending.reject(new Error('obsolete failure')); });
    });
    expect(result.current).toEqual(empty);
  });
});
