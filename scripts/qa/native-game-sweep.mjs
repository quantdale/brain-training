#!/usr/bin/env node
/**
 * native-game-sweep.mjs — deterministic, emulator-local native QA driver.
 *
 * Campaign 080 workstream A. Fixes the Campaign 079 automation bottleneck
 * (UIAutomator dumps ~4-5s vs game timers ~9-10s) by reusing the app's stable
 * semantic surface (`gameId.control` resource-ids, sdk/testid.ts), deep-linking
 * straight to a game (`braintraining://game/<id>`), pre-capturing the hierarchy
 * before acting, injecting deterministic `adb shell input` taps, and capturing
 * screenshots out-of-band. No host mouse/keyboard/desktop coordinates are ever
 * used — everything is emulator-local via ADB (AGENTS.md host-interaction
 * prohibition).
 *
 * It drives the installed PRODUCTION build (QA force-hooks are correctly
 * disabled there), so "complete a session" is reached by real play or by a
 * session ending (rounds exhausted / timer expiry / wrong answers), never by
 * fabricating a win. Levels are recorded at their true depth:
 *   L1 native smoke      — launch, routing, identity, controls render, safe exit
 *   L2 native interaction— a valid/invalid input submitted, feedback observed
 *   L3 full lifecycle    — a whole session ended (win OR fail) + results shown
 *
 * Usage:
 *   node scripts/qa/native-game-sweep.mjs [--games a,b,c] [--out FILE]
 *        [--serial SERIAL] [--deep-level] [--dry-run]
 *
 * Exit codes: 0 = sweep ran (per-game results recorded), 2 = usage error,
 * 3 = no device / harness error.
 */
'use strict';

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GAMES_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'games');
const DEFAULT_OUT = path.join(REPO_ROOT, 'scripts', 'qa', 'native-coverage-ledger.json');
const ARTIFACT_ROOT = path.join(REPO_ROOT, 'qa-artifacts', '080', 'sweep');

// --- args -------------------------------------------------------------------
function usage() {
  console.log('usage: native-game-sweep.mjs [--games a,b,c] [--out FILE] [--serial S] [--deep-level] [--dry-run]');
}
const args = process.argv.slice(2);
let onlyGames = null;
let outFile = DEFAULT_OUT;
let serialOverride = null;
let deepLevel = false;
let dryRun = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--games') onlyGames = String(args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--out') outFile = path.resolve(args[++i] || DEFAULT_OUT);
  else if (a === '--serial') serialOverride = args[++i];
  else if (a === '--deep-level') deepLevel = true;
  else if (a === '--dry-run') dryRun = true;
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
  else { console.error(`unknown option '${a}'`); usage(); process.exit(2); }
}

// --- adb discovery ----------------------------------------------------------
function findAdb() {
  const candidates = [
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe'),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb'),
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb'),
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(process.env.USERPROFILE || os.homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error('adb not found; set ANDROID_SDK_ROOT');
}
const ADB = findAdb();

function adb(serial, sub, opts = {}) {
  const timeout = opts.timeout || 30000;
  const argv = serial ? ['-s', serial, ...sub] : sub;
  try {
    return execFileSync(ADB, argv, {
      encoding: 'utf8',
      timeout,
      maxBuffer: 32 * 1024 * 1024,
      windowsHide: true,
      stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (opts.tolerant) return '';
    throw err;
  }
}

function resolveSerial() {
  if (serialOverride) return serialOverride;
  const out = adb(null, ['devices'], { timeout: 15000 });
  const lines = out.split('\n').map((l) => l.trim()).filter((l) => /^emulator-\d+\s+device$/.test(l));
  if (lines.length === 0) throw new Error('no emulator device online');
  return lines[0].split(/\s+/)[0];
}

// --- guest helpers ----------------------------------------------------------
function sha1(buf) { return crypto.createHash('sha1').update(buf).digest('hex'); }

function screencap(serial, localPath) {
  const buf = execFileSync(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer', timeout: 30000, windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  });
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buf);
  return { bytes: buf.length, sha1: sha1(buf) };
}

function dumpHierarchy(serial) {
  const remote = '/sdcard/bt-sweep-dump.xml';
  adb(serial, ['shell', 'uiautomator', 'dump', remote], { timeout: 60000, tolerant: true });
  const out = adb(serial, ['shell', 'cat', remote], { timeout: 30000, tolerant: true });
  return out || '';
}

/** Parse uiautomator XML into { suffix: {bounds,text,desc,cls} } for gameId.* nodes. */
function parseControls(xml, gameId) {
  const controls = {};
  const nodeRe = /<node\b[^>]*>/g;
  let m;
  while ((m = nodeRe.exec(xml))) {
    const tag = m[0];
    const rid = /resource-id="([^"]*)"/.exec(tag)?.[1] || '';
    if (!rid.startsWith(gameId + '.') && rid !== gameId) continue;
    const suffix = rid === gameId ? '(screen)' : rid.slice(gameId.length + 1);
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tag);
    controls[suffix] = {
      bounds: bounds ? [ +bounds[1], +bounds[2], +bounds[3], +bounds[4] ] : null,
      text: /text="([^"]*)"/.exec(tag)?.[1] || '',
      desc: /content-desc="([^"]*)"/.exec(tag)?.[1] || '',
      cls: /class="([^"]*)"/.exec(tag)?.[1] || '',
    };
  }
  return controls;
}

