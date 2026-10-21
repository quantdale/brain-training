#!/usr/bin/env node
/**
 * native-game-sweep.mjs — deterministic, emulator-local native QA driver
 * (Campaign 080, evidence contract 2.0). Replaces the v1 sweep whose
 * classification conflated "action attempted" with "action succeeded"
 * (independent review F-080-001..005).
 *
 * What changed vs v1:
 *  - Emits STRUCTURED EVIDENCE EVENTS (actionRequested / actionExecuted /
 *    actionAcknowledged / stateBefore / stateAfter / transitionObserved /
 *    transitionValid / timestamps / artifact / executionAttemptId) plus ordered
 *    OBSERVATIONS with parsed control inventories, score and board values.
 *  - Every claimed outcome is proven by before/after hierarchy observations:
 *    gameplay entry requires an observed intro/tutorial -> playing transition;
 *    input acceptance requires an observed gameplay-state change after the tap;
 *    feedback must be NEW after an in-playing input; round advancement requires
 *    an observed round-counter increase.
 *  - Safe exit (F-080-002) is proven by a POST-Back observation of the
 *    destination (app screen or launcher), never assumed.
 *  - Results currency (F-080-004): a results screen only counts when it follows
 *    playing-state observations inside the same execution attempt.
 *  - Provenance (F-080-005): every run binds git SHA, package/versionCode,
 *    installed-APK sha256, device profile and artifact hashes.
 *  - Tutorial demos can no longer masquerade as gameplay: the driver only acts
 *    on gameplay controls while the OBSERVED state is 'playing'.
 *  - Passive/timed games get input-independent progression evidence instead of
 *    a fake interaction contract (prompt §3.3).
 *
 * The classification itself is delegated to scripts/qa/coverage-contract.mjs so
 * the same rules are unit-tested adversarially (coverage-contract.test.mjs).
 *
 * Usage:
 *   node scripts/qa/native-game-sweep.mjs [--games a,b,c] [--out FILE]
 *        [--serial SERIAL] [--steps N] [--dry-run]
 *
 * Exit codes: 0 = sweep ran (per-game records emitted), 2 = usage error,
 * 3 = no device / harness error.
 */
'use strict';

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_VERSION,
  GameStates,
  classifyRun,
  observeState,
  stateFingerprint,
} from './coverage-contract.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GAMES_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'games');
const DEFAULT_OUT = path.join(REPO_ROOT, 'scripts', 'qa', 'native-coverage-ledger.json');
const ARTIFACT_ROOT = path.join(REPO_ROOT, 'qa-artifacts', '080', 'sweep-v2');
const PACKAGE = 'com.braintraining.app';

// --- args ------------------------------------------------------------------
function usage() {
  console.log('usage: native-game-sweep.mjs [--games a,b,c] [--out FILE] [--serial S] [--steps N] [--dry-run]');
}
const argv = process.argv.slice(2);
let onlyGames = null;
let outFile = DEFAULT_OUT;
let serialOverride = null;
let steps = 12;
let dryRun = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--games') onlyGames = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--out') outFile = path.resolve(argv[++i] || DEFAULT_OUT);
  else if (a === '--serial') serialOverride = argv[++i];
  else if (a === '--steps') steps = Number(argv[++i]) || 12;
  else if (a === '--dry-run') dryRun = true;
  else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
  else { console.error(`unknown option '${a}'`); usage(); process.exit(2); }
}

// --- adb -------------------------------------------------------------------
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
  const argv2 = serial ? ['-s', serial, ...sub] : sub;
  try {
    return execFileSync(ADB, argv2, {
      encoding: 'utf8', timeout: opts.timeout || 30000,
      maxBuffer: 32 * 1024 * 1024, windowsHide: true,
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

const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- provenance (F-080-005) ----------------------------------------------
function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true }).trim();
  } catch { return null; }
}

