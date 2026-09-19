/**
 * Campaign 053 (tasks 4.1–4.5) — registry-derived catalog persistence matrix.
 *
 * The pre-053 failure contract proved the shared `<GameResults>` seam plus ONE
 * representative game (spatial-fold-match). That left a breadth gap: a newly
 * registered game could ship a persistence path that never handled rejection or
 * stale completion and nothing would notice.
 *
 * This matrix derives its cases from the GENERATED REGISTRY (never a hand-kept
 * list), so a registry addition is covered automatically or fails loudly:
 *
 * - discovery: every registered game must appear in the matrix or in the
 *   explicit exemption map below (task 4.1);
 * - success + rejected-save + stale-completion: each non-exempt game is driven
 *   end to end through its shared injection seams (`persistSession`,
 *   `tutorialStore`, `sessionSeed`, `clock`) and the shared QA force-completion
 *   panel (task 4.2);
 * - durable-effect safety: a rejected write leaves no completed session and a
 *   stale write cannot mutate the restarted session (task 4.4);
 * - exemptions: each entry must name the game, a reason, and a deterministic
 *   alternate evidence path (task 4.3).
 *
 * The shared seams are what make this possible: all 42 screens accept the same
 * four optional props and mount `QaPanelShell` (pinned by
 * `src/sdk/__tests__/catalog-contracts.test.ts`), so no per-game migration is
 * required — the observed gap was test breadth, not wrapper correctness.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { createFakeClock, testId } from '@/sdk';
import { registry } from '@/registry/registry.generated';
import { makeCompletedTutorialStore, makeSessionPersister } from '@/test-utils';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

/**
 * Explicit exemptions from the shared matrix. Every entry MUST name the game,
 * explain why the shared fixture cannot apply, and point at a deterministic
 * alternate contract. The registry-derived discovery test fails when a
 * registered game is neither in the matrix nor listed here, and the exemption
 * schema test fails when an entry is missing a required field or names a game
 * that is no longer registered.
 *
 * The current catalog has no exemptions: every game accepts the shared seams.
 * The mechanism exists so a future game that genuinely cannot use them has an
 * honest, reviewed path instead of silently dropping out of coverage.
 */
export interface PersistenceMatrixExemption {
  /** Registered game id this exemption covers. */
  readonly gameId: string;
  /** Why the shared session-persistence fixture cannot apply. */
  readonly reason: string;
  /** Deterministic alternate success/failure/stale-completion evidence. */
  readonly alternateEvidence: string;
}

export const CATALOG_PERSISTENCE_EXEMPTIONS: readonly PersistenceMatrixExemption[] = [];

const EXEMPT_IDS = new Set(CATALOG_PERSISTENCE_EXEMPTIONS.map((e) => e.gameId));
const MATRIX_GAMES = registry.filter((game) => !EXEMPT_IDS.has(game.id));

/** Resolve one registered game module (screen + stable id) by registry id. */
function loadGame(id: string): {
  default: React.ComponentType<Record<string, unknown>>;
  GAME_ID: string;
} {
  return jest.requireActual(`@/games/${id}`) as {
    default: React.ComponentType<Record<string, unknown>>;
    GAME_ID: string;
  };
}

interface RenderedGame {
  persister: ReturnType<typeof makeSessionPersister>;
  gameId: string;
}

/** Render one registered game with every shared injection seam supplied. */
async function renderGame(id: string): Promise<RenderedGame> {
  const mod = loadGame(id);
  const persister = makeSessionPersister();
  await render(
    <mod.default
      clock={createFakeClock(0)}
      tutorialStore={makeCompletedTutorialStore(mod.GAME_ID)}
      sessionSeed="catalog-matrix"
      persistSession={persister}
    />,
  );
  return { persister, gameId: mod.GAME_ID };
}

/** Start a session, force-win it through the shared QA panel, flush effects. */
async function startAndForceWinSession(gameId: string): Promise<void> {
  await fireEvent.press(screen.getByTestId(testId(gameId, 'start')));
  await forceWinCurrentSession(gameId);
}

/**
 * Force-win the ALREADY-ACTIVE session through the shared QA panel. Used after
 * `restart`, which begins the next session directly instead of returning to the
 * intro view.
 */
async function forceWinCurrentSession(gameId: string): Promise<void> {
  await fireEvent.press(screen.getByTestId(testId(gameId, 'qa-toggle')));
  await fireEvent.press(screen.getByTestId(testId(gameId, 'force-win')));
  await act(async () => {});
}

afterEach(() => {
  jest.useRealTimers();
});

