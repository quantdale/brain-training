/**
 * Data-integrity invariants (task H): the persisted state must always satisfy
 * the documented correctness properties — currency balance equals the ledger
 * sum, ratings/xp/normalized values stay in range, session ids remain unique,
 * and a completion "claim" applies exactly once.
 */

import { describe, expect, it } from '@jest/globals';
import { createMigratedDb } from './helpers';
import { LedgerRepository } from '../ledger';
import { RatingRepository, INITIAL_RATING, MIN_RATING } from '../rating';
import { SessionRepository, type CompleteSessionInput } from '../sessions';
import type { RatingService } from '../types';

const T0 = 1_700_000_000_000;

function makeSession(over: Partial<CompleteSessionInput['session']> = {}): CompleteSessionInput['session'] {
  return {
    id: 's1',
    gameId: 'memory',
    gameVersion: 1,
    generatorVersion: 1,
    scoringVersion: 1,
    seed: 1,
    difficulty: {},
    rawResult: {},
    normalizedResult: 0.7,
    xp: 70,
    startedAt: T0,
    completedAt: T0 + 100,
    durationMs: 1000,
    ...over,
  };
}

const ratingService: RatingService = {
  async compute({ session }) {
    return {
      xp: Math.round(session.normalizedResult * 100),
      currency: 5,
      deltas: [{ domain: 'Memory', delta: 10 }],
    };
  },
};

describe('currency balance invariant', () => {
  it('balance always equals the signed sum of the ledger', async () => {
    const adapter = await createMigratedDb();
    const ledger = new LedgerRepository(adapter);
    const amounts = [10, -3, 25, -7, 50, -12];
    let expected = 0;
    for (const a of amounts) {
      await ledger.append({ amount: a, reason: 'test' });
      expected += a;
    }
    expect(await ledger.getBalance()).toBe(expected);
  });
});

describe('rating / score value ranges', () => {
  it('keeps normalized result in [0,1], xp >= 0, and ratings >= floor', async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0, ratingService);
    for (let i = 0; i < 5; i++) {
      await sessions.completeSession({
        session: makeSession({
          id: `s${i}`,
          normalizedResult: 0.2 + i * 0.15,
          xp: 20 + i,
          startedAt: T0 + i * 100,
          completedAt: T0 + i * 100 + 50,
        }),
      });
    }

    const ratings = new RatingRepository(adapter);
    for (const r of await ratings.getRatings()) {
      expect(r.rating).toBeGreaterThanOrEqual(MIN_RATING);
      expect(r.rating).toBeGreaterThanOrEqual(INITIAL_RATING - 0); // not below initial baseline trend
    }
    for (const s of await sessions.listRecent(100)) {
      expect(s.normalizedResult).toBeGreaterThanOrEqual(0);
      expect(s.normalizedResult).toBeLessThanOrEqual(1);
      expect(s.xp).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('session id uniqueness + claim-applies-once', () => {
  it('a retried completion never creates a duplicate session or double-awards currency', async () => {
    const adapter = await createMigratedDb();
    const sessions = new SessionRepository(adapter, () => T0, ratingService);

    const first = await sessions.completeSession({ session: makeSession() });
    const balanceAfterFirst = first.balance;
    const ledgerCountAfterFirst = (await new LedgerRepository(adapter).list(1000)).length;

    // Replay the same session id (crash/retry / duplicate tap).
    const second = await sessions.completeSession({ session: makeSession() });

    expect(second.completionOutcome).toBeNull(); // nothing freshly applied
    expect(second.balance).toBe(balanceAfterFirst);

    // Exactly one session row and no extra ledger entry.
    expect(await sessions.listRecent(1000)).toHaveLength(1);
    expect((await new LedgerRepository(adapter).list(1000)).length).toBe(ledgerCountAfterFirst);

    const ratings = new RatingRepository(adapter);
    expect((await ratings.getHistory(1000)).length).toBe(1); // only one rating movement
  });
});

describe('references remain valid (FK integrity)', () => {
  it('rejects rating history that references a non-existent session', async () => {
    const adapter = await createMigratedDb();
    await adapter.run("INSERT INTO profile (id, display_name, settings_json, created_at, updated_at) VALUES ('local','t','{}',?,?)", [T0, T0]);
    await expect(
      adapter.run(
        "INSERT INTO rating_history (session_id, domain, delta, rating_after, created_at) VALUES ('ghost','Memory',1,1000,?)",
        [T0],
      ),
    ).rejects.toThrow(/FOREIGN KEY|foreign key/i);
  });
});