function buildIdentity(serial) {
  const dump = adb(serial, ['shell', 'dumpsys', 'package', PACKAGE], { tolerant: true, timeout: 30000 });
  const versionName = /versionName=([^\s]+)/.exec(dump)?.[1] || null;
  const versionCode = /versionCode=(\d+)/.exec(dump)?.[1] || null;
  const pkgPath = adb(serial, ['shell', 'pm', 'path', PACKAGE], { tolerant: true }).trim().split('\n')[0]?.replace(/^package:/, '') || null;
  let apkSha256 = null;
  if (pkgPath) {
    const out = adb(serial, ['shell', 'sha256sum', pkgPath], { tolerant: true, timeout: 60000 });
    apkSha256 = (/^([0-9a-f]{64})/.exec(out.trim()) || [])[1] || null;
  }
  return { gitSha: gitSha(), packageName: PACKAGE, versionName, versionCode: versionCode ? Number(versionCode) : null, apkSha256, installedApkPath: pkgPath };
}

function deviceProfile(serial) {
  return {
    serial,
    model: adb(serial, ['shell', 'getprop', 'ro.product.model'], { tolerant: true }).trim() || null,
    abi: adb(serial, ['shell', 'getprop', 'ro.product.cpu.abi'], { tolerant: true }).trim() || null,
    display: adb(serial, ['shell', 'wm', 'size'], { tolerant: true }).trim() || null,
    density: adb(serial, ['shell', 'wm', 'density'], { tolerant: true }).trim() || null,
    renderer: 'SwiftShader (emulator software rendering)',
  };
}

// --- observations ----------------------------------------------------------
function dumpHierarchy(serial) {
  const remote = '/sdcard/bt-sweep-dump.xml';
  adb(serial, ['shell', 'uiautomator', 'dump', remote], { timeout: 60000, tolerant: true });
  return adb(serial, ['shell', 'cat', remote], { timeout: 30000, tolerant: true }) || '';
}

function parseControls(xml, gameId) {
  const controls = {};
  const nodeRe = /<node\b[^>]*>/g;
  let m;
  while ((m = nodeRe.exec(xml))) {
    const tag = m[0];
    const rid = /resource-id="([^"]*)"/.exec(tag)?.[1] || '';
    if (!rid.startsWith(gameId + '.') && rid !== gameId) continue;
    const suffix = rid === gameId ? 'screen' : rid.slice(gameId.length + 1);
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tag);
    controls[suffix] = {
      bounds: bounds ? [+bounds[1], +bounds[2], +bounds[3], +bounds[4]] : null,
      text: /text="([^"]*)"/.exec(tag)?.[1] || '',
      desc: /content-desc="([^"]*)"/.exec(tag)?.[1] || '',
    };
  }
  return controls;
}

function currentFocus(serial) {
  const out = adb(serial, ['shell', 'dumpsys', 'window'], { tolerant: true, timeout: 20000 });
  const line = /mCurrentFocus=Window\{[^}]*\s([^\s}]+)/.exec(out) || /mResumedActivity: ActivityInfo\{[^}]*\s([^\s/}]+)/.exec(out);
  return line ? line[1] : '';
}

function screenMarkersFor(serial, controls) {
  const markers = [];
  const focus = currentFocus(serial);
  if (focus && !focus.startsWith(PACKAGE)) markers.push('launcher');
  if (Object.keys(controls).length === 0 && markers.length === 0) markers.push('non-game-app-screen');
  return markers;
}

/**
 * Take one observation. `key` decides whether the full evidence bundle
 * (screenshot + hierarchy dump) is stored; the parsed control inventory,
 * score and board values are captured for EVERY observation either way.
 */
