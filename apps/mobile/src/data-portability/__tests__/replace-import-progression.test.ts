/**
 * Replace-import × progression regression (Change 065).
 *
 * A validation-valid backup may carry a profile whose `progressionSeedVersion`
 * fingerprint matches the current app version while the backup contains NO
 * quest/achievement definition rows. Before the fix, a replace import
 * persisted that fingerprint, `ensureProgressionDefinitions` skipped seeding,
 * and the next progression sync inserted `quest_progress`/`achievement_unlocks`
 * rows with no parent definition — the FK failure surfaced as a bootstrap
 * `recovery-required` loop.
 *
 * Two layers are covered here:
 *  - PRIMARY: the replace-import branch drops the imported fingerprint so the
 *    next seeding pass runs;
 *  - SAFETY NET: seeding re-runs when a matching fingerprint is paired with an
 *    empty persisted catalog (the direct seeding test lives in the progression
 *    suite).
 */
import { describe, expect, it } from '@jest/globals';

import { runBootstrap } from '@/bootstrap/run-bootstrap';
import { type CompleteSessionInput } from '@/db';
import { initializeProgression, refreshProgression } from '@/progression';
import {
  PROGRESSION_SEED_VERSION_KEY,
  progressionSeedVersion,
} from '@/progression/seeding';
import { currentPeriodKey } from '@/quests';
import type { ParsedBackup } from '../deserialize';
import { applyImport, parseAndValidateBackup, serializeBackup } from '../index';
import { buildEnvelope, emptyData, makeDb, T0 } from './helpers';

const SESSION_NOW = new Date(T0 + 60_000);

function makeSession(overrides: Partial<CompleteSessionInput['session']> = {}) {
  return {
    id: 'session-1',
    gameId: 'memory',
    gameVersion: 1000000,
    generatorVersion: 1000000,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { mode: 'normal' },
    rawResult: { score: 10, accuracy: 1 },
    normalizedResult: 0.8,
    xp: 50,
    startedAt: T0,
    completedAt: T0 + 60_000,
    durationMs: 60_000,
    ...overrides,
  };
}

/**
 * A valid backup whose profile asserts the CURRENT fingerprint while carrying
 * no definition rows — the exact hostile shape the replace boundary must not
 * trust.
 */
function hostileParsedBackup(): ParsedBackup {
  const data = emptyData();
  data.profile = {
    id: 'local',
    displayName: 'Imported',
    settings: {
      theme: 'dark',
      [PROGRESSION_SEED_VERSION_KEY]: progressionSeedVersion(),
    },
    createdAt: T0,
    updatedAt: T0,
  };
  return parseAndValidateBackup(serializeBackup(buildEnvelope(data)));
}

describe('replace import × progression (Change 065)', () => {
  it('cannot assert a seeded catalog it does not contain and bootstraps cleanly', async () => {
    const db = await makeDb();
    const result = await applyImport(db, hostileParsedBackup(), 'replace');
    expect(result.profileMerged).toBe(true);

    // The hostile state really was imported: no catalogs, unrelated settings
    // preserved.
    expect(await db.quests.listDefinitions()).toHaveLength(0);
    expect(await db.achievements.listDefinitions()).toHaveLength(0);
    expect((await db.profile.get())?.settings.theme).toBe('dark');

    // PRIMARY fix: the imported fingerprint was dropped at the boundary.
    expect(
      (await db.profile.get())?.settings[PROGRESSION_SEED_VERSION_KEY],
    ).toBeUndefined();

    // Bootstrap-equivalent progression stage succeeds (before the fix this
    // threw the quest_progress FK error -> recovery-required).
    const outcome = await runBootstrap({
      initializeDatabase: async () => {},
      registerCatalog: () => {},
      initializeProgression: (now) => initializeProgression(db, now),
      readPreferences: async () => ({}),
      now: () => SESSION_NOW,
    });
    expect(outcome.status).toBe('ready');

    // Definitions restored and the fingerprint re-applied by the seed pass.
    expect((await db.quests.listDefinitions()).length).toBeGreaterThanOrEqual(4);
    expect((await db.achievements.listDefinitions()).length).toBeGreaterThanOrEqual(4);
    expect(
      (await db.profile.get())?.settings[PROGRESSION_SEED_VERSION_KEY],
    ).toBe(progressionSeedVersion());

    // A subsequent session-progress sync now has FK parents and records rows.
    await db.sessions.completeSession({ session: makeSession() });
    await refreshProgression(db, SESSION_NOW);
    const daily = await db.quests.listProgressForPeriod(
      currentPeriodKey('daily', SESSION_NOW),
    );
    expect(daily.length).toBeGreaterThan(0);
  });

  it('merge keeps the imported fingerprint and the seeding safety net repairs the empty catalog', async () => {
    const db = await makeDb();
    await applyImport(db, hostileParsedBackup(), 'merge');

    // Merge semantics: backup settings win per key, so the fingerprint is
    // intentionally NOT stripped (merge never clears the local catalogs).
    expect(
      (await db.profile.get())?.settings[PROGRESSION_SEED_VERSION_KEY],
    ).toBe(progressionSeedVersion());

    // SAFETY NET: matching fingerprint + empty catalogs must still seed.
    await refreshProgression(db, SESSION_NOW);
    expect((await db.quests.listDefinitions()).length).toBeGreaterThanOrEqual(4);
    expect((await db.achievements.listDefinitions()).length).toBeGreaterThanOrEqual(4);
  });
});
