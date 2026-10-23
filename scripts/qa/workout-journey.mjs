#!/usr/bin/env node
/**
 * workout-journey.mjs — Workout V3 FULL native lifecycle + reward
 * reconciliation driver (Campaign 080 §Phase C).
 *
 * What this proves (and how)
 * --------------------------
 * The previous driver verified only the start/interrupt/resume spine and could
 * not finish a leg. This driver completes the campaign's required journey
 * end-to-end against the REAL installed build:
 *
 *   build identity -> profile/progression baseline -> generated plan verified
 *   -> workout start -> leg 1 played to results -> transition to next leg
 *   -> leg 2 played -> controlled interrupt (process terminate) -> relaunch
 *   -> resume surface -> remaining legs -> workout-complete state ->
 *   reward/XP/coin/quest/achievement reconciliation from the APP DATABASE ->
 *   persistence across one more restart -> one abandoned/quit workout
 *   scenario through the product's own skip path.
 *
 * Evidence model: every step is bound to before/after control inventories and
 * an out-of-band screenshot + hierarchy dump. Reward claims are NOT taken from
 * a screenshot of a celebration screen — they are reconciled from the
 * authoritative SQLite state (game_sessions, xp_awards, currency_ledger,
 * currency_balance, quest_progress, achievement_unlocks, workout_instances),
 * snapshotted through a WAL-consistent copy of the live database.
 *
 * Play is REAL play: the installed release build hides the dev-only force-state
 * QA panels (`isDevOnly`), so a leg ends through genuine play or genuine
 * failure/timeout only. Guided tutorials are cleared by the deterministic
 * family solvers in `tutorial-solver.mjs` (their tier is recorded per step and
 * is never presented as gameplay evidence); gameplay rounds use the shared
 * family action policy in `gameplay-actions.mjs`.
 *
 * Usage: node scripts/qa/workout-journey.mjs [--out FILE] [--legs N]
 *        [--legs-before-interrupt N] [--skip-abandon] [--skip-main]
 * Exit: 0 = journey ran (outcomes recorded), 3 = no device, 2 = usage.
 */
'use strict';

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { center, chooseGameplayAction } from './gameplay-actions.mjs';
import { planTutorialStep } from './tutorial-solver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'qa-artifacts', '080', 'workout-v3-journey.json');
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const ARTIFACT_ROOT = path.join(REPO_ROOT, 'qa-artifacts', '080', 'workout-v3', RUN_STAMP);
const DB_ROOT = path.join(ARTIFACT_ROOT, 'db');
const PACKAGE = 'com.braintraining.app';

// --- argv ------------------------------------------------------------------
const argv = process.argv.slice(2);
let outFile = DEFAULT_OUT;
let maxLegs = 4;
let legsBeforeInterrupt = 2;
let skipAbandon = false;
let abandonOnly = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outFile = path.resolve(argv[++i] || DEFAULT_OUT);
  else if (argv[i] === '--legs') maxLegs = Number(argv[++i]) || 4;
  else if (argv[i] === '--legs-before-interrupt') legsBeforeInterrupt = Number(argv[++i]) || 2;
  else if (argv[i] === '--skip-abandon') skipAbandon = true;
  else if (argv[i] === '--abandon-only') abandonOnly = true;
  else { console.error(`unknown option '${argv[i]}'`); process.exit(2); }
}

// --- device + tools --------------------------------------------------------
const SDK = process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = path.join(SDK, 'platform-tools', 'adb.exe');
const SQLITE = path.join(SDK, 'platform-tools', 'sqlite3.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

const SERIAL = (() => {
  const out = execFileSync(ADB, ['devices'], { encoding: 'utf8', windowsHide: true });
  const line = out.split('\n').map((l) => l.trim()).find((l) => /^emulator-\d+\s+device$/.test(l));
  if (!line) { console.error('[workout] no emulator online'); process.exit(3); }
  return line.split(/\s+/)[0];
})();

function adb(sub, opts = {}) {
  try {
    return execFileSync(ADB, ['-s', SERIAL, ...sub], {
      encoding: 'utf8', timeout: opts.timeout || 30000, maxBuffer: 32 * 1024 * 1024,
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) { if (opts.tolerant) return ''; throw e; }
}

// --- observation -----------------------------------------------------------
/**
 * Parse the UI hierarchy into keyed control nodes. Keys are resource-ids with
 * the package prefix removed, i.e. the app's `gameId.control` semantic surface
 * (`memory.tile.3`, `home-workout-continue`, `math-fast-math.results`, …).
 */
function dumpControls() {
  adb(['shell', 'uiautomator', 'dump', '/sdcard/bt-workout-dump.xml'], { timeout: 60000, tolerant: true });
  const xml = adb(['shell', 'cat', '/sdcard/bt-workout-dump.xml'], { tolerant: true }) || '';
  const nodes = {};
  const re = /<node\b[^>]*>/g;
  let m = re.exec(xml);
  while (m !== null) {
    const tag = m[0];
    m = re.exec(xml); // advance FIRST so a `continue` below can never loop
    const rid = /resource-id="([^"]*)"/.exec(tag)?.[1] || '';
    if (!rid) continue;
    const key = rid.replace(/^com\.braintraining\.app:id\//, '');
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tag);
    nodes[key] = {
      bounds: bounds ? [+bounds[1], +bounds[2], +bounds[3], +bounds[4]] : null,
      text: /text="([^"]*)"/.exec(tag)?.[1] || '',
      desc: /content-desc="([^"]*)"/.exec(tag)?.[1] || '',
      // A disabled control still renders and still has bounds; recording the
      // attribute keeps a no-op tap distinguishable from a missed tap.
      enabled: /enabled="([^"]*)"/.exec(tag)?.[1] !== 'false',
      clickable: /clickable="([^"]*)"/.exec(tag)?.[1] === 'true',
    };
  }
  return { nodes, xml };
}

