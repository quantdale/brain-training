/**
 * Campaign 027 W3 (task 3.1) — session persistence-failure contract.
 *
 * OWNERSHIP FINDING (audit correction): the shared `useGameSession` hook owns
 * the session LIFECYCLE only (start/pause/resume/finalize) and never touches
 * persistence. The save lifecycle is duplicated per game screen: every game
 * owns a `persistXxxSession` wrapper (42 copies) feeding its reducer's
 * `persistState`/`lastError` transitions. The only genuinely SHARED seams are
 * `<GameResults>` (failure line, reward gating, restart/quit actions) and the
 * `GameHost` results view that mounts it. This file therefore pins the
 * contract at both shared seams, without production changes:
 *
 * 1. `<GameResults>` — `persistState='failed'` surfaces `lastError` next to
 *    the intact results with both next actions, and never renders the success
 *    reward (failure is not success).
 * 2. One representative migrated screen (spatial-fold-match) driven end to
 *    end with an injected persister — a rejected write is observable, the
 *    results stay up, a restart writes exactly once for the NEW session (the
 *    failed session is never silently retried), and a late rejection from the
 *    superseded session cannot leak a failure into the restarted session.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { createFakeClock, testId } from '@/sdk';
import { makeCompletedTutorialStore, makeSessionPersister } from '@/test-utils';
import SpatialFoldMatchScreen from '@/games/spatial-fold-match/screen';
import { GAME_ID } from '@/games/spatial-fold-match/types';

import { GameResults } from '../results';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }),
}));

describe('GameResults persistence-failure seam', () => {
  it('renders the failure beside intact results with next actions, never the reward', async () => {
    await render(
      <GameResults
        gameId="contract"
        persistState="failed"
        lastError="disk full"
        reward={{ xp: 30, coins: 2 }}
        onRestart={() => {}}
        onQuit={() => {}}>
        <></>
      </GameResults>,
    );

    // Results stay visible and the failure is explicit.
    expect(screen.getByTestId('contract.results')).toBeOnTheScreen();
    expect(screen.getByTestId('contract.persist-error')).toHaveTextContent(
      'Your session could not be saved. disk full',
    );
    // Failure is NOT success: no authoritative reward card, and both next
    // actions (retry-with-a-new-session / leave) remain reachable.
    expect(screen.queryByTestId('contract.reward')).toBeNull();
    expect(screen.getByTestId('contract.restart')).toBeOnTheScreen();
    expect(screen.getByTestId('contract.quit')).toBeOnTheScreen();
  });
});

describe('game-screen persistence-failure contract (representative: spatial-fold-match)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // The per-game persist wrapper logs the rejection by design; silence the
    // expected noise so only unexpected errors surface.
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderScreen(persister: ReturnType<typeof makeSessionPersister>) {
    await render(
      <SpatialFoldMatchScreen
        clock={createFakeClock(0)}
        tutorialStore={makeCompletedTutorialStore(GAME_ID)}
        sessionSeed="persist-contract"
        persistSession={persister}
      />,
    );
  }

  async function startFirstSession() {
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
  }

  /** QA force-win the current session and flush the persistence microtasks. */
  async function forceWinCurrentSession() {
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'qa-toggle')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'force-win')));
    await act(async () => {});
  }

  it('a rejected save stays observable and a restart writes once per session, never twice', async () => {
    const persister = makeSessionPersister();
    persister.completeSession.mockRejectedValue(new Error('db locked'));

    await renderScreen(persister);
    await startFirstSession();
    await forceWinCurrentSession();

    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
    expect(screen.getByTestId(testId(GAME_ID, 'persist-error'))).toHaveTextContent(
      /db locked/,
    );
    expect(persister.completeSession).toHaveBeenCalledTimes(1);

    // Play again after the failure: the new session attempts exactly one
    // write; the failed session is not retried behind the player's back.
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    await forceWinCurrentSession();

    expect(persister.completeSession).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId(testId(GAME_ID, 'persist-error'))).toHaveTextContent(
      /db locked/,
    );

    // Still exactly two: an extra render/finalize pass did not re-submit.
    await act(async () => {});
    expect(persister.completeSession).toHaveBeenCalledTimes(2);
  });

  it('drops a late rejection from a superseded session instead of failing the new one', async () => {
    let rejectFirst!: (error: unknown) => void;
    const firstWrite = new Promise<never>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const persister = makeSessionPersister();
    persister.completeSession
      .mockImplementationOnce(() => firstWrite)
      .mockImplementationOnce(async (input) => ({
        session: input.session,
        ledgerEntry: null,
        balance: 0,
        rating: null,
        completionOutcome: null,
      }));

    await renderScreen(persister);
    await startFirstSession();
    await forceWinCurrentSession();

    // The first session's write is still in flight while the player restarts.
    expect(persister.completeSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(testId(GAME_ID, 'persist-error'))).toBeNull();

    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'restart')));
    await forceWinCurrentSession();
    expect(persister.completeSession).toHaveBeenCalledTimes(2);

    // The stale write now rejects: the shared isCurrentSession guard must drop
    // it so the restarted session never shows a failure it did not have.
    await act(async () => {
      rejectFirst(new Error('db locked'));
      await firstWrite.catch(() => {});
    });

    expect(screen.queryByTestId(testId(GAME_ID, 'persist-error'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'results'))).toBeOnTheScreen();
  });
});
