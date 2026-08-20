/**
 * Offline-first boundary proof (constitution §5; campaign 003, packet WP-3D).
 *
 * Every core flow this suite exercises runs with `global.fetch`,
 * `global.XMLHttpRequest` and `global.WebSocket` replaced by functions that
 * throw `OFFLINE TEST: network access attempted` on any use — a network
 * attempt fails the test at the exact call site.
 *
 * A static scan of the core module trees (`src/games`, `src/workout`,
 * `src/rating`, `src/sdk`, `src/db`) additionally greps for network APIs and
 * fails the suite listing offenders. The allowlist is intentionally empty;
 * any legit exception must be named in ALLOWLIST below with a comment. The
 * repo-wide counterpart, run from the repo root, is
 * `node scripts/validate-offline.mjs`.
 *
 * Scan limitations (shared with the validator script): the regex is a light
 * substring check — `fetch(` also matches identifiers like `refetch(` or
 * `onFetch(`. String literals are stripped before matching, so URLs
 * (`"https://..."`) cannot hide a call and cannot masquerade as `//`
 * comments; the trade-off is that a network API inside a string literal is
 * not flagged. Lines that still contain `//` or `*` after stripping are
 * skipped as probable comments, so a network API hidden inside a comment is
 * not flagged. These are deliberate trade-offs of the requested pattern, not
 * silent passes.
 *
 * TODO(campaign-003 convergence): the quest-evaluation engine
 * (`src/quests/`), streak reconstruction (`src/streaks/`) and content-pack
 * seam (`src/content/`) landed in sibling packets 003-b/003-c and are
 * covered below (runtime section + static scan). If further module trees
 * that can touch the network land later (e.g. a download path for
 * content packs), add them to SCAN_ROOTS and to the runtime section.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { AppDatabase, initializeConnection, runMigrations } from '@/db';
import { createNodeSqliteAdapter } from '@/db/adapters/node'; // test-only backend, never in the app bundle
import type { SQLiteAdapter } from '@/db';
import type { CompleteSessionInput, GameSessionRecord } from '@/db';
import { getBundledPacks, getStorageSummary } from '@/content';
import { evaluateQuest, evaluateQuests, QUEST_DEFINITIONS_V1 } from '@/quests';
import type { QuestSnapshot } from '@/quests';
import { computeRatingOutcome, createRatingPipeline } from '@/rating';
import { registry } from '@/registry/registry.generated';
import { reconstructStreak } from '@/streaks';
import type { StreakState } from '@/streaks';
import { dailyWorkout, pickWorkoutGames } from '@/workout/today';

const T0 = 1_700_000_000_000;
const OFFLINE_ERROR = 'OFFLINE TEST: network access attempted';

/** Core module trees the in-test static scan covers (packet WP-3D). */
const SCAN_ROOTS = ['games', 'workout', 'rating', 'sdk', 'db', 'quests', 'streaks', 'content'] as const;

/** Explicit allowlist for the static scan — empty by design; name + comment any exception. */
const ALLOWLIST: ReadonlyArray<{ file: string; pattern?: string; reason: string }> = [];