function observe(ctx, phase, key) {
  const { serial, gameId, artDir } = ctx;
  const xml = dumpHierarchy(serial);
  const controls = parseControls(xml, gameId);
  const suffixes = Object.keys(controls).sort();
  const scoreControl = controls['score'];
  const boardValues = suffixes
    .filter((s) => /(tile|card|option|word|choice|cell|item|node|target-card|number|symbol|token|chip|key|display|board|sequence|status|problem|text|answer|label|prompt)(\.\d+)?$/.test(s))
    .map((s) => `${s}=${controls[s].text || controls[s].desc || ''}`);
  const obs = {
    seq: ctx.obsSeq++,
    phase,
    timestamp: new Date().toISOString(),
    controls: suffixes,
    screenMarkers: screenMarkersFor(serial, controls),
    observedGameId: suffixes.length ? gameId : null,
    score: scoreControl ? (scoreControl.text || scoreControl.desc || null) : null,
    boardValues,
    evidenceArtifact: null,
  };
  // Cache the parsed inventory (with bounds) so the driving loops can act
  // WITHOUT re-dumping the hierarchy — on this emulator a dump costs ~3-4s
  // against 9-10s game timers, and a duplicate dump per step made rounds time
  // out before any tap landed (the v1 bottleneck class).
  ctx.lastControls = controls;
  obs.state = observeState({ ...obs, gameId }).state;
  if (key) {
    const pngPath = path.join(artDir, `obs-${String(obs.seq).padStart(2, '0')}-${phase}.png`);
    try {
      const buf = execFileSync(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], {
        encoding: 'buffer', timeout: 30000, windowsHide: true, maxBuffer: 32 * 1024 * 1024,
      });
      fs.mkdirSync(artDir, { recursive: true });
      fs.writeFileSync(pngPath, buf);
      ctx.artifacts.push({ file: path.relative(REPO_ROOT, pngPath).replace(/\\/g, '/'), bytes: buf.length, sha1: sha1(buf) });
      obs.evidenceArtifact = { file: path.relative(REPO_ROOT, pngPath).replace(/\\/g, '/'), sha1: sha1(buf) };
    } catch { /* screenshot failure stays visible as evidenceArtifact: null */ }
    const xmlPath = path.join(artDir, `obs-${String(obs.seq).padStart(2, '0')}-${phase}.xml`);
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(xmlPath, xml);
    ctx.artifacts.push({ file: path.relative(REPO_ROOT, xmlPath).replace(/\\/g, '/'), bytes: xml.length, sha1: sha1(Buffer.from(xml)) });
    if (!obs.evidenceArtifact) obs.evidenceArtifact = { file: path.relative(REPO_ROOT, xmlPath).replace(/\\/g, '/'), sha1: sha1(Buffer.from(xml)) };
  }
  ctx.observations.push(obs);
  return obs;
}

// --- events ----------------------------------------------------------------
const LEGAL_TRANSITIONS = new Set([
  'intro>playing', 'tutorial>intro', 'tutorial>playing', 'playing>results',
  'playing>intro', 'intro>exited', 'tutorial>exited', 'playing>exited',
  'results>exited', 'intro>launcher', 'tutorial>launcher', 'playing>launcher',
  'results>launcher', 'exited>launcher', 'playing>intro', 'results>intro',
  'intro>tutorial', 'playing>playing',
]);

function emitEvent(ctx, e) {
  const ev = {
    seq: ctx.eventSeq++,
    action: e.action,
    target: e.target,
    actionRequested: true,
    actionExecuted: e.actionExecuted !== false,
    actionAcknowledged: e.actionAcknowledged ?? null,
    observationBeforeSeq: e.before ? e.before.seq : undefined,
    observationAfterSeq: e.after ? e.after.seq : undefined,
    stateBefore: e.before ? e.before.state : undefined,
    stateAfter: e.after ? e.after.state : undefined,
    transitionObserved: e.before && e.after ? e.before.state !== e.after.state : false,
    transitionValid: e.before && e.after
      ? (e.before.state === e.after.state || LEGAL_TRANSITIONS.has(`${e.before.state}>${e.after.state}`))
      : undefined,
    evidenceArtifact: e.after && e.after.evidenceArtifact ? e.after.evidenceArtifact.file : null,
    timestamp: new Date().toISOString(),
    executionAttemptId: ctx.attemptId,
  };
  ctx.events.push(ev);
  return ev;
}