/**
 * Derive the current game's id from the observed `gameId.control` surface and
 * return the solver's observation dialect (suffix-keyed controls).
 */
function gameView(nodes) {
  const counts = new Map();
  for (const k of Object.keys(nodes)) {
    const i = k.indexOf('.');
    if (i <= 0) continue;
    const gameId = k.slice(0, i);
    counts.set(gameId, (counts.get(gameId) || 0) + 1);
  }
  // Home/global surfaces (`home-*`, `tab-*`, `results-*`) have no dotted game
  // prefix; the dominant dotted prefix wins when a game screen is present.
  let gameId = null;
  for (const [g, n] of counts) if (!gameId || n > counts.get(gameId)) gameId = g;
  if (!gameId) return null;
  const controls = {};
  for (const [k, v] of Object.entries(nodes)) {
    if (k === gameId) controls.screen = v;
    else if (k.startsWith(`${gameId}.`)) controls[k.slice(gameId.length + 1)] = v;
  }
  return { gameId, controls };
}

function solverView(view) {
  const c = view.controls;
  return {
    gameId: view.gameId,
    phase: 'workout-leg',
    controls: Object.keys(c),
    controlDetails: Object.fromEntries(Object.keys(c).map((k) => [k, {
      text: c[k].text || '',
      desc: c[k].desc || '',
    }])),
    boardValues: Object.keys(c)
      .filter((s) => /(board|display|status|problem|prompt|text|label)(\.\d+)?$/.test(s))
      .map((s) => `${s}=${c[s].text || c[s].desc || ''}`),
  };
}

const tap = (node) => {
  const p = center(node && node.bounds);
  if (!p) return false;
  adb(['shell', 'input', 'tap', String(p[0]), String(p[1])], { tolerant: true });
  return true;
};

function screenshot(name) {
  try {
    const buf = execFileSync(ADB, ['-s', SERIAL, 'exec-out', 'screencap', '-p'], {
      encoding: 'buffer', timeout: 30000, windowsHide: true, maxBuffer: 32 * 1024 * 1024,
    });
    fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
    const f = path.join(ARTIFACT_ROOT, `${name}.png`);
    fs.writeFileSync(f, buf);
    return { file: path.relative(REPO_ROOT, f).replace(/\\/g, '/'), sha256: sha256(buf) };
  } catch { return null; }
}

// --- step evidence log -----------------------------------------------------
const steps = [];
function recordStep(name, before, after, expect, observed, extra = {}) {
  const shot = screenshot(`step-${String(steps.length).padStart(2, '0')}-${name}`);
  const keyset = (nodes) => Object.keys(nodes).filter((k) => /^(home|workout|results|game|data|progress|tab)/.test(k)).slice(0, 24);
  const obs = {
    seq: steps.length,
    name,
    timestamp: new Date().toISOString(),
    beforeKeys: before ? keyset(before) : [],
    afterKeys: after ? keyset(after) : [],
    afterText: after ? Object.fromEntries(
      Object.entries(after)
        .filter(([k]) => /(progress|workout|stat-|title|status)/.test(k))
        .map(([k, v]) => [k, (v.text || v.desc || '').slice(0, 80)])
        .slice(0, 16)
    ) : {},
    expect: expect || null,
    observed: expect ? observed : null,
    evidenceArtifact: shot,
    ...extra,
  };
  steps.push(obs);
  let status = 'recorded';
  if (obs.observed === true) status = 'OK';
  else if (obs.observed === false) status = 'NOT OBSERVED';
  console.log(`[workout] ${name}: ${status}`);
  return obs;
}

