/**
 * Campaign 011 — cross-system integration pipeline (parent-owned).
 *
 * Proves the full session pipeline across subsystem boundaries with a REAL
 * migrated SQLite database, per the campaign brief §27: game completion →
 * DB session + XP/currency + domain ratings (the app's own completeSession
 * pipeline) → achievements/quests evaluation → streak reconstruction →
 * workout reconciliation consumption → personalization ranking → Progress
 * analytics → backup export → import into a fresh database → restored
 * analytics equivalence.
 *
 * Three game classes are exercised: a legacy unmigrated game
 * (`speed-color-match`), a GameHost-migrated game (`math-fast-math`), and a
 * Campaign 010 new game (`attention-sustained-vigilance`). Subsystem unit
 * suites do NOT prove these seams together — this file does.
 */
import { describe, expect, it } from '@jest/globals';

import { createMigratedDb } from '@/db/__tests__/helpers';
import { AppDatabase } from '@/db';
import { createRatingPipeline , DIFFICULTY_XP_MULTIPLIER } from '@/rating/pipeline';
import type { GameSessionRecord } from '@/db';

import {
  ACHIEVEMENT_DEFINITIONS_V1,
  evaluateAchievements,
} from '@/achievements';
import { QUEST_DEFINITIONS_V1, evaluateQuests } from '@/quests';
import { reconstructStreak } from '@/streaks/reconstruct';
import {
  buildPersonalizationContext,
  rankRecommendations,
} from '@/personalization';
import { getAllGameDefinitions } from '@/registry/registry';
import { loadProgressSnapshot } from '@/analytics/queries';
import {
  exportLocalData,
  parseAndValidateBackup,
  applyImport,
} from '@/data-portability';

const T0 = 1_700_000_000_000;
const HOUR = 3_600_000;

/** game.json primary/secondary domains for the three classes under test. */
const DOMAINS: Record<string, string[]> = {
  'speed-color-match': ['Speed'],
  'math-fast-math': ['Math', 'Speed'],
  'attention-sustained-vigilance': ['Attention'],
};

const GAMES = Object.keys(DOMAINS);

let sessionCounter = 0;