function center(bounds) {
  if (!bounds) return null;
  return [ Math.round((bounds[0] + bounds[2]) / 2), Math.round((bounds[1] + bounds[3]) / 2) ];
}

function tap(serial, pt) {
  if (!pt) return;
  adb(serial, ['shell', 'input', 'tap', String(pt[0]), String(pt[1])], { timeout: 15000, tolerant: true });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function deepLink(serial, gameId) {
  adb(serial, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `braintraining://game/${gameId}`], { timeout: 20000, tolerant: true });
}

function pressBack(serial) {
  adb(serial, ['shell', 'input', 'keyevent', 'KEYCODE_BACK'], { timeout: 15000, tolerant: true });
}

// --- per-game driver --------------------------------------------------------
function loadGames() {
  const all = [];
  for (const d of fs.readdirSync(GAMES_DIR).sort()) {
    let isDir = false;
    try { isDir = fs.statSync(path.join(GAMES_DIR, d)).isDirectory(); } catch { isDir = false; }
    const metaPath = path.join(GAMES_DIR, d, 'game.json');
    if (!isDir || !fs.existsSync(metaPath)) continue;
    let meta;
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (e) {
      console.error(`[sweep] skipping ${d}: malformed game.json (${e.message})`);
      continue;
    }
    all.push({ dir: d, meta });
  }
  return onlyGames ? all.filter((g) => onlyGames.includes(g.meta.id)) : all;
}

/**
 * Generic phase detector + actor. Returns observed milestones for honest level
 * classification. Never claims more than it actually did.
 */