// --- input-family adapters (prompt §7.3) ----------------------------------
// Answer-surface families observed across the real 42-game catalog (from the
// recorded control inventories): selectors, response/peg/guess surfaces,
// swatch/shape/glyph pickers, keypad keys, binary buttons, colour/letter
// options and math operators. Non-answer surfaces (score, stage, prompt,
// status, live, display, scroll, verdict, …) are deliberately NOT matched.
const SELECTOR_RE = /(^|[.\-])(tile|card|option|options|word|choice|cell|item|node|target|target-card|number|operator|symbol|token|chip|response|digit|peg|pegs|guess|swatch|shape|glyph|block|row|slot|marker|cue|clue|question|command|commands|trigger|field|term|value|comparison|stimulus|pick|color|same|different|left|right|red|blue|green|yellow|purple|orange|[A-Z]|\+|\-|\*|\/)(\.\d+)?$/;
const ADVANCE_KEYS = ['next-round', 'submit', 'check', 'confirm', 'next', 'continue', 'done', 'skip', 'reveal'];

function center(bounds) {
  return bounds ? [Math.round((bounds[0] + bounds[2]) / 2), Math.round((bounds[1] + bounds[3]) / 2)] : null;
}

/**
 * Pick the next gameplay action from the OBSERVED playing-state controls.
 * Family adapters: selectors (tap), ordered sequences (index order), keypad
 * (keys + submit), submit flows (select then check), passive (wait only).
 */
/**
 * Per-game TUTORIAL DEMO contracts (prompt §7.2). Guided demos validate a
 * specific answer; blind tapping never clears them. Each hint derives the
 * demo's real answer from its deterministic contract (documented per game).
 */
const TUTORIAL_DEMO_HINTS = {
  // DemoBoard targets come from seed 'memory-grid-recall-tutorial-demo-v1'
  // (components/tutorial.tsx TUTORIAL_DEMO_SEED: 2 of 9 via the game's own
  // generator): the deterministic set is [3,5]. Rebuild = tap them in order.
  'memory-grid-recall': (c) => ['cell.3', 'cell.5'].filter((k) => c[k] && c[k].bounds),
  // Colour-matching demos: tap the button whose colour matches the shown label.
  'speed-color-match': (c) => {
    const label = ((c['label'] && (c['label'].text || c['label'].desc)) || '').trim().toLowerCase();
    const match = Object.keys(c).find((k) => /^color-btn\./.test(k) && k.slice('color-btn.'.length).toLowerCase() === label);
    return match && c[match].bounds ? [match] : [];
  },
};

function chooseGameplayAction(controls, tappedThisRound) {
  const suffixes = Object.keys(controls);
  const has = (k) => controls[k] && center(controls[k].bounds);
  const feedbackUp = suffixes.some((s) => /^(round-result|round-failed|verdict|feedback)/.test(s));
  const keypadKeys = suffixes.filter((s) => /^(key|pad)[.\-]/.test(s) && controls[s].bounds);
  const selectors = suffixes.filter((s) => SELECTOR_RE.test(s) && controls[s].bounds);
  const ordered = suffixes.filter((s) => /^(sequence|order)[.\-]/.test(s) && controls[s].bounds)
    .sort((a, b) => (Number(/\d+$/.exec(a)?.[0]) || 0) - (Number(/\d+$/.exec(b)?.[0]) || 0));

  // A feedback / verdict board is up: advance the round first — poking board
  // controls under the overlay is not an answer attempt.
  if (feedbackUp) {
    const advance = ADVANCE_KEYS.find((k) => has(k));
    if (advance) return { type: 'tap', target: advance, point: center(controls[advance].bounds) };
  }
  if (keypadKeys.length) {
    // Keypad family: enter a couple of digits, then submit/check if present.
    const key = keypadKeys.find((k) => !tappedThisRound.has(k)) || keypadKeys[0];
    return { type: 'tap', target: key, point: center(controls[key].bounds) };
  }
  if (ordered.length) {
    const next = ordered.find((k) => !tappedThisRound.has(k));
    return next ? { type: 'tap', target: next, point: center(controls[next].bounds) } : null;
  }
  if (selectors.length) {
    const next = selectors.find((k) => !tappedThisRound.has(k)) || selectors[0];
    return { type: 'tap', target: next, point: center(controls[next].bounds) };
  }
  const advance = ADVANCE_KEYS.find((k) => has(k));
  if (advance) return { type: 'tap', target: advance, point: center(controls[advance].bounds) };
  return null; // passive / stimulus-driven: wait and observe instead
}

