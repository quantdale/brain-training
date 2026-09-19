/**
 * Campaign 053 (task 1.5) — bootstrap fault-injection contract.
 *
 * Every foundational stage (database, catalog registry, progression) is
 * injected with an isolated failure and asserted to produce the
 * recovery-safe outcome, while the ancillary preference stage degrades to
 * safe defaults. The integration block then proves retry/cold-relaunch
 * idempotency against the real registry + progression engines on an
 * in-memory database: no duplicate seeded definitions, profile rows,
 * sessions, or currency effects.
 */
import { afterAll, describe, expect, it, jest } from '@jest/globals';

import { AppDatabase } from '@/db';
import { getAllGameDefinitions, registerGameDefinitions } from '@/registry/registry';
import { registry } from '@/registry/registry.generated';
import { QUEST_DEFINITIONS_V1 } from '@/quests';
import { ACHIEVEMENT_DEFINITIONS_V1 } from '@/achievements';
import {
  initializeProgression,
} from '@/progression';
import { createMigratedDb } from '@/test-utils';

import {
  BOOTSTRAP_STAGE_CLASS,
  runBootstrap,
  type BootstrapDependencies,
} from '../run-bootstrap';

const FIXED_NOW = new Date('2026-09-19T00:00:00.000Z');

function makeDeps(
  overrides: Partial<BootstrapDependencies> = {},
): BootstrapDependencies {
  return {
    initializeDatabase: jest.fn(async () => undefined),
    registerCatalog: jest.fn(() => undefined),
    initializeProgression: jest.fn(async () => undefined),
    readPreferences: jest.fn(async () => ({ themeId: 'dark', sfx: true })),
    now: () => FIXED_NOW,
    ...overrides,
  };
}


describe('runBootstrap classified stages (task 1.5)', () => {
  it('reaches ready with preferences when every stage succeeds', async () => {
    const deps = makeDeps();
    const outcome = await runBootstrap(deps);

    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.preferences).toEqual({ themeId: 'dark', sfx: true });
    expect(outcome.diagnostics).toEqual([]);
    expect(deps.initializeDatabase).toHaveBeenCalledTimes(1);
    expect(deps.registerCatalog).toHaveBeenCalledTimes(1);
    expect(deps.initializeProgression).toHaveBeenCalledTimes(1);
    expect(deps.readPreferences).toHaveBeenCalledTimes(1);
  });

  it('classifies a database failure as recovery-required and stops the pipeline', async () => {
    const deps = makeDeps({
      initializeDatabase: jest.fn(async () => {
        throw new Error('storage boom');
      }),
    });
    const outcome = await runBootstrap(deps);

    expect(outcome.status).toBe('recovery-required');
    if (outcome.status !== 'recovery-required') return;
    expect(outcome.failedStage).toBe('database');
    expect(outcome.error.message).toBe('storage boom');
    expect(outcome.diagnostics).toEqual([
      {
        stage: 'database',
        classification: 'foundational',
        message: 'storage boom',
      },
    ]);
    // Catalog/progression depend on storage and must not run.
    expect(deps.registerCatalog).not.toHaveBeenCalled();
    expect(deps.initializeProgression).not.toHaveBeenCalled();
    expect(deps.readPreferences).not.toHaveBeenCalled();
  });

  it('classifies a catalog-registration failure as recovery-required', async () => {
    const deps = makeDeps({
      registerCatalog: jest.fn(() => {
        throw new Error('registry boom');
      }),
    });
    const outcome = await runBootstrap(deps);

    expect(outcome.status).toBe('recovery-required');
    if (outcome.status !== 'recovery-required') return;
    expect(outcome.failedStage).toBe('catalog-registry');
    expect(outcome.diagnostics[0]?.classification).toBe('foundational');
    expect(deps.initializeProgression).not.toHaveBeenCalled();
    expect(deps.readPreferences).not.toHaveBeenCalled();
  });

  it('classifies a progression failure as recovery-required', async () => {
    const deps = makeDeps({
      initializeProgression: jest.fn(async () => {
        throw new Error('progression boom');
      }),
    });
    const outcome = await runBootstrap(deps);

    expect(outcome.status).toBe('recovery-required');
    if (outcome.status !== 'recovery-required') return;
    expect(outcome.failedStage).toBe('progression');
    expect(outcome.error.message).toBe('progression boom');
    expect(deps.readPreferences).not.toHaveBeenCalled();
  });

  it('keeps an ancillary preference failure nonfatal with safe defaults', async () => {
    const deps = makeDeps({
      readPreferences: jest.fn(async () => {
        throw new Error('theme read boom');
      }),
    });
    const outcome = await runBootstrap(deps);

    expect(outcome.status).toBe('ready');
    if (outcome.status !== 'ready') return;
    expect(outcome.preferences).toEqual({});
    expect(outcome.diagnostics).toEqual([
      {
        stage: 'preferences',
        classification: 'ancillary',
        message: 'theme read boom',
      },
    ]);
  });

  it('converges to ready on retry after a transient progression failure', async () => {
    let attempts = 0;
    const deps = makeDeps({
      initializeProgression: jest.fn(async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('transient boom');
        }
      }),
    });

    const first = await runBootstrap(deps);
    expect(first.status).toBe('recovery-required');

    const second = await runBootstrap(deps);
    expect(second.status).toBe('ready');
    // Retry re-ran the whole safe pipeline exactly once more; every stage is
    // idempotent, which the integration block below proves for real engines.
    expect(deps.initializeDatabase).toHaveBeenCalledTimes(2);
    expect(deps.registerCatalog).toHaveBeenCalledTimes(2);
    expect(deps.initializeProgression).toHaveBeenCalledTimes(2);
    expect(deps.readPreferences).toHaveBeenCalledTimes(1);
  });

  it('classifies every stage exactly once in the shared classification map', () => {
    expect(BOOTSTRAP_STAGE_CLASS).toEqual({
      database: 'foundational',
      'catalog-registry': 'foundational',
      progression: 'foundational',
      preferences: 'ancillary',
    });
  });
});