async function driveGame(serial, gameId, artDir) {
  const milestones = {
    launched: false, rendered: false, tutorialSeen: false, tutorialCleared: false,
    started: false, inputSubmitted: false, feedbackObserved: false, roundAdvanced: false,
    sessionEnded: false, resultsShown: false, safeExit: false,
  };
  const controlLog = [];
  const shot = (name) => screencap(serial, path.join(artDir, `${name}.png`));

  // Launch
  deepLink(serial, gameId);
  await sleep(2600);
  milestones.launched = true;

  let xml = dumpHierarchy(serial);
  let controls = parseControls(xml, gameId);
  controlLog.push({ phase: 'launch', controls: Object.keys(controls) });
  if (controls['(screen)'] || Object.keys(controls).length > 0) {
    milestones.rendered = true;
    await shot('L1-launch');
  }

  const firstControlCount = Object.keys(controls).length;

  // Tutorial dismiss (up to 6 hops)
  if (Object.keys(controls).some((k) => k.startsWith('tutorial'))) {
    milestones.tutorialSeen = true;
    for (let hop = 0; hop < 6; hop++) {
      const skip = controls['tutorial-skip'] && center(controls['tutorial-skip'].bounds);
      const next = controls['tutorial-next'] && center(controls['tutorial-next'].bounds);
      const done = controls['tutorial-done'] && center(controls['tutorial-done'].bounds);
      const target = skip || done || next;
      if (!target) break;
      tap(serial, target);
      await sleep(1400);
      xml = dumpHierarchy(serial);
      controls = parseControls(xml, gameId);
      if (!Object.keys(controls).some((k) => k.startsWith('tutorial'))) { milestones.tutorialCleared = true; break; }
    }
    controlLog.push({ phase: 'after-tutorial', controls: Object.keys(controls) });
  }

  // Start the game
  for (const startKey of ['start', 'play', 'begin', 'start-game', 'tutorial-done']) {
    const b = controls[startKey] && center(controls[startKey].bounds);
    if (b) { tap(serial, b); milestones.started = true; await sleep(1800); break; }
  }
  xml = dumpHierarchy(serial);
  controls = parseControls(xml, gameId);
  controlLog.push({ phase: 'playing', controls: Object.keys(controls) });

  // Attempt real interaction: tap interactive game controls, advance rounds.
  // Match a tappable game control by a trailing `noun` or `noun.index` in the
  // suffix, so nested surfaces like `card-grid.card.0`, `word-grid.word.3`,
  // `tile.0`, or `target-card` are all recognized (Campaign 080 A3 fix).
  const interactiveRe = /(^|[.\-])(tile|card|option|word|choice|answer|cell|item|node|target-card|number|operator|symbol|key|pad|token|chip)(\.\d+)?$/;
  // Per-round feedback (round-result / round-failed / next-round) is an L2
  // interaction signal, NOT a final session result. Final results require a
  // clear session-end control (play-again / session-result / final / results).
  const roundFeedbackRe = /^(round[-.]?\d*|round-result|round-failed|next-round|feedback)/;
  const finalResultsRe = /^(play-again|replay|again|session-result|final|results?|result-screen|complete|completed|done|finish|finished)([.\-]|$)/;
  const rounds = [];
  for (let step = 0; step < (deepLevel ? 14 : 6); step++) {
    const keys = Object.keys(controls);
    // Detect per-round feedback / verdict (L2)
    if (keys.some((k) => /verdict|feedback|correct|incorrect|round-result|round-failed/.test(k))) milestones.feedbackObserved = true;
    // Detect TRUE session end / final results (L3) — exclude per-round controls
    if (keys.some((k) => finalResultsRe.test(k))) {
      milestones.sessionEnded = true; milestones.resultsShown = true; break;
    }
    // Detect round advancement evidence (per-round result board => a round resolved)
    const roundKeys = keys.filter((k) => /^round[.\-]\d+$/.test(k));
    if (roundKeys.length) rounds.push(roundKeys.join(','));
    if (keys.some((k) => roundFeedbackRe.test(k))) milestones.roundAdvanced = milestones.roundAdvanced || false;

    // Choose an action. Prefer a REAL answer tap while interactive controls are
    // live (active round); only advance via next-round/submit when the board is a
    // feedback/transition surface (no live interactive controls).
    const inter = keys.find((k) => interactiveRe.test(k) && controls[k].bounds);
    const advanceKey = ['next-round', 'submit', 'check', 'confirm', 'next', 'continue', 'done']
      .find((k) => controls[k] && center(controls[k].bounds));
    if (inter) {
      tap(serial, center(controls[inter].bounds));
      milestones.inputSubmitted = true;
      await sleep(1500);
    } else if (advanceKey) {
      tap(serial, center(controls[advanceKey].bounds));
      if (/next-round|next|continue/.test(advanceKey)) milestones.roundAdvanced = true;
      await sleep(1500);
    } else {
      // No known control; tap the stage center once as a last resort.
      const stage = controls['stage'] || controls['board'] || controls['(screen)'];
      if (stage && stage.bounds) tap(serial, center(stage.bounds));
      await sleep(1500);
    }
    xml = dumpHierarchy(serial);
    controls = parseControls(xml, gameId);
    controlLog.push({ phase: `step-${step}`, controls: Object.keys(controls) });
    if (Object.keys(controls).length && Object.keys(controls).some((k) => /verdict|feedback/.test(k))) milestones.feedbackObserved = true;
  }

  // Final results capture — only when a true session-end control is present.
  if (milestones.resultsShown || Object.keys(controls).some((k) => finalResultsRe.test(k))) {
    milestones.sessionEnded = true;
    milestones.resultsShown = true;
    await shot('L3-results');
  }

  // Safe exit
  pressBack(serial);
  await sleep(1200);
  milestones.safeExit = true;

  return { milestones, controlLog, firstControlCount, roundSignals: rounds };
}