describe('catalog persistence matrix discovery (task 4.1)', () => {
  it('covers every registered game through the matrix or an explicit exemption', () => {
    const covered = new Set([
      ...MATRIX_GAMES.map((game) => game.id),
      ...CATALOG_PERSISTENCE_EXEMPTIONS.map((entry) => entry.gameId),
    ]);
    const uncovered = registry
      .map((game) => game.id)
      .filter((id) => !covered.has(id));
    expect(uncovered).toEqual([]);
    expect(MATRIX_GAMES.length + CATALOG_PERSISTENCE_EXEMPTIONS.length).toBe(
      registry.length,
    );
  });

  it('requires every exemption to name the game, a reason, and alternate evidence (task 4.3)', () => {
    const registered = new Set(registry.map((game) => game.id));
    for (const entry of CATALOG_PERSISTENCE_EXEMPTIONS) {
      expect(registered.has(entry.gameId)).toBe(true);
      expect(entry.reason.trim().length).toBeGreaterThan(0);
      expect(entry.alternateEvidence.trim().length).toBeGreaterThan(0);
    }
    const ids = CATALOG_PERSISTENCE_EXEMPTIONS.map((entry) => entry.gameId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('catalog persistence matrix: success (task 4.2)', () => {
  it.each(MATRIX_GAMES.map((game) => game.id))(
    '%s persists exactly one session and reaches its results view',
    async (id) => {
      jest.useFakeTimers();
      const { persister, gameId } = await renderGame(id);
      await startAndForceWinSession(gameId);

      expect(screen.getByTestId(testId(gameId, 'results'))).toBeOnTheScreen();
      expect(persister.completeSession).toHaveBeenCalledTimes(1);
      const input = persister.completeSession.mock.calls[0][0];
      expect(input.session.gameId).toBe(gameId);
      expect(input.session.id.length).toBeGreaterThan(0);
      // The authoritative outcome is what the results view may reward from.
      expect(screen.queryByTestId(testId(gameId, 'persist-error'))).toBeNull();
    },
  );
});

describe('catalog persistence matrix: rejected save (task 4.4)', () => {
  it.each(MATRIX_GAMES.map((game) => game.id))(
    '%s surfaces the failure, never the reward, and writes once per session',
    async (id) => {
      jest.useFakeTimers();
      const { persister, gameId } = await renderGame(id);
      persister.completeSession.mockRejectedValue(new Error('db locked'));
      // The per-game persist wrapper logs the rejection by design; this test
      // asserts the expected diagnostic below, so scope the console output to
      // this test instead of letting it read as suite noise.
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await startAndForceWinSession(gameId);

        expect(screen.getByTestId(testId(gameId, 'persist-error'))).toHaveTextContent(
          /db locked/,
        );
        // Failure is not success: the reward card must not render.
        expect(screen.queryByTestId(testId(gameId, 'reward'))).toBeNull();
        expect(persister.completeSession).toHaveBeenCalledTimes(1);

        // The failed session is never silently retried by an extra render pass.
        await act(async () => {});
        expect(persister.completeSession).toHaveBeenCalledTimes(1);

        // The expected diagnostic was asserted above; keep the spy honest by
        // requiring the wrapper to have logged it exactly once.
        const logged = errorSpy.mock.calls
          .map((call) => call.map(String).join(' '))
          .filter((line) => line.includes('failed to persist completed session'));
        expect(logged).toHaveLength(1);
      } finally {
        errorSpy.mockRestore();
      }
    },
  );
});

describe('catalog persistence matrix: stale completion (task 4.4)', () => {
  it.each(MATRIX_GAMES.map((game) => game.id))(
    '%s drops a late rejection from a superseded session',
    async (id) => {
      jest.useFakeTimers();
      const { persister, gameId } = await renderGame(id);

      // First session's write stays in flight while the player restarts.
      let rejectFirst!: (error: unknown) => void;
      const firstWrite = new Promise<never>((_resolve, reject) => {
        rejectFirst = reject;
      });
      persister.completeSession.mockImplementationOnce(() => firstWrite);

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        await startAndForceWinSession(gameId);
        expect(persister.completeSession).toHaveBeenCalledTimes(1);

        // Restart and complete a second session; it persists normally.
        await fireEvent.press(screen.getByTestId(testId(gameId, 'restart')));
        await forceWinCurrentSession(gameId);
        expect(persister.completeSession).toHaveBeenCalledTimes(2);

        // The stale rejection must not surface on the restarted session.
        await act(async () => {
          rejectFirst(new Error('db locked'));
          await firstWrite.catch(() => {});
        });

        expect(screen.queryByTestId(testId(gameId, 'persist-error'))).toBeNull();
        expect(screen.getByTestId(testId(gameId, 'results'))).toBeOnTheScreen();
      } finally {
        errorSpy.mockRestore();
      }
    },
  );
});