describe('runBootstrap retry/relaunch idempotency with real engines', () => {
  afterAll(() => {
    // The registry is module state shared by every test in this file.
    registerGameDefinitions([]);
  });

  it('does not duplicate seeded definitions, profile rows, or currency across a relaunch', async () => {
    const adapter = await createMigratedDb();
    const db = new AppDatabase(adapter);

    const deps: BootstrapDependencies = {
      initializeDatabase: async () => {
        await db.profile.ensureExists();
      },
      registerCatalog: () => {
        registerGameDefinitions(registry);
      },
      initializeProgression: (now) => initializeProgression(db, now),
      readPreferences: async () => {
        const profile = await db.profile.get();
        const theme = profile?.settings?.themeId;
        return typeof theme === 'string' ? { themeId: theme } : {};
      },
      now: () => FIXED_NOW,
    };

    // First launch.
    const first = await runBootstrap(deps);
    expect(first.status).toBe('ready');
    expect(getAllGameDefinitions()).toHaveLength(42);

    const questsAfterFirst = await adapter.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM quests',
    );
    const achievementsAfterFirst = await adapter.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM achievements',
    );
    expect(questsAfterFirst?.count).toBe(QUEST_DEFINITIONS_V1.length);
    expect(achievementsAfterFirst?.count).toBe(
      ACHIEVEMENT_DEFINITIONS_V1.length,
    );

    // Cold relaunch against the same durable store (retry uses the same path).
    const second = await runBootstrap(deps);
    expect(second.status).toBe('ready');
    expect(getAllGameDefinitions()).toHaveLength(42);

    const questsAfterSecond = await adapter.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM quests',
    );
    const achievementsAfterSecond = await adapter.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM achievements',
    );
    const profiles = await adapter.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM profile',
    );
    const sessions = await adapter.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM game_sessions',
    );
    const ledger = await adapter.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM currency_ledger',
    );

    expect(questsAfterSecond?.count).toBe(questsAfterFirst?.count);
    expect(achievementsAfterSecond?.count).toBe(achievementsAfterFirst?.count);
    expect(profiles?.count).toBe(1);
    expect(sessions?.count).toBe(0);
    expect(ledger?.count).toBe(0);

    await adapter.close();
  });
});