// --- per-game driver -------------------------------------------------------
async function driveGame(ctx) {
  const { serial, gameId } = ctx;
  const tap = (pt) => { if (pt) adb(serial, ['shell', 'input', 'tap', String(pt[0]), String(pt[1])], { timeout: 15000, tolerant: true }); };

  const act = async (phase, action, target, point, key) => {
    const before = ctx.observations[ctx.observations.length - 1] || null;
    if (action === 'tap' && point) tap(point);
    else if (action === 'back') adb(serial, ['shell', 'input', 'keyevent', 'KEYCODE_BACK'], { timeout: 15000, tolerant: true });
    await sleep(action === 'back' ? 1200 : 900);
    const after = observe(ctx, phase, key !== false);
    // Acknowledgment: only when the application-level state changed
    // (fingerprint delta). A successful adb process is never acceptance.
    const changed = before ? stateFingerprint(before) !== stateFingerprint(after) : true;
    return emitEvent(ctx, {
      action, target,
      actionExecuted: true,
      actionAcknowledged: before ? changed : null,
      before, after,
    });
  };

  // 0. Pre-launch observation binds the deeplink transition (an acknowledged
  //    action must reference before/after observations — contract 2.0).
  observe(ctx, 'pre-launch', true);

  // 1. Launch via deep link (identity proof comes from the observation).
  adb(serial, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `braintraining://game/${gameId}`], { timeout: 20000, tolerant: true });
  await sleep(2800);
  const launchObs = observe(ctx, 'launch', true);
  emitEvent(ctx, { action: 'deeplink', target: `braintraining://game/${gameId}`, actionExecuted: true, actionAcknowledged: launchObs.observedGameId === gameId, before: ctx.observations[ctx.observations.length - 2], after: launchObs });

  // 2. Tutorial traversal — only while the OBSERVED state is 'tutorial'.
  //    Guided demos (word-chain chains, reaction triggers, …) require DEMO
  //    INTERACTION before tutorial-done appears; tapping the demo controls is
  //    how the tutorial clears. Demo taps are never credited as gameplay input
  //    (the contract only accepts input in the observed playing state).
  const tappedInTutorial = new Set();
  for (let hop = 0; hop < 12; hop++) {
    const cur = ctx.observations[ctx.observations.length - 1];
    if (cur.state !== GameStates.TUTORIAL) break;
    const c = ctx.lastControls || parseControls(dumpHierarchy(serial), gameId);
    const nav = ['tutorial-skip', 'tutorial-done', 'tutorial-next'].find((k) => c[k] && center(c[k].bounds));
    if (nav) {
      await act(`tutorial-${hop}`, 'tap', `${gameId}.${nav}`, center(c[nav].bounds), hop === 0);
      continue;
    }
    // Demo surface: consult the game's documented demo contract first, then
    // interact with the demo's own controls generically.
    const hint = TUTORIAL_DEMO_HINTS[gameId];
    const hinted = hint ? hint(c) : [];
    const demo = hinted.length ? hinted : Object.keys(c).filter((k) =>
      c[k].bounds && k !== 'tutorial' && !/^(tutorial-title|tutorial-text|tutorial-demo-status|tutorial-skip-lip|tutorial-done-lip)$/.test(k) &&
      (SELECTOR_RE.test(k) || /^tutorial-(trigger|tile|card|slot|key|pad|button|choice|option)/.test(k)));
    const target = demo.find((k) => !tappedInTutorial.has(k)) || demo[0];
    if (target) {
      tappedInTutorial.add(target);
      await act(`tutorial-demo-${hop}`, 'tap', `${gameId}.${target}`, center(c[target].bounds), hop === 0);
    } else {
      break; // no navigable control at all — record and move on
    }
  }

  // 3. Start the game from the intro (tap is recorded; entry is PROVEN only if
  //    the next observation shows the playing state).
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = ctx.observations[ctx.observations.length - 1];
    if (cur.state !== GameStates.INTRO) break;
    const c = ctx.lastControls || parseControls(dumpHierarchy(serial), gameId);
    const pick = ['start', 'play', 'begin', 'start-game'].find((k) => c[k] && center(c[k].bounds));
    if (!pick) break;
    await act('start', 'tap', `${gameId}.${pick}`, center(c[pick].bounds), attempt === 0);
  }

  // 4. Gameplay loop — every action bound to before/after observations.
  const tappedThisRound = new Set();
  let lastRound = null;
  for (let step = 0; step < steps; step++) {
    const cur = ctx.observations[ctx.observations.length - 1];
    if (cur.state === GameStates.RESULTS) break;
    if (cur.state !== GameStates.PLAYING) { await sleep(1200); observe(ctx, `recheck-${step}`, step === 0); continue; }

    const roundControl = cur.controls.find((x) => /^round\.\d+$/.test(x));
    const roundNow = roundControl ? Number(roundControl.split('.')[1]) : null;
    if (lastRound !== null && roundNow !== null && roundNow !== lastRound) tappedThisRound.clear();
    lastRound = roundNow;

    const c = ctx.lastControls || parseControls(dumpHierarchy(serial), gameId);
    const action = chooseGameplayAction(c, tappedThisRound);
    if (!action) {
      // Passive/timed family: no input; observe for autonomous progression.
      await sleep(2500);
      observe(ctx, `passive-${step}`, step % 3 === 0);
      continue;
    }
    tappedThisRound.add(action.target);
    await act(`play-${step}`, 'tap', `${gameId}.${action.target}`, action.point, step < 4);
  }

  // 5. Terminal capture (results currency is derived from observation order).
  const terminalObs = observe(ctx, 'terminal', true);

  // 6. Safe exit — proven by the POST-Back destination observation. Exit
  //    ladder mirrors the app's real navigation: from gameplay Back opens the
  //    PAUSE overlay (observed native behaviour) whose quit control ends the
  //    session; from the intro there is intro-back; a stuck tutorial is first
  //    skipped to reach the intro. Exiting is only credited when a destination
  //    (app screen or launcher) is OBSERVED.
  for (let i = 0; i < 4; i++) {
    const cur = ctx.observations[ctx.observations.length - 1];
    if (cur.state === GameStates.EXITED || cur.state === GameStates.LAUNCHER) break;
    const c = ctx.lastControls || parseControls(dumpHierarchy(serial), gameId);
    const quitKey = c['quit'] || c['pause-quit'] || c['quit-discard'];
    const introBack = c['intro-back'];
    const skip = c['tutorial-skip'];
    if (quitKey && center(quitKey.bounds)) {
      await act('exit', 'tap', `${gameId}.quit`, center(quitKey.bounds), i === 0);
    } else if (cur.state === GameStates.INTRO && introBack && center(introBack.bounds)) {
      await act('exit', 'tap', `${gameId}.intro-back`, center(introBack.bounds), i === 0);
    } else if (cur.state === GameStates.TUTORIAL && skip && center(skip.bounds)) {
      await act('exit', 'tap', `${gameId}.tutorial-skip`, center(skip.bounds), i === 0);
    } else {
      await act('exit', 'back', 'KEYCODE_BACK', null, i === 0);
    }
    const after = ctx.observations[ctx.observations.length - 1];
    if (after.state === GameStates.EXITED || after.state === GameStates.LAUNCHER) break;
  }
  return { terminalObs };
}

