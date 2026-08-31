/**
 * `useWorkoutTemplates` — engine-hook coverage for NON-daily workouts
 * (campaign 012 W06; this hook had no direct suite before this file).
 *
 * Runs the REAL hook against the REAL AppDatabase (node-backed in-memory
 * sqlite via the jest setup) and the REAL generated registry, pinning the
 * surface W07's UI consumes:
 *   - startTemplate creates ONE namespaced instance per (date, template,
 *     length) and resumes idempotently instead of duplicating (kill/relaunch),
 *   - length variants coexist as distinct instances (short vs standard …),
 *   - suggestions skip templates already started today and clear next day,
 *   - history lists daily + template summaries newest-first with per-game
 *     outcomes, and round-trips template/length metadata + recorded reasons
 *     across restarts when the schema carries `metadata_json`,
 *   - legacy schemas degrade gracefully: metadata/reasons stay null.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getDb, initDatabase } from '@/db';
import type { DomainRating } from '@/workout/personalize';
import { localDateString } from '@/workout/today';
import { rotatedTemplateForDate } from '@/workout/rotation';
import { useWorkoutTemplates } from '@/workout/use-workout-templates';
import { useWorkout } from '@/workout/use-workout';
import { registry } from '@/registry/registry.generated';
import { registerGameDefinitions } from '@/registry/registry';

/**
 * Injectable local calendar date for the rollover suite (same harness as
 * lifecycle.test.ts): ONLY `localDateString` reads this holder.
 */
const mockClock = { today: '2026-08-20' };
jest.mock('@/workout/today', () => {
  const actual = jest.requireActual<typeof import('@/workout/today')>(
    '@/workout/today',
  );
  return {
    ...actual,
    localDateString: () => mockClock.today,
  };
});

const RATINGS: DomainRating[] = [
  { domain: 'Memory', rating: 900, updatedAt: 1_000 },
];

async function renderTemplates() {
  const rendered = await renderHook(() =>
    useWorkoutTemplates({ domainRatings: RATINGS, recentGameIds: [] }),
  );
  await waitFor(() => expect(rendered.result.current.ready).toBe(true));
  return rendered;
}