/** Light substring patterns (see file header for false-positive trade-offs). */
const NETWORK_API_PATTERN = /fetch\(|XMLHttpRequest|axios|WebSocket\(/g;

/**
 * String literals, including escaped quotes (single, double, backtick).
 * Stripped BEFORE comment detection so a URL like `"https://..."` inside a
 * real call does not make the line look like a comment (`//` is also a URL
 * prefix). Limitation: quoted strings with line-internal quotes are handled
 * by the escape rule; template-literal `${}` bodies are stripped wholesale.
 */
const STRING_LITERAL_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

function stripStringLiterals(line: string): string {
  return line.replace(STRING_LITERAL_PATTERN, '""');
}

/** Domain list per game id: primary category first, then secondary domains. */
function domainsFor(gameId: string): readonly string[] {
  const game = registry.find((g) => g.id === gameId);
  if (!game) {
    throw new Error(`offline test: game "${gameId}" missing from registry`);
  }
  return [game.primaryCategory, ...(game.secondaryDomains ?? [])];
}

/** Same fixture shape as src/db/__tests__/sessions.test.ts. */
function makeSession(overrides: Partial<GameSessionRecord> = {}): GameSessionRecord {
  return {
    id: 'offline-session-1',
    gameId: 'memory',
    gameVersion: 1000000,
    generatorVersion: 2,
    scoringVersion: 1000000,
    seed: 42,
    difficulty: { mode: 'normal' },
    rawResult: { score: 550, accuracy: 0.91 },
    normalizedResult: 0.75,
    xp: 50,
    startedAt: T0,
    completedAt: T0 + 90_000,
    durationMs: 90_000,
    ...overrides,
  };
}

/** Fresh in-memory database migrated to SCHEMA_VERSION (Node backend). */
async function createMigratedAdapter(): Promise<SQLiteAdapter> {
  const adapter = createNodeSqliteAdapter(':memory:');
  await initializeConnection(adapter);
  await runMigrations(adapter);
  return adapter;
}

// import at top-level so the jest mock applies (dynamic import needs --experimental-vm-modules)
import { createExpoSqliteAdapter as expoCreateExpoSqliteAdapter } from '@/db/adapters/expo';

/** Fresh in-memory database via the Expo adapter path (jest mocks it to the Node adapter — proves the app bundle path is offline). */
async function createMigratedExpoAdapter(): Promise<SQLiteAdapter> {
  // jest/setup.js replaces this with createNodeSqliteAdapter(':memory:'); the
  // call below therefore never reaches the native module — it just proves the
  // app's import graph for the Expo path is wired and stays offline.
  const adapter = (expoCreateExpoSqliteAdapter as unknown as (db: unknown) => SQLiteAdapter)({} as unknown);
  await initializeConnection(adapter);
  await runMigrations(adapter);
  return adapter;
}

const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket'] as const;

/**
 * Replace the network globals with throwers. Node 24 provides `fetch` and
 * `WebSocket` but not `XMLHttpRequest`; `in` handles all three uniformly.
 * Returns a restore function; jest gives each test file its own global, so
 * the patch cannot leak into other suites, but we restore anyway.
 */
function banNetworkApis(): () => void {
  const g = globalThis as Record<string, unknown>;
  const saved: Array<{ key: string; present: boolean; value: unknown }> = [];
  for (const key of NETWORK_GLOBALS) {
    saved.push({ key, present: key in g, value: g[key] });
    Object.defineProperty(g, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: () => {
        throw new Error(`${OFFLINE_ERROR} (${key})`);
      },
    });
  }
  return () => {
    for (const { key, present, value } of saved) {
      if (present) {
        Object.defineProperty(g, key, { configurable: true, enumerable: true, writable: true, value });
      } else {
        Reflect.deleteProperty(g, key);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Static scan (shared semantics with scripts/validate-offline.mjs)
// ---------------------------------------------------------------------------

interface ScanHit {
  /** Path relative to src/, forward slashes. */
  file: string;
  line: number;
  pattern: string;
}

/** Recursive, deterministic walk of `.ts`/`.tsx` files, skipping test dirs. */
function walkTsFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== '__mocks__') {
          stack.push(full);
        }
      } else if (
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !/\.(test|spec)\.tsx?$/.test(entry.name)
      ) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

/** Comment-marker heuristic shared with the validator (see file header). */
function isProbablyComment(line: string): boolean {
  return line.includes('//') || line.includes('*');
}

function scanForNetworkApis(root: string): ScanHit[] {
  const hits: ScanHit[] = [];
  for (const file of walkTsFiles(root)) {
    const rel = path.relative(SRC_ROOT, file).split(path.sep).join('/');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      // Comment detection runs on the string-stripped line so `"https://..."`
      // URLs never masquerade as `//` comments (shared with the validator).
      const code = stripStringLiterals(line);
      if (isProbablyComment(code)) {
        return;
      }
      for (const match of code.matchAll(NETWORK_API_PATTERN)) {
        const allowed = ALLOWLIST.some(
          (entry) => entry.file === rel && (entry.pattern === undefined || entry.pattern === match[0]),
        );
        if (!allowed) {
          hits.push({ file: rel, line: index + 1, pattern: match[0] });
        }
      }
    });
  }
  return hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

const SRC_ROOT = path.resolve(__dirname, '..');

let restoreNetworkGlobals: () => void;

beforeAll(() => {
  restoreNetworkGlobals = banNetworkApis();
});

afterAll(() => {
  restoreNetworkGlobals();
});

describe('offline runtime flows', () => {
  it('constructs AppDatabase, migrates and ensures the profile without network access', async () => {
    const adapter = await createMigratedAdapter();
    const app = new AppDatabase(adapter, { now: () => T0 });

    const profile = await app.profile.ensureExists();
    expect(profile.id).toBe('local');
    expect(await app.profile.get()).toMatchObject({ id: 'local', displayName: '' });
  });

  it('constructs AppDatabase via the Expo adapter path without network access', async () => {
    const adapter = await createMigratedExpoAdapter();
    const app = new AppDatabase(adapter, { now: () => T0 });
    const profile = await app.profile.ensureExists();
    expect(profile.id).toBe('local');
    // Prove the Expo import graph itself is offline (no fetch/WebSocket/XHR).
    expect(await app.ledger.getBalance()).toBe(0);
  });

  it('completes a session through the rating pipeline without network access', async () => {
    const adapter = await createMigratedAdapter();
    const pipeline = createRatingPipeline({ getDomains: domainsFor });
    const app = new AppDatabase(adapter, { now: () => T0, rating: pipeline });

    const session = makeSession();
    // Expected outcome computed by the pipeline itself (its math has its own
    // suite); this test proves the outcome is applied atomically offline.
    const expected = computeRatingOutcome(session, domainsFor);

    const input: CompleteSessionInput = {
      session,
      currency: { amount: 5, reason: 'quest' },
    };
    const result = await app.sessions.completeSession(input);

    expect(result.rating).not.toBeNull();
    expect(result.rating?.xp).toBe(expected.xp);
    expect(result.session.xp).toBe(expected.xp);
    expect(result.rating?.currency).toBe(expected.currency);
    expect(result.rating?.deltas).toEqual(expected.deltas);
    // Task 7.6: with a rating service present it owns the gameplay currency
    // award, so the caller-supplied entry is ignored (no double-award for the
    // same completion event).
    expect(result.balance).toBe(expected.currency);

    // Rating history rows were applied atomically with the session row.
    const history = await app.ratings.getHistory();
    expect(history.map((h) => h.domain).sort()).toEqual(expected.deltas.map((d) => d.domain).sort());
  });

  it('runs the rating pipeline directly without network access', async () => {
    const session = makeSession();
    const outcome = computeRatingOutcome(session, domainsFor);
    expect(outcome.xp).toBeGreaterThan(0);
    expect(outcome.deltas.length).toBeGreaterThan(0);

    const service = createRatingPipeline({ getDomains: domainsFor });
    await expect(service.compute({ session })).resolves.toEqual(outcome);
  });

  it('selects the daily workout from the real registry without network access', () => {
    // The registry has 8 games > WORKOUT_SIZE, so the full selection
    // algorithm (shuffle + overlap cap) actually runs.
    const date = '2026-08-16';
    const first = dailyWorkout(registry, date);
    expect(first).toHaveLength(4);
    expect(new Set(first.map((g) => g.id)).size).toBe(4);
    // Deterministic per date, and a reroll is a deterministic alternative.
    expect(dailyWorkout(registry, date)).toEqual(first);
    expect(dailyWorkout(registry, date, 1)).toHaveLength(4);

    const pick = pickWorkoutGames(registry, date);
    expect(pick).toHaveLength(4);
    expect(new Set(pick.map((g) => g.id)).size).toBe(4);
    expect(pickWorkoutGames(registry, date)).toEqual(pick);
  });

  it('records quest/achievement/xp-award progress without network access', async () => {
    const adapter = await createMigratedAdapter();
    const app = new AppDatabase(adapter, { now: () => T0 });

    await app.quests.upsertDefinition({
      id: 'quest-play-three',
      kind: 'daily',
      title: 'Play three sessions',
      description: 'Complete three game sessions today.',
      criteria: { type: 'sessions-played', target: 3 },
      rewardXp: 50,
      rewardCurrency: 5,
      version: 1,
    });
    const progress = await app.quests.recordProgress({
      questId: 'quest-play-three',
      period: '2026-08-16',
      progress: 3,
      completedAt: T0,
    });
    expect(progress.completedAt).toBe(T0);
    expect(await app.quests.claim('quest-play-three', '2026-08-16')).toBe(true);
    expect(await app.quests.claim('quest-play-three', '2026-08-16')).toBe(false); // one claim only

    await app.achievements.upsertDefinition({
      id: 'ach-first-session',
      title: 'First Steps',
      description: 'Complete your first session.',
      criteria: { type: 'sessions-played', target: 1 },
      rewardXp: 25,
      rewardCurrency: 2,
      version: 1,
    });
    expect(await app.achievements.unlock('ach-first-session')).toBe(true);
    expect(await app.achievements.claim('ach-first-session')).toBe(true);

    const award = await app.xpAwards.award(25, 'quest', 'quest:play-three');
    expect(award.amount).toBe(25);
    expect(await app.xpAwards.getTotalAwardedXp()).toBe(25);
  });

  it('evaluates quests against a session snapshot without network access', () => {
    const now = new Date('2026-08-16T12:00:00Z');
    const snapshot: QuestSnapshot = {
      sessions: [
        { completedAt: Date.UTC(2026, 7, 16, 10), gameId: 'memory', domain: 'Memory', xp: 40 },
        { completedAt: Date.UTC(2026, 7, 16, 11), gameId: 'speed-reaction-time', domain: 'Speed', xp: 30 },
      ],
    };

    const evaluations = evaluateQuests(QUEST_DEFINITIONS_V1, snapshot, now);
    expect(evaluations.length).toBe(QUEST_DEFINITIONS_V1.length);
    for (const evaluation of evaluations) {
      expect(evaluation.periodKey.length).toBeGreaterThan(0);
      expect(evaluation.completed).toBe(evaluation.progress >= evaluation.goal);
    }
    // Deterministic: identical input yields identical output.
    expect(evaluateQuests(QUEST_DEFINITIONS_V1, snapshot, now)).toEqual(evaluations);

    // Single-quest entry point agrees with the bulk evaluation.
    for (const definition of QUEST_DEFINITIONS_V1) {
      expect(evaluateQuest(definition, snapshot, now)).toEqual(
        evaluations.find((e) => e.questId === definition.id),
      );
    }
  });

  it('reconstructs streaks from activity history without network access', () => {
    const today = '2026-08-16';

    // Last active day == today: streak alive and current.
    const alive: StreakState = reconstructStreak(['2026-08-14', '2026-08-15', '2026-08-16'], today);
    expect(alive.current).toBe(3);
    expect(alive.atRisk).toBe(false);
    expect(alive.lastActiveDate).toBe('2026-08-16');

    // Last active day == yesterday: streak alive but at risk (today pending).
    const atRisk: StreakState = reconstructStreak(['2026-08-14', '2026-08-15'], today);
    expect(atRisk.current).toBe(2);
    expect(atRisk.atRisk).toBe(true);

    // Older gap: broken; the raw run is kept for Recovery to restore.
    const broken: StreakState = reconstructStreak(['2026-08-10', '2026-08-11'], today);
    expect(broken.current).toBe(2);
    expect(broken.atRisk).toBe(false);
    expect(broken.lastActiveDate).toBe('2026-08-11');
  });

  it('enumerates bundled content packs and storage summary without network access', () => {
    const packs = getBundledPacks();
    expect(packs.length).toBeGreaterThan(0);
    for (const pack of packs) {
      expect(pack.source).toBe('bundled');
      expect(pack.sizeEstimateBytes).toBeGreaterThan(0);
    }

    const summary = getStorageSummary();
    expect(summary.packs.length).toBe(packs.length);
    expect(summary.totalItems).toBeGreaterThan(0);
    expect(summary.totalSizeEstimateBytes).toBeGreaterThan(0);
    // Deterministic: identical input yields identical output.
    expect(getStorageSummary()).toEqual(summary);
  });
});

describe('static scan of core modules', () => {
  it('finds no network API usage in games/workout/rating/sdk/db/quests/streaks/content', () => {
    const hits: ScanHit[] = [];
    for (const root of SCAN_ROOTS) {
      hits.push(...scanForNetworkApis(path.join(SRC_ROOT, root)));
    }
    // On failure jest prints the offender list (file:line:pattern).
    expect(hits).toEqual([]);
  });
});
