/** Tests for the game-screen seam factories in `src/test-utils/game-screen.ts`. */
import { describe, expect, it } from '@jest/globals';
import type {
  CompleteSessionInput,
  CompleteSessionResult,
} from '@/db';
import { makeSessionRecord } from '../fixtures';

import {
  makeCompletedTutorialStore,
  makeSessionPersister,
} from '../game-screen';

describe('makeSessionPersister', () => {
  it('echoes the input session with a neutral outcome', async () => {
    const persister = makeSessionPersister();
    const session = makeSessionRecord();
    const input: CompleteSessionInput = { session };

    const result = await persister.completeSession(input);

    expect(result.session).toBe(session);
    expect(result.ledgerEntry).toBeNull();
    expect(result.balance).toBe(0);
    expect(result.rating).toBeNull();
    expect(result.completionOutcome).toBeNull();
  });

  it('records every call for assertions', async () => {
    const persister = makeSessionPersister();
    await persister.completeSession({ session: makeSessionRecord({ id: 'a' }) });
    await persister.completeSession({ session: makeSessionRecord({ id: 'b' }) });
    expect(persister.completeSession).toHaveBeenCalledTimes(2);
    const first = persister.completeSession.mock.calls[0][0];
    expect(first.session.id).toBe('a');
  });

  it('merges result overrides over the neutral outcome', async () => {
    const persister = makeSessionPersister({
      balance: 25,
      completionOutcome: null,
      rating: { xp: 12, currency: 3, deltas: [], balance: 25 },
    });
    const result = await persister.completeSession({
      session: makeSessionRecord(),
    });
    expect(result.balance).toBe(25);
    expect(result.rating).toEqual({
      xp: 12,
      currency: 3,
      deltas: [],
      balance: 25,
    });
    // Non-overridden fields keep the neutral defaults.
    expect(result.ledgerEntry).toBeNull();
  });

  it('is structurally assignable to a game-style SessionPersistence seam', () => {
    // Every game module declares its own identical `SessionPersistence`
    // interface; this assignment is the compile-time proof that the spy
    // satisfies that shape without importing any specific game.
    const seam: {
      completeSession(
        input: CompleteSessionInput,
      ): Promise<CompleteSessionResult>;
    } = makeSessionPersister();
    expect(seam.completeSession).toBeDefined();
  });
});

describe('makeCompletedTutorialStore', () => {
  it('marks the given game completed and leaves others unseen', () => {
    const store = makeCompletedTutorialStore('memory-grid-recall');
    expect(store.getTutorialState('memory-grid-recall')).toEqual({
      completed: true,
      replayRequested: false,
      version: '1.0.0',
    });
    expect(store.getTutorialState('other-game')).toBeNull();
  });

  it('passes through a custom tutorial version', () => {
    const store = makeCompletedTutorialStore('g', '2.1.0');
    expect(store.getTutorialState('g')?.version).toBe('2.1.0');
  });
});