describe('useWorkoutTemplates (shipped schema v10)', () => {
  beforeEach(async () => {
    mockClock.today = '2026-08-20';
    await initDatabase();
    registerGameDefinitions(registry);
  });

  it('exposes the catalog with daily-mix first and today’s rotation head', async () => {
    const { result } = await renderTemplates();
    expect(result.current.templates[0].id).toBe('daily-mix');
    expect(
      result.current.templates.filter((t) => t.kind === 'template').length,
    ).toBeGreaterThanOrEqual(8);
    // Suggestions: today's rotation slot leads, the ever-available daily mix
    // closes the menu.
    expect(result.current.suggestions[0].id).toBe(
      rotatedTemplateForDate(mockClock.today).id,
    );
    expect(result.current.suggestions[result.current.suggestions.length - 1].id).toBe(
      'daily-mix',
    );
  });

  it('startTemplate persists a namespaced instance per (template,length); resume is idempotent', async () => {
    const { result } = await renderTemplates();
    const date = localDateString();

    let instance = await act(async () =>
      result.current.startTemplate('focus-memory', 'short'),
    );
    expect(instance).not.toBeNull();
    expect(instance!.date).toBe(`${date}::focus-memory::short`);
    expect(instance!.seedVersion).toBe(3);
    expect(instance!.gameIds).toHaveLength(2); // short = 2 games
    expect(new Set(instance!.gameIds).size).toBe(2);

    // Same (date, templateId, length) → the SAME persisted instance: starting
    // an already-started workout resumes instead of duplicating.
    const resumed = await act(async () =>
      result.current.startTemplate('focus-memory', 'short'),
    );
    expect(resumed!.createdAt).toBe(instance!.createdAt);
    expect(resumed!.gameIds).toEqual(instance!.gameIds);
    expect((await getDb().workouts.getByDate(`${date}::focus-memory::extended`)))
      .toBeNull();

    // A different length variant is a DIFFERENT instance that coexists.
    instance = await act(async () =>
      result.current.startTemplate('focus-memory', 'standard'),
    );
    expect(instance!.gameIds).toHaveLength(4);
    expect(await getDb().workouts.getByDate(`${date}::focus-memory::standard`)).not.toBeNull();
    expect(await getDb().workouts.getByDate(`${date}::focus-memory::short`)).not.toBeNull();
  });

  it('rejects unknown template ids and the daily mix without touching storage', async () => {
    const { result } = await renderTemplates();
    await expect(result.current.startTemplate('nope', 'short')).resolves.toBeNull();
    await expect(result.current.startTemplate('daily-mix', 'short')).resolves.toBeNull();
  });

  it('kill/relaunch mid-template resumes at the persisted position', async () => {
    const key = `${localDateString()}::focus-memory::short`;
    const first = await renderTemplates();
    const started = await act(async () =>
      first.result.current.startTemplate('focus-memory', 'short'),
    );
    const ids = started!.gameIds;

    // The player finishes the first game durably, then the process dies.
    await getDb().workouts.advance(key);

    // Relaunch: a brand-new hook over the SAME store resumes mid-workout.
    const relaunched = await renderTemplates();
    const resumed = await act(async () =>
      relaunched.result.current.startTemplate('focus-memory', 'short'),
    );
    expect(resumed!.gameIds).toEqual(ids); // no re-selection on restart
    expect(resumed!.currentIndex).toBe(1);
    expect(resumed!.status).toBe('active');
  });

  it('suggestions skip templates already started today but offer them again tomorrow', async () => {
    const rendered = await renderTemplates();
    const { result } = rendered;
    const started = await act(async () =>
      result.current.startTemplate('focus-memory', 'short'),
    );
    const startedKey = started!.date;

    // The history read refreshes after startTemplate; the skip list is built
    // from TODAY'S rows only.
    await waitFor(() =>
      expect(
        result.current.suggestions.some((t) => t.id === 'focus-memory'),
      ).toBe(false),
    );
    expect(result.current.suggestions.at(-1)!.id).toBe('daily-mix');

    // Rollover: yesterday's partial row stays untouched, the new day offers
    // the same focus template again.
    mockClock.today = '2026-08-21';
    await act(async () => {
      await rendered.rerender(undefined);
    });
    await waitFor(() =>
      expect(
        result.current.suggestions.some((t) => t.id === 'focus-memory'),
      ).toBe(true),
    );

    const yesterday = await getDb().workouts.getByDate(startedKey);
    expect(yesterday?.currentIndex).toBe(0); // untouched by the new day
    expect(yesterday?.status).toBe('active');

    // Starting tomorrow's instance uses TOMORROW'S namespaced key.
    const nextDay = await act(async () =>
      result.current.startTemplate('focus-memory', 'short'),
    );
    expect(nextDay!.date).toBe('2026-08-21::focus-memory::short');
    expect(nextDay!.currentIndex).toBe(0);
  });

  it('history lists summaries newest-first across kinds with per-game outcome data', async () => {
    const date = localDateString();
    const key = `${date}::focus-memory::short`;

    // Create today's DAILY instance exactly like Home does (the templates
    // hook never touches the daily row), then start a template workout.
    const dailyHook = await renderHook(() =>
      useWorkout({ domainRatings: [], recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(dailyHook.result.current.instance).not.toBeNull());

    const { result } = await renderTemplates();
    await act(async () => {
      await result.current.startTemplate('focus-memory', 'short');
    });

    // Complete one game of BOTH workouts.
    await getDb().workouts.advance(date);
    await getDb().workouts.advance(key);
    // The screen regains focus and re-reads (the documented refresh seam;
    // repository writes alone never push events).
    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() => {
      const templateRow = result.current.history.find((s) => s.key === key);
      expect(templateRow?.completedGames).toBe(1);
    });

    const history = result.current.history;
    expect(history.length).toBeGreaterThanOrEqual(2);
    // Within today: the bare-date daily row precedes its namespaced rows;
    // every row reports coherent per-game outcomes.
    expect(history[0].key).toBe(date);
    const templateRow = history.find((s) => s.key === key)!;
    expect(templateRow.totalGames).toBe(2);
    expect(templateRow.completedGames).toBe(1);
    expect(templateRow.completionRatio).toBeCloseTo(0.5);
    expect(templateRow.outcomes[0]).toMatchObject({
      position: 0,
      played: true,
    });
    expect(templateRow.outcomes[1].played).toBe(false);
    for (const summary of history) {
      // Shipped schema v10: metadata persists (the daily row was created by
      // the useWorkout hook, which records kind/inputs/reasons). Reasons are
      // surfaced only while aligned — nothing crashes either way.
      // Campaign 014 Workout V3: fresh instances record metadata v2.
      expect(summary.metadata).not.toBeNull();
      expect(summary.metadata?.version).toBe(3);
    }
  });
});

describe('useWorkoutTemplates (metadata round-trip on v10)', () => {
  beforeEach(async () => {
    mockClock.today = '2026-08-20';
    await initDatabase();
    registerGameDefinitions(registry);
    // The column ships with schema v10 — no simulated migration needed.
  });

  it('round-trips template/length metadata AND recorded reasons across a restart', async () => {
    // Memory sits at 900 (< threshold ⇒ weak): its games must carry the
    // weak-domain reason label through selection → persistence → history.
    const first = await renderTemplates();
    const started = await act(async () =>
      first.result.current.startTemplate('focus-memory', 'short'),
    );
    expect(started!.metadata?.kind).toBe('template');
    expect(started!.metadata?.length).toBe('short');
    expect(started!.metadata?.focus).toBe('Memory');
    expect(started!.metadata?.reasons).toHaveLength(2);

    // "Restart": a fresh hook re-reads everything from persistence.
    const relaunched = await renderTemplates();
    const key = `${mockClock.today}::focus-memory::short`;
    await waitFor(() => {
      const row = relaunched.result.current.history.find((s) => s.key === key);
      expect(row?.reasons).not.toBeNull();
    });
    const row = relaunched.result.current.history.find((s) => s.key === key)!;
    expect(row.metadata?.templateId).toBe('focus-memory');
    expect(row.metadata?.length).toBe('short');
    // Reasons survived the restart AND still describe the persisted order.
    expect(row.reasons!.map((r) => r.gameId)).toEqual(started!.gameIds);
    // Every reason kind comes from the shared vocabulary.
    for (const reason of row.reasons!) {
      expect([
        'weak-domain',
        'stale-domain',
        'recency-avoided',
        'selected',
        'excluded',
      ]).toContain(reason.kind);
    }
  });

  it('records aligned reasons for the DAILY workout at creation time', async () => {
    const date = localDateString();
    // Create the daily instance exactly like Home does.
    const { result, unmount } = await renderHook(() =>
      useWorkout({ domainRatings: RATINGS, recentGameIds: [], balance: 0 }),
    );
    await waitFor(() => expect(result.current.instance).not.toBeNull());
    unmount();

    const stored = (await getDb().workouts.getByDate(date))!;
    expect(stored.metadata?.kind).toBe('daily');
    expect(stored.metadata?.templateId).toBe('daily-mix');
    expect(stored.metadata?.reasons).toHaveLength(stored.gameIds.length);
    for (let i = 0; i < stored.gameIds.length; i += 1) {
      expect(stored.metadata!.reasons![i].gameId).toBe(stored.gameIds[i]);
    }

    // The templates-history hook surfaces those reasons into the daily
    // summary (the W07-reported gap: reasonsForKey was never wired).
    const templates = await renderTemplates();
    await waitFor(() => {
      const row = templates.result.current.history.find((s) => s.key === date);
      expect(row?.reasons).not.toBeNull();
    });
    const dailySummary = templates.result.current.history.find(
      (s) => s.key === date,
    )!;
    expect(dailySummary.reasons!.map((r) => r.gameId)).toEqual(stored.gameIds);
  });

  it('degrades recorded reasons to null after they stop matching the instance', async () => {
    const date = localDateString();
    const key = `${date}::focus-memory::standard`;
    const { result } = await renderTemplates();
    const started = await act(async () =>
      result.current.startTemplate('focus-memory', 'standard'),
    );
    expect(started!.metadata?.reasons).toHaveLength(4);

    // Complete the template first so batch reconciliation never rewrites this
    // historical row (completed rows are intentionally left untouched).
    for (let i = 0; i < 4; i += 1) {
      await getDb().workouts.advance(key);
    }
    // Then swap the first two stored games (both still eligible): a
    // reroll/reconcile-style change under unchanged metadata means the
    // recorded reasons no longer describe the persisted ORDER.
    const swapped = [started!.gameIds[1], started!.gameIds[0], ...started!.gameIds.slice(2)];
    await getDb().rawExec(
      `UPDATE workout_instances SET game_ids_json = '${JSON.stringify(swapped)}' WHERE date = '${key}'`,
    );

    const relaunched = await renderTemplates();
    await waitFor(() => expect(relaunched.result.current.ready).toBe(true));
    const row = relaunched.result.current.history.find((s) => s.key === key)!;
    // Misaligned provenance never reaches the UI.
    expect(row.reasons).toBeNull();
    expect(row.metadata).not.toBeNull(); // metadata itself survives
  });
});