// --- main ------------------------------------------------------------------
(async function main() {
  let serial;
  try { serial = resolveSerial(); } catch (e) { console.error('[sweep] ' + e.message); process.exit(3); }

  const games = [];
  for (const d of fs.readdirSync(GAMES_DIR).sort()) {
    const metaPath = path.join(GAMES_DIR, d, 'game.json');
    if (!fs.existsSync(metaPath)) continue;
    let meta;
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { continue; }
    if (!onlyGames || onlyGames.includes(meta.id)) games.push({ dir: d, meta });
  }
  if (games.length === 0) { console.error('[sweep] no games matched'); process.exit(2); }

  const identity = buildIdentity(serial);
  const device = deviceProfile(serial);
  console.log(`[sweep] adb=${ADB}\n[sweep] serial=${serial}\n[sweep] steps=${steps}`);
  console.log(`[sweep] build: git=${identity.gitSha} pkg=${identity.packageName} v=${identity.versionName} (${identity.versionCode}) apk-sha256=${identity.apkSha256}`);
  if (!identity.gitSha || !identity.apkSha256 || !identity.versionCode) {
    console.error('[sweep] REFUSING to sweep: provenance incomplete (F-080-005) — git SHA, APK hash and versionCode are all required');
    process.exit(3);
  }
  if (dryRun) {
    for (const g of games) console.log(`  would sweep ${g.meta.id} (${g.meta.name})`);
    process.exit(0);
  }

  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const runs = [];
  for (const g of games) {
    const id = g.meta.id;
    const artDir = path.join(ARTIFACT_ROOT, id);
    process.stdout.write(`[sweep] ${id} ... `);
    const attemptId = `sweep-${new Date().toISOString().replace(/[:.]/g, '')}--${id}`;
    const ctx = {
      serial, gameId: id, artDir, attemptId,
      obsSeq: 0, eventSeq: 0,
      observations: [], events: [], artifacts: [],
    };
    let record;
    try {
      await driveGame(ctx);
      record = {
        executionAttemptId: attemptId,
        evidenceSource: 'runtime',
        knownGameId: true,
        gameId: id,
        name: g.meta.name,
        category: g.meta.primaryCategory,
        hasTutorial: g.meta.hasTutorial,
        buildIdentity: identity,
        deviceProfile: device,
        startedAt: ctx.observations[0]?.timestamp || null,
        endedAt: new Date().toISOString(),
        events: ctx.events,
        observations: ctx.observations,
        artifacts: ctx.artifacts,
        resilience: null,
      };
      const c = classifyRun(record);
      record.classification = { level: c.level, status: c.status, reasons: c.reasons };
      record.remainingGap = c.level < 3
        ? `certified L${c.level} (${c.status}); full lifecycle not proven this run — ${c.reasons.join('; ')}`
        : 'lifecycle verified this run; persistence/replay/resilience are separate subcapabilities';
      console.log(`L${c.level} ${c.status} [${c.reasons.join('; ')}]`);
    } catch (err) {
      record = {
        executionAttemptId: attemptId,
        evidenceSource: 'runtime',
        knownGameId: true,
        gameId: id,
        name: g.meta.name,
        category: g.meta.primaryCategory,
        buildIdentity: identity,
        deviceProfile: device,
        startedAt: ctx.observations[0]?.timestamp || null,
        endedAt: new Date().toISOString(),
        events: ctx.events,
        observations: ctx.observations,
        artifacts: ctx.artifacts,
        classification: { level: 0, status: 'FAILED', reasons: [`sweep error: ${String(err.message || err)}`] },
        remainingGap: 'sweep error — reproduced blocker; see events/observations for the interrupted attempt',
      };
      console.log(`ERROR ${err.message}`);
    }
    runs.push(record);
  }

  const ledger = {
    schemaVersion: 2,
    contractVersion: CONTRACT_VERSION,
    generatedAt: new Date().toISOString(),
    evidenceSource: 'runtime',
    harness: 'scripts/qa/native-game-sweep.mjs (contract 2.0)',
    environment: { ...identity, ...device },
    runs,
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(ledger, null, 2));

  const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of runs) {
    const lvl = r.classification?.level ?? 0;
    dist[lvl] = (dist[lvl] || 0) + 1;
  }
  console.log('\n[sweep] DONE. Certified distribution:', JSON.stringify(dist));
  console.log('[sweep] ledger ->', outFile);
})();