async function step(name, act, expect, extra) {
  console.log(`[workout:step] ${name}: enter`);
  const before = dumpControls().nodes;
  console.log(`[workout:step] ${name}: dumped before (${Object.keys(before).length} keys)`);
  if (act) await act(before);
  await sleep(1500);
  const after = dumpControls().nodes;
  console.log(`[workout:step] ${name}: dumped after (${Object.keys(after).length} keys)`);
  const r = recordStep(name, before, after, expect, expect ? expect(after) : null, extra);
  console.log(`[workout:step] ${name}: recorded`);
  return r;
}

const has = (n, ...ids) => ids.some((id) => n[id]);

// --- database evidence -----------------------------------------------------
function sqliteJson(dbFile, sql) {
  try {
    const out = execFileSync(SQLITE, ['-json', dbFile, sql], {
      encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024, windowsHide: true,
    });
    return JSON.parse(out || '[]');
  } catch (e) {
    console.error(`[workout] sqlite query failed: ${e.message}`);
    return null;
  }
}

/**
 * WAL-consistent snapshot of the live app database. The copy runs while the
 * app is idle (between journey steps); the -wal/-shm sidecars are copied with
 * the main file so sqlite3 replays the same committed state the app sees.
 */
function snapshotDb(tag) {
  fs.mkdirSync(DB_ROOT, { recursive: true });
  for (const ext of ['', '-wal', '-shm']) {
    adb(['shell', 'cp', `/data/data/${PACKAGE}/files/SQLite/brain-training.db${ext}`, `/sdcard/bt-journey${ext}.db`], { tolerant: true });
  }
  const local = path.join(DB_ROOT, `${tag}.db`);
  for (const ext of ['', '-wal', '-shm']) {
    try {
      execFileSync(ADB, ['-s', SERIAL, 'pull', `/sdcard/bt-journey${ext}.db`, local + ext],
        { timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { /* sidecars may be absent */ }
  }
  const summary = {
    tag,
    capturedAt: new Date().toISOString(),
    gameSessions: sqliteJson(local, `SELECT id, game_id, normalized_result, xp, started_at, completed_at,
        json_extract(raw_result_json,'$.workoutProvenance.instanceKey')  AS wkey,
        json_extract(raw_result_json,'$.workoutProvenance.legIndex')     AS wleg,
        json_extract(raw_result_json,'$.workoutProvenance.gameId')       AS wgame
      FROM game_sessions ORDER BY completed_at`),
    xpAwards: sqliteJson(local, 'SELECT id, amount, reason, source, created_at FROM xp_awards ORDER BY id'),
    currencyLedger: sqliteJson(local, 'SELECT id, amount, reason, session_id, operation_id, created_at FROM currency_ledger ORDER BY id'),
    currencyBalance: sqliteJson(local, 'SELECT balance FROM currency_balance'),
    workoutInstances: sqliteJson(local, 'SELECT date, status, current_index, game_ids_json, skipped_indices_json, updated_at FROM workout_instances ORDER BY updated_at'),
    questProgress: sqliteJson(local, 'SELECT * FROM quest_progress ORDER BY rowid'),
    achievementUnlocks: sqliteJson(local, 'SELECT * FROM achievement_unlocks ORDER BY rowid'),
    profile: sqliteJson(local, 'SELECT id, updated_at FROM profile'),
  };
  fs.writeFileSync(path.join(DB_ROOT, `${tag}.summary.json`), JSON.stringify(summary, null, 2));
  console.log(`[workout] db snapshot '${tag}' -> ${path.relative(REPO_ROOT, local)}`);
  return summary;
}

function reconcile(pre, post) {
  const ids = (rows) => new Set((rows || []).map((r) => r.id));
  const preSessions = ids(pre.gameSessions);
  const preLedger = ids(pre.currencyLedger);
  const preXp = ids(pre.xpAwards);
  const newSessions = (post.gameSessions || []).filter((r) => !preSessions.has(r.id));
  const newLedger = (post.currencyLedger || []).filter((r) => !preLedger.has(r.id));
  const newXp = (post.xpAwards || []).filter((r) => !preXp.has(r.id));

  // Idempotency probes: the schema forbids duplicate operation_id and forbids
  // UPDATE/DELETE on the ledgers, but the journey also CHECKS that the run did
  // not double-credit the same session with the same reason.
  const dupOpIds = Object.entries(
    (post.currencyLedger || []).reduce((m, r) => {
      if (r.operation_id) m[r.operation_id] = (m[r.operation_id] || 0) + 1;
      return m;
    }, {})
  ).filter(([, n]) => n > 1);
  const dupSessionCredits = Object.entries(
    newLedger.reduce((m, r) => {
      const k = `${r.session_id || '-'}|${r.reason}`;
      m[k] = (m[k] || 0) + 1;
      return m;
    }, {})
  ).filter(([, n]) => n > 1);

  const balanceDelta = (post.currencyBalance?.[0]?.balance ?? 0) - (pre.currencyBalance?.[0]?.balance ?? 0);
  const ledgerDelta = newLedger.reduce((s, r) => s + r.amount, 0);
  return {
    newSessions: newSessions.map((r) => ({
      id: r.id, gameId: r.game_id, normalizedResult: r.normalized_result, xp: r.xp,
      workout: r.wkey ? { instanceKey: r.wkey, legIndex: r.wleg, gameId: r.wgame } : null,
    })),
    sessionXpAwarded: newSessions.reduce((s, r) => s + (r.xp || 0), 0),
    newCurrencyLedger: newLedger.map((r) => ({
      id: r.id, amount: r.amount, reason: r.reason, sessionId: r.session_id, operationId: r.operation_id,
    })),
    ledgerDelta,
    balanceDelta,
    ledgerBalanceConsistent: ledgerDelta === balanceDelta,
    newXpAwards: newXp.map((r) => ({ id: r.id, amount: r.amount, reason: r.reason, source: r.source })),
    questProgressAfter: post.questProgress,
    achievementUnlocksAfter: post.achievementUnlocks,
    // Row-level quest/achievement deltas: WHICH quests moved, not just that
    // something did. Rows are captured in stable (rowid) order.
    questProgressDelta: (post.questProgress || []).filter((r, i) =>
      JSON.stringify(r) !== JSON.stringify((pre.questProgress || [])[i])),
    achievementUnlocksDelta: (post.achievementUnlocks || []).filter((r, i) =>
      JSON.stringify(r) !== JSON.stringify((pre.achievementUnlocks || [])[i])),
    questProgressChanged: JSON.stringify(pre.questProgress) !== JSON.stringify(post.questProgress),
    achievementsChanged: JSON.stringify(pre.achievementUnlocks) !== JSON.stringify(post.achievementUnlocks),
    workoutInstancesAfter: post.workoutInstances,
    duplicateOperationIds: dupOpIds,
    duplicateSessionCredits: dupSessionCredits,
  };
}

// --- leg gameplay ----------------------------------------------------------
/**
 * Play ONE workout leg until the game reaches its results surface. Tutorial
 * demos (if this player has not seen the game) are cleared by the deterministic
 * family solvers; gameplay rounds use the shared family action policy. Both
 * are REAL taps on OBSERVED controls. Returns how the leg ended.
 */
async function playLeg(legIndex, budgetIterations = 80) {
  console.log(`[workout] playing leg ${legIndex} (budget ${budgetIterations} iterations)`);
  const tutorialSolveLog = [];
  const gameplayLog = [];
  const tappedInTutorial = new Set();
  const tutorialKnownCorrect = new Set();
  const tappedThisRound = new Set();
  let lastRound = null;
  let enteredDigits = '';
  let equationStaged = [];
  let lastTutorialTarget = null;
  let lastGameId = null;

  for (let i = 0; i < budgetIterations; i++) {
    const { nodes } = dumpControls();
    const view = gameView(nodes);
    if (!view) {
      // No game surface: results may be up (global `results-*` keys) or we are
      // back on Home. Either way the leg loop is done.
      if (has(nodes, 'results-workout-complete') || has(nodes, 'home-title')) {
        return { ended: 'no-game-surface', iteration: i, tutorialSolveLog, gameplayLog };
      }
      await sleep(1200);
      continue;
    }
    lastGameId = view.gameId;
    const c = view.controls;

    // Results surface reached?
    if (Object.keys(c).some((k) => /^results$|^results[.\-]/.test(k)) || c['workout-complete']) {
      return { ended: 'results', gameId: view.gameId, iteration: i, tutorialSolveLog, gameplayLog };
    }

    // Tutorial surface? solve it with the family solver (tier recorded).
    const tutorialUp = Object.keys(c).some((k) => /^tutorial/.test(k));
    if (tutorialUp) {
      const obsView = solverView(view);
      const plan = planTutorialStep(obsView, {
        gameId: view.gameId,
        tapped: tappedInTutorial,
        enteredDigits,
        equation: equationStaged,
        lastTapped: lastTutorialTarget,
        retriedThisDemo: tutorialSolveLog.some((e) => /^tutorial-(demo-)?retry$/.test(e.target || '')),
        knownCorrect: tutorialKnownCorrect,
      });
      if (!plan) {
        tutorialSolveLog.push({ iteration: i, outcome: 'NO_LEGITIMATE_STEP' });
        await sleep(1500);
        continue;
      }
      const key = c[plan.target] ? plan.target : Object.keys(c).find((k) => k === plan.target || k.endsWith(`.${plan.target}`));
      if (!key || !center(c[key].bounds)) {
        tutorialSolveLog.push({ iteration: i, outcome: 'TARGET_NOT_TAPPABLE', target: plan.target });
        await sleep(1500);
        continue;
      }
      tutorialSolveLog.push({ iteration: i, target: key, tier: plan.tier, reason: plan.reason });
      if (plan.knownCorrect) for (const k of plan.knownCorrect) tutorialKnownCorrect.add(k);
      if (plan.resetsTapped) {
        tappedInTutorial.clear();
        enteredDigits = '';
        equationStaged = [];
      } else {
        tappedInTutorial.add(plan.target);
        tappedInTutorial.add(key);
      }
      lastTutorialTarget = key;
      if (/^digit\.\d$/.test(key)) enteredDigits += key.slice('digit.'.length);
      if (key === 'submit' || key === 'tutorial-submit') enteredDigits = '';
      if (/^color\.\d$/.test(key)) equationStaged = [...equationStaged, key];
      tap(c[key]);
      await sleep(1400);
      continue;
    }

    // Gameplay round: shared family action policy. The used-control set is
    // keyed to the OBSERVED round counter (same policy as the sweep): a new
    // round re-opens every control, and a stale used-set would otherwise make
    // ordered/sequence answers unplayable after their first attempt.
    const roundControl = Object.keys(c).find((x) => /^round\.\d+$/.test(x));
    const roundNow = roundControl ? Number(roundControl.split('.')[1]) : null;
    if (lastRound !== null && roundNow !== null && roundNow !== lastRound) tappedThisRound.clear();
    lastRound = roundNow;
    const action = chooseGameplayAction(c, tappedThisRound);
    if (action && action.type === 'tap') {
      const ok = tap(c[action.target]);
      tappedThisRound.add(action.target);
      gameplayLog.push({ iteration: i, round: roundNow, target: action.target, executed: ok });
      await sleep(1100);
    } else {
      // Passive / timed stimulus: wait and observe. NOT counted as input.
      gameplayLog.push({ iteration: i, round: roundNow, target: null, executed: false, passive: true });
      await sleep(1400);
    }
  }
  return { ended: 'budget-exhausted', iteration: budgetIterations, gameId: lastGameId, tutorialSolveLog, gameplayLog };
}

// --- screens ---------------------------------------------------------------
function currentProgressText(nodes) {
  return nodes['home-workout-progress'] ? (nodes['home-workout-progress'].text || '') : null;
}

function planFromUi(nodes) {
  return Object.keys(nodes)
    .filter((k) => /^home-workout-game-(?!status)/.test(k))
    .map((k) => ({ gameId: k.replace('home-workout-game-', ''), label: nodes[k].desc || nodes[k].text || '' }));
}

// --- main ------------------------------------------------------------------
(async function main() {
  console.log(`[workout] serial=${SERIAL} legs=${maxLegs} interruptAfter=${legsBeforeInterrupt}`);
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });

  // 0. Build identity (device + source) — evidence must name the build it ran on.
  const apkPath = adb(['shell', 'pm', 'path', PACKAGE]).trim().split('package:')[1] || '';
  const apkBuf = execFileSync(ADB, ['-s', SERIAL, 'exec-out', 'cat', apkPath], {
    encoding: 'buffer', timeout: 120000, windowsHide: true, maxBuffer: 128 * 1024 * 1024,
  });
  const buildIdentity = {
    apkPath,
    apkSha256: sha256(apkBuf),
    versionName: /versionName=(\S+)/.exec(adb(['shell', 'dumpsys', 'package', PACKAGE], { tolerant: true }))?.[1] || null,
    versionCode: /versionCode=(\d+)/.exec(adb(['shell', 'dumpsys', 'package', PACKAGE], { tolerant: true }))?.[1] || null,
    gitSha: (() => {
      try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true }).trim();
      } catch { return null; }
    })(),
  };
  console.log(`[workout] build ${buildIdentity.apkSha256.slice(0, 16)}… version ${buildIdentity.versionName} (${buildIdentity.versionCode})`);

  // 1. Baseline state (database + UI).
  const pre = snapshotDb('pre');

  // Main-journey outputs (null in --abandon-only mode).
  let uiPlan = [];
  let activeInstance = null;
  let plannedLegs = [];
  let planAgreement = null;
  let legOutcomes = [];
  let post = null;
  let reconciliation = null;
  let persistence = null;
  // Every mode starts from a KNOWN app state: launch (or re-launch) to Home.
  // The abandon-only mode once ran against a closed app (the previous run's
  // exit ladder had left the launcher in front) and every step recorded the
  // launcher — a harness artifact, not app evidence.
  await step('cold-start-home', async () => {
    adb(['shell', 'am', 'force-stop', PACKAGE]);
    await sleep(1500);
    adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1'], { tolerant: true });
    await sleep(5000);
  }, (n) => has(n, 'home-title', 'home-workout-cta', 'home-workout-plan', 'home-workout-continue'));
  if (!abandonOnly) {
  await step('workout-plan-visible', null,
    (n) => has(n, 'home-workout-plan', 'home-workout-list', 'home-workout-continue', 'home-workout-template-start'));
  uiPlan = planFromUi(dumpControls().nodes);
  activeInstance = (pre.workoutInstances || []).filter((w) => w.status === 'active').sort((a, b) => b.updated_at - a.updated_at)[0] || null;
  try {
    plannedLegs = activeInstance ? JSON.parse(activeInstance.game_ids_json) : [];
  } catch {
    // A malformed plan row is a FINDING, not a crash: the journey records the
    // disagreement below and continues to exercise the visible plan.
    plannedLegs = [];
  }
  // The Home plan surface is a WINDOW onto the plan ("up now" / "up next"),
  // not the full list, so the honest check is: the visible window matches the
  // head of the durable plan, in order.
  const uiPlanIds = uiPlan.map((p) => p.gameId);
  planAgreement = {
    uiPlan: uiPlanIds,
    dbPlan: plannedLegs,
    uiWindowMatchesPlanHead: uiPlanIds.every((id, i) => plannedLegs[i] === id) && uiPlanIds.length > 0,
  };
  void planObs;

  const startTargets = ['home-workout-continue', 'home-workout-cta', 'home-workout-template-start'];
  await step('workout-start', async (n) => {
    const t = startTargets.map((id) => n[id]).find(Boolean);
    if (t) tap(t);
    await sleep(3500);
  }, (n) => has(n, 'workout-context') || Object.keys(n).some((k) => /\.screen$/.test(k) || /\.intro$/.test(k)));

  legOutcomes = [];
  let interrupted = false;
  for (let leg = 1; leg <= maxLegs; leg++) {
    const outcome = await playLeg(leg);
    legOutcomes.push({ leg, ...outcome, gameIdsObserved: outcome.gameId || null });
    recordStep(`leg-${leg}-outcome`, null, dumpControls().nodes,
      (n) => Object.keys(n).some((k) => /\.results$/.test(k)) || has(n, 'results-workout-complete', 'home-workout-complete-panel'),
      outcome.ended === 'results' || outcome.ended === 'no-game-surface',
      { legOutcome: { ended: outcome.ended, gameId: outcome.gameId, iteration: outcome.iteration,
        tutorialSteps: outcome.tutorialSolveLog.length, gameplaySteps: outcome.gameplayLog.filter((g) => g.executed).length } });

    if (outcome.ended !== 'results') break;

    // Transition to the next leg (or the workout-complete state).
    const isLastBeforeInterrupt = leg === legsBeforeInterrupt && !interrupted && leg < maxLegs;
    const advance = dumpControls().nodes;
    const advanceView = gameView(advance);
    const c = advanceView ? advanceView.controls : {};
    const finishKey = Object.keys(c).find((k) => /^(finish-workout)$/.test(k));
    const nextKey = Object.keys(c).find((k) => /^(next-game)$/.test(k));
    const workoutProgressAtResults = c['workout-progress']?.text || null;
    if (isLastBeforeInterrupt) {
      interrupted = true;
      await step(`leg-${leg}-interrupt-terminate`, async () => {
        adb(['shell', 'am', 'force-stop', PACKAGE]);
        await sleep(2000);
        adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1'], { tolerant: true });
        await sleep(5000);
      }, (n) => has(n, 'home-workout-continue', 'home-workout-progress'));
      const resumeProgress = currentProgressText(dumpControls().nodes);
      await step('resume-visible', null, (n) => has(n, 'home-workout-continue', 'home-workout-progress'),
        { resumeProgress });
      await step('resume-workout', async (n) => {
        const t = n['home-workout-continue'] || n['home-workout-cta'];
        if (t) tap(t);
        await sleep(3500);
      }, (n) => has(n, 'workout-context') || Object.keys(n).some((k) => /\.screen$/.test(k) || /\.intro$/.test(k)));
      continue;
    }

    await step(`leg-${leg}-advance`, async () => {
      if (nextKey) tap(c[nextKey]);
      else if (finishKey) tap(c[finishKey]);
      await sleep(3000);
    }, (n) => has(n, 'workout-context', 'results-workout-complete', 'home-workout-complete-panel')
      || Object.keys(n).some((k) => /\.screen$/.test(k) || /\.intro$/.test(k) || /\.results$/.test(k)),
      { workoutProgressAtResults, advanceControl: nextKey || finishKey || null });

    if (finishKey && !nextKey) break; // workout finished at the results screen
  }

  // 2. Completion evidence + reward reconciliation.
  post = snapshotDb('post');
  reconciliation = reconcile(pre, post);
  await step('completion-evidence', null, (n) =>
    has(n, 'results-workout-complete', 'home-workout-complete-panel', 'home-workout-complete'));

  // 3. Persistence across one more restart.
  await step('persistence-restart', async () => {
    adb(['shell', 'am', 'force-stop', PACKAGE]);
    await sleep(2000);
    adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1'], { tolerant: true });
    await sleep(5000);
  }, (n) => has(n, 'home-workout-complete-panel', 'home-workout-continue', 'home-title'));
  const persisted = snapshotDb('persisted');
  persistence = {
    sessionsStable: JSON.stringify((persisted.gameSessions || []).map((r) => r.id)) === JSON.stringify((post.gameSessions || []).map((r) => r.id)),
    ledgerStable: JSON.stringify((persisted.currencyLedger || []).map((r) => r.id)) === JSON.stringify((post.currencyLedger || []).map((r) => r.id)),
    balanceStable: JSON.stringify(persisted.currencyBalance) === JSON.stringify(post.currencyBalance),
    workoutStable: JSON.stringify(persisted.workoutInstances) === JSON.stringify(post.workoutInstances),
  };

  }

  // 4. Abandoned/quit workout scenario. The daily skip control is bound to
  //    TODAY's daily instance (use-workout `skipCurrentLeg` reads
  //    `getByDate(date)`), and today's daily is already completed, so the
  //    exercised path is the product's QUIT route on an in-progress TEMPLATE
  //    workout: start it, walk away before playing, and prove the walk-away is
  //    safe — no phantom rewards, resumable after restart. The skip control's
  //    disabled state + hint are recorded as the documented skip boundary.
  // uiautomator only reports VISIBLE nodes on this app's scroll views (a
  // scrolled-away `home-title` is absent from the dump), so every Home
  // interaction targets its control by scrolling until it is in the window.
  const scrollUntil = async (keyRe, maxSwipes = 4) => {
    for (let i = 0; i < maxSwipes; i++) {
      const n = dumpControls().nodes;
      if (Object.keys(n).some((k) => keyRe.test(k))) return n;
      adb(['shell', 'input', 'swipe', '540', '1400', '540', '400', '300'], { tolerant: true });
      await sleep(1500);
    }
    return dumpControls().nodes;
  };
  // Home is PROVEN by the tab bar or any Home section — `home-title` alone is
  // scroll-position dependent and produced false negatives.
  const isHome = (n) => n['tab-home'] || n['home-title'] || n['home-workout-templates']
    || n['home-workout-list'] || n['home-workout-history'] || n['home-workout-complete-panel'];
  let abandon = null;
  if (!skipAbandon) {
    const t0 = snapshotDb('abandon-pre');
    await step('abandon-select-template', async () => {
      const n = await scrollUntil(/^home-workout-template-(?!row|start|selected|details)/);
      // Chip ids are `home-workout-template-<templateId>`. Deterministic pick:
      // the alphabetically first chip.
      const chip = Object.keys(n).filter((k) => /^home-workout-template-/.test(k)
        && !/-(row|start|selected|details)$/.test(k) && n[k].bounds).sort()[0];
      if (chip) tap(n[chip]);
      await sleep(2000);
      // The selected-details + start surfaces render BELOW the chips row; the
      // expectation must see them, so scroll them into the window explicitly.
      await scrollUntil(/home-workout-template-start/);
    }, (n) => has(n, 'home-workout-selected', 'home-workout-focus', 'home-workout-template-start'));
    await step('abandon-start-template', async () => {
      const n = await scrollUntil(/home-workout-template-start/);
      const t = n['home-workout-template-start'];
      if (t) tap(t);
      await sleep(3500);
    }, (n) => Object.keys(n).some((k) => /\.(workout-context|intro|screen)$/.test(k))
      || has(n, 'home-workout-continue'));
    // Walk away WITHOUT playing: intro-back first, else Back -> pause-quit
    // ladder. Never blind-double-Back (that closes the app).
    await step('abandon-quit-workout', async () => {
      for (let i = 0; i < 4; i++) {
        const n = dumpControls().nodes;
        if (isHome(n)) break;
        const introBack = Object.keys(n).find((k) => /intro-back$/.test(k) && n[k].bounds);
        const quit = Object.keys(n).find((k) => /(pause-quit|quit-discard)$/.test(k) && n[k].bounds)
          || (Object.keys(n).some((k) => /\.quit$/.test(k)) ? Object.keys(n).find((k) => /\.quit$/.test(k)) : null);
        if (introBack) { tap(n[introBack]); await sleep(2500); continue; }
        if (quit) { tap(n[quit]); await sleep(2500); continue; }
        adb(['shell', 'input', 'keyevent', 'KEYCODE_BACK'], { tolerant: true });
        await sleep(1800);
        const m = dumpControls().nodes;
        if (!isHome(m) && Object.keys(m).length === 0) {
          adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1'], { tolerant: true });
          await sleep(4000);
        }
      }
    }, (n) => !!isHome(n));
    // The daily skip control's CURRENT boundary is recorded (control + hint +
    // enabled state): with today's daily completed it is honestly disabled.
    await step('abandon-skip-boundary', async () => {
      await scrollUntil(/home-workout-skip/, 5);
    }, null, { note: 'skip is daily-only (use-workout skipCurrentLeg -> getByDate(date)); recorded, not asserted' });
    await step('abandon-restart', async () => {
      adb(['shell', 'am', 'force-stop', PACKAGE]);
      await sleep(2000);
      adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1'], { tolerant: true });
      await sleep(5000);
    }, (n) => !!isHome(n), { note: 'walk-away must leave the template workout resumable, with no phantom rewards' });
    const t1 = snapshotDb('abandon-post');
    // SKIP attribution: compare the TEMPLATE instance rows (keys containing
    // '::') by identity, not the whole table — the table legitimately changed
    // when the template instance was CREATED, and calling that a recorded skip
    // would be a false claim.
    const templateRows = (rows) => (rows || []).filter((r) => String(r.date).includes('::'));
    const t0Templates = new Map(templateRows(t0.workoutInstances).map((r) => [r.date, r]));
    const templateChanges = templateRows(t1.workoutInstances).map((r) => {
      const before = t0Templates.get(r.date) || null;
      return {
        date: r.date,
        existedBefore: !!before,
        statusBefore: before ? before.status : null,
        statusAfter: r.status,
        skippedBefore: before ? before.skipped_indices_json : null,
        skippedAfter: r.skipped_indices_json,
        skipRecorded: r.skipped_indices_json !== null && r.skipped_indices_json !== (before ? before.skipped_indices_json : null),
      };
    });
    abandon = {
      templateChanges,
      skipRecorded: templateChanges.some((c) => c.skipRecorded),
      sessionsAdded: (t1.gameSessions || []).length - (t0.gameSessions || []).length,
      ledgerAdded: (t1.currencyLedger || []).length - (t0.currencyLedger || []).length,
      xpAwardsAdded: (t1.xpAwards || []).length - (t0.xpAwards || []).length,
      // A walk-away with zero play must land zero rewards; anything else is a
      // FINDING, and the counts above are the exact evidence either way.
      noPhantomRewards: (t1.gameSessions || []).length === (t0.gameSessions || []).length
        && (t1.currencyLedger || []).length === (t0.currencyLedger || []).length
        && (t1.xpAwards || []).length === (t0.xpAwards || []).length,
      workoutInstancesAfter: t1.workoutInstances,
    };
    // Final state is RECORDED, not asserted: the honest evidence is the DB
    // diff above plus the visible history/status surface.
    await step('abandon-final-state', null, null);
  }

  const out = {
    schemaVersion: 2,
    journey: 'workout-v3-full-native-lifecycle',
    mode: abandonOnly ? 'abandon-only' : 'full',
    generatedAt: new Date().toISOString(),
    runStamp: RUN_STAMP,
    device: SERIAL,
    package: PACKAGE,
    buildIdentity,
    workout: {
      instanceKey: activeInstance ? activeInstance.date : null,
      plannedLegs,
      uiPlan,
      planAgreement,
      legsBeforeInterrupt,
    },
    steps,
    legOutcomes,
    reconciliation,
    persistence,
    abandon,
    dbSnapshots: {
      pre: path.relative(REPO_ROOT, path.join(DB_ROOT, 'pre.summary.json')).replace(/\\/g, '/'),
      post: path.relative(REPO_ROOT, path.join(DB_ROOT, 'post.summary.json')).replace(/\\/g, '/'),
      persisted: path.relative(REPO_ROOT, path.join(DB_ROOT, 'persisted.summary.json')).replace(/\\/g, '/'),
    },
    summary: {
      stepsRecorded: steps.length,
      stepsObserved: steps.filter((s) => s.observed === true).length,
      stepsNotObserved: steps.filter((s) => s.observed === false).map((s) => s.name),
      legsEndedInResults: legOutcomes.filter((l) => l.ended === 'results').length,
    },
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`[workout] journey evidence -> ${outFile}`);
  console.log(`[workout] legs ended in results: ${out.summary.legsEndedInResults}/${legOutcomes.length}`);
  if (reconciliation) {
    console.log(`[workout] new sessions: ${reconciliation.newSessions.length}, ledger delta: ${reconciliation.ledgerDelta}, balance delta: ${reconciliation.balanceDelta}`);
  } else {
    console.log('[workout] abandon-only mode: no main-journey reconciliation');
  }
  console.log(`[workout] steps observed ${out.summary.stepsObserved}/${steps.length}`);
})();