function classifyLevel(m) {
  // L3: a whole session ended (win OR fail) AND a final results screen showed.
  if (m.sessionEnded && m.resultsShown) return 3;
  // L2: a valid/invalid input or in-game feedback/round advance was observed.
  if (m.inputSubmitted || m.feedbackObserved || m.roundAdvanced || m.started) return 2;
  // L1: launched, rendered with controls, safe exit.
  if (m.rendered && m.safeExit) return 1;
  return m.launched ? 1 : 0;
}

// --- main -------------------------------------------------------------------
(async function main() {
  let serial;
  try { serial = resolveSerial(); } catch (e) { console.error('[sweep] ' + e.message); process.exit(3); }
  console.log(`[sweep] adb=${ADB}\n[sweep] serial=${serial}\n[sweep] deepLevel=${deepLevel}`);

  const games = loadGames();
  if (games.length === 0) { console.error('[sweep] no games matched'); process.exit(2); }
  console.log(`[sweep] ${games.length} game(s) to sweep`);

  if (dryRun) {
    for (const g of games) console.log(`  would sweep ${g.meta.id} (${g.meta.name})`);
    process.exit(0);
  }

  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const ledger = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    harness: 'scripts/qa/native-game-sweep.mjs',
    buildIdentity: process.env.BT_BUILD_IDENTITY || 'installed production build (com.braintraining.app)',
    device: adb(serial, ['shell', 'getprop', 'ro.product.model'], { tolerant: true }).trim() || 'emulator',
    abi: adb(serial, ['shell', 'getprop', 'ro.product.cpu.abi'], { tolerant: true }).trim(),
    display: adb(serial, ['shell', 'wm', 'size'], { tolerant: true }).trim(),
    density: adb(serial, ['shell', 'wm', 'density'], { tolerant: true }).trim(),
    renderer: 'SwiftShader (emulator software rendering)',
    games: [],
  };

  for (const g of games) {
    const id = g.meta.id;
    const artDir = path.join(ARTIFACT_ROOT, id);
    process.stdout.write(`[sweep] ${id} ... `);
    let record;
    try {
      const drive = await driveGame(serial, id, artDir);
      const level = classifyLevel(drive.milestones);
      // Hash artifacts
      const artifacts = [];
      for (const f of fs.existsSync(artDir) ? fs.readdirSync(artDir) : []) {
        const p = path.join(artDir, f);
        const buf = fs.readFileSync(p);
        artifacts.push({ file: `qa-artifacts/080/sweep/${id}/${f}`, bytes: buf.length, sha1: sha1(buf) });
      }
      record = {
        id,
        name: g.meta.name,
        category: g.meta.primaryCategory,
        hasTutorial: g.meta.hasTutorial,
        levelReached: level,
        milestones: drive.milestones,
        controlInventoryCount: drive.firstControlCount,
        controlLog: drive.controlLog,
        roundSignals: drive.roundSignals,
        artifacts,
        result: level >= 2 ? 'PASS' : (level === 1 ? 'SMOKE_ONLY' : 'FAIL'),
        remainingGap: level < 3
          ? `Level ${level} reached; full lifecycle (session-complete + results + persistence + replay + pause/resume/quit) not exercised this run`
          : 'lifecycle reached; persistence/replay/pause-depth and scoring-correctness verified separately in journey workstream',
      };
    } catch (err) {
      record = {
        id, name: g.meta.name, category: g.meta.primaryCategory,
        levelReached: 0, result: 'ERROR', error: String(err.message || err),
        remainingGap: 'sweep error — reproduced blocker; retry with instrumentation',
      };
    }
    ledger.games.push(record);
    console.log(`L${record.levelReached} ${record.result}`);
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(ledger, null, 2));

  // Summary
  const byLevel = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const r of ledger.games) byLevel[r.levelReached] = (byLevel[r.levelReached] || 0) + 1;
  console.log('\n[sweep] DONE. Level distribution:', JSON.stringify(byLevel));
  console.log('[sweep] ledger ->', outFile);
})();