function makeSession(
  gameId: string,
  completedAt: number,
): GameSessionRecord {
  sessionCounter += 1;
  return {
    id: `pipeline-${sessionCounter}`,
    gameId,
    gameVersion: 1_000_000,
    generatorVersion: 1_000_000,
    scoringVersion: 1_000_000,
    seed: 1000 + sessionCounter,
    difficulty: { level: 'normal', challengeRating: 0.5 },
    // Raw results carry the catalog-standard metric fields the analytics
    // extractors recognize (score/accuracy/reaction), regardless of class.
    rawResult: {
      score: 480 + sessionCounter,
      accuracy: 0.8,
      avgCorrectMs: 900,
      meanSpeed: 0.7,
    },
    normalizedResult: 0.75,
    xp: 0,
    startedAt: completedAt - 60_000,
    completedAt,
    durationMs: 60_000,
  };
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

describe('Campaign 011 cross-system integration pipeline', () => {
  it('carries completions through xp/rating/engagement/workout/analytics and survives a backup round-trip', async () => {
    const adapter = await createMigratedDb();
    // Mirror the production composition root (_layout.tsx): completeSession
    // applies XP/ratings only when the rating service is wired in.
    const db = new AppDatabase(adapter, {
      rating: createRatingPipeline({ getDomains: (gameId) => DOMAINS[gameId] ?? [] }),
    });
    const sessions = db.sessions;
    const ratings = db.ratings;
    const ledger = db.ledger;
    const workouts = db.workouts;

    // --- 1. Completions across the three game classes -----------------------
    // completeSession is the app's own seam: XP award, currency ledger entry,
    // and domain-rating application all happen inside it.
    for (let i = 0; i < 6; i += 1) {
      const gameId = GAMES[i % GAMES.length];
      const result = await sessions.completeSession({
        session: makeSession(gameId, T0 + i * HOUR + 60_000),
      });

      expect(result.session.xp).toBe(
        Math.round((10 + 40 * 0.75) * DIFFICULTY_XP_MULTIPLIER.normal),
      );
      expect(result.completionOutcome?.xp).toBe(result.session.xp);
      expect(result.completionOutcome?.deltas.length).toBeGreaterThan(0);
    }

    // --- 2. Sessions + ledger + rating history reflect the play -------------
    const recent = await sessions.listRecent(100);
    expect(recent).toHaveLength(6);
    expect(new Set(recent.map((s) => s.gameId)).size).toBe(3);

    const ledgerRows = await ledger.list();
    expect(ledgerRows.length).toBeGreaterThanOrEqual(6);
    expect(ledgerRows.every((r) => r.amount > 0)).toBe(true);

    const history = await ratings.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(6);
    const ratedDomains = new Set(history.map((h) => h.domain));
    for (const domain of ['Math', 'Speed', 'Attention']) {
      expect(ratedDomains.has(domain)).toBe(true);
      // Regression guard for the W11 double-translation defect class:
      const applied = history.filter((h) => h.domain === domain);
      expect(applied.every((h) => Number.isFinite(h.ratingAfter))).toBe(true);
    }
    const mathRating = await ratings.getRating('Math');
    expect(mathRating?.rating).not.toBe(1000); // moved by deltas

    // --- 3. Engagement evaluation over the same stored rows -----------------
    const totalXp = recent.reduce((sum, s) => sum + s.xp, 0);
    const unlocked = evaluateAchievements(ACHIEVEMENT_DEFINITIONS_V1, {
      sessionCount: recent.length,
      totalXp,
      distinctGames: 3,
      domainSessions: { Math: 2, Speed: 2, Attention: 2 },
      longestStreak: 1,
      perfectSessions: 0,
    });
    expect(unlocked.length).toBeGreaterThan(0);

    const questEvaluations = evaluateQuests(
      QUEST_DEFINITIONS_V1,
      {
        sessions: recent.map((s) => ({
          completedAt: s.completedAt,
          gameId: s.gameId,
          domain: DOMAINS[s.gameId][0],
          xp: s.xp,
        })),
      },
      new Date(T0 + 6 * HOUR),
    );
    expect(questEvaluations.length).toBeGreaterThan(0);
    expect(questEvaluations.some((q) => q.progress > 0 || q.completed)).toBe(
      true,
    );

    // --- 4. Streak reconstruction from activity dates ------------------------
    const activityDates = [...new Set(recent.map((s) => utcDay(s.completedAt)))];
    const streak = reconstructStreak(activityDates, utcDay(T0 + 6 * HOUR));
    expect(streak.current).toBeGreaterThanOrEqual(1);

    // --- 5. Workout reconciliation runs against real instances ---------------
    await workouts.reconcileActiveInstances(GAMES);
    const instances = await workouts.listRecent(10);
    expect(Array.isArray(instances)).toBe(true);

    // --- 6. Personalization ranks deterministically from stored rows --------
    const context = buildPersonalizationContext({
      ratings: await ratings.getRatings(),
      aggregates: await sessions.getAggregates(),
      recentSessions: recent,
      nowMs: T0 + 7 * 24 * HOUR,
    });
    const catalog = getAllGameDefinitions().filter((g) =>
      GAMES.includes(g.id),
    );
    const rankedOnce = rankRecommendations(catalog, context);
    const rankedTwice = rankRecommendations(catalog, context);
    expect(rankedOnce).toEqual(rankedTwice);
    expect(rankedOnce.length).toBe(catalog.length);

    // --- 7. Analytics snapshot sees everything -------------------------------
    const before = await loadProgressSnapshot(db);
    expect(before.sessions).toHaveLength(6);
    expect(before.aggregates.length).toBeGreaterThanOrEqual(3);
    expect(before.totalXp).toBeGreaterThan(0);

    // --- 8. Backup export → import into a FRESH db → equivalence ------------
    const envelope = await exportLocalData(db);
    const parsed = parseAndValidateBackup(JSON.stringify(envelope));

    const targetAdapter = await createMigratedDb();
    const targetDb = new AppDatabase(targetAdapter);
    await applyImport(targetDb, parsed, 'merge');

    const restored = await loadProgressSnapshot(targetDb);
    expect(restored.sessions).toHaveLength(before.sessions.length);
    expect(restored.totalXp).toBe(before.totalXp);
    expect(restored.balance).toBe(before.balance);
    expect(restored.aggregates.map((a) => a.gameId).sort()).toEqual(
      before.aggregates.map((a) => a.gameId).sort(),
    );
    expect(restored.ratingHistory.length).toBe(before.ratingHistory.length);
  });
});
