/**
 * Change 073 §4.2 — the "Game N of M" indicator describes the plan's real
 * position, taken from the STORED workout row.
 *
 * The launch tuple is caller-supplied input (deep-link parameters are checked
 * for shape, not for truth), so a stale or forged leg index must never be
 * presented as the plan's position. Both cases are pinned: the normal case
 * (tuple and row agree) and the jumped/forged case (they disagree — the row
 * wins).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import type { AppDatabase, WorkoutInstance } from '@/db';
import { GameHost } from '@/components/game-host/game-host';
import { registerGameDefinitions } from '@/registry/registry';
import { registry } from '@/registry/registry.generated';
import { testId } from '@/sdk';
import { WorkoutSessionLaunchProvider } from '@/workout/session-launch-context';

const mockDbState: { db: AppDatabase | null } = { db: null };

jest.mock('@/db', () => {
  const actual = jest.requireActual('@/db') as Record<string, unknown>;
  return { ...actual, getDb: () => mockDbState.db };
});

const GAME = registry[0]!.id;
const KEY = '2026-09-30';

function instanceAt(currentIndex: number): WorkoutInstance {
  return {
    date: KEY,
    gameIds: registry.slice(0, 4).map((g) => g.id),
    status: 'active',
    currentIndex,
    rerollAttempt: 0,
    seedVersion: 1,
    createdAt: 1,
    updatedAt: 1,
    skippedIndices: [],
  };
}

function fakeDb(instance: WorkoutInstance | null): AppDatabase {
  return {
    workouts: {
      getByDate: async (date: string) =>
        instance && instance.date === date ? instance : null,
    },
    sessions: {
      findSessionOwningWorkoutProvenance: async () => null,
    },
  } as unknown as AppDatabase;
}

function hostProps() {
  return {
    gameId: GAME,
    view: 'intro' as const,
    paused: false,
    difficulty: null,
    onSelectDifficulty: () => {},
    interceptBack: false,
    description: 'probe',
    onStart: () => {},
    onHelp: () => {},
    onPause: () => {},
    onResume: () => {},
    onQuit: () => {},
    onRestart: () => {},
  };
}

beforeEach(() => {
  registerGameDefinitions(registry);
  mockDbState.db = null;
});

describe('workout position indicator (073 §4.2)', () => {
  it('shows the stored position when the launch tuple disagrees', async () => {
    // The tuple CLAIMS leg 2 (→ "Game 3"); the row says the plan is on leg 1.
    mockDbState.db = fakeDb(instanceAt(1));
    await render(
      <WorkoutSessionLaunchProvider
        provenance={{ instanceKey: KEY, legIndex: 2, gameId: GAME }}>
        <GameHost {...hostProps()} />
      </WorkoutSessionLaunchProvider>,
    );

    expect(screen.getByTestId(testId(GAME, 'workout-context'))).toBeOnTheScreen();
    // The STORED position (leg index 1 → "Game 2") is shown, not the tuple's.
    expect(screen.getByText('Game 2 · your next game')).toBeOnTheScreen();
    expect(screen.getByText('Game 2 · ready when you are')).toBeOnTheScreen();
    expect(screen.queryByText(/Game 3/)).toBeNull();
  });

  it('agrees with the tuple in the normal case', async () => {
    mockDbState.db = fakeDb(instanceAt(2));
    await render(
      <WorkoutSessionLaunchProvider
        provenance={{ instanceKey: KEY, legIndex: 2, gameId: GAME }}>
        <GameHost {...hostProps()} />
      </WorkoutSessionLaunchProvider>,
    );

    expect(screen.getByText('Game 3 · ready when you are')).toBeOnTheScreen();
  });
});
