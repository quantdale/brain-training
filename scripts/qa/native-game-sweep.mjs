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
  deriveScreenKind,
  observationRequiresArtifact,
  createSha256,
  observeState,
  pickAdvanceControl,
  stateFingerprint,
} from './coverage-contract.mjs';
import { planTutorialStep, SolveTier } from './tutorial-solver.mjs';

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

const sha256 = (buf) => createSha256(buf);
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
 * Proven screen classification (P1-B). A failed/malformed `uiautomator dump`
 * used to parse to zero game controls and was emitted as
 * `non-game-app-screen`, which the contract read as EXITED — so a failed Back
 * plus a failed dump "proved" a safe exit. The harness now reports the
 * foreground window identity, the hierarchy status and process liveness
 * explicitly, and the contract derives the screen kind from those facts.
 */
function screenKindFor(serial, xml, controls, appExpectedRunning = true) {
  let hierarchyStatus = 'ok';
  if (!xml || !xml.trim()) hierarchyStatus = 'empty';
  else if (!/<node\b/.test(xml)) hierarchyStatus = 'malformed';
  const focus = currentFocus(serial);
  // Liveness is only meaningful once the app is expected to be up: an app that
  // has not been launched yet is not a crash.
  let appAlive;
  if (appExpectedRunning) {
    try {
      appAlive = !!adb(serial, ['shell', 'pidof', PACKAGE], { tolerant: true, timeout: 15000 }).trim();
    } catch { appAlive = undefined; }
  }
  return deriveScreenKind({
    expectedPackage: PACKAGE,
    focusPackage: focus || undefined,
    hierarchyStatus,
    controlCount: Object.keys(controls).length,
    appAlive,
  });
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
  const screenKind = screenKindFor(serial, xml, controls, ctx.appLaunched === true);
  // Control identity (text/desc) is captured so the causality contract can
  // attribute a change to the SPECIFIC control that was tapped (P1-A).
  const controlDetails = Object.fromEntries(suffixes.map((s) => [s, {
    text: controls[s].text || '',
    desc: controls[s].desc || '',
  }]));
  const obs = {
    seq: ctx.obsSeq++,
    phase,
    timestamp: new Date().toISOString(),
    controls: suffixes,
    screenMarkers: screenMarkersFor(serial, controls),
    screenKind,
    controlDetails,
    observedGameId: suffixes.length ? gameId : null,
    score: scoreControl ? (scoreControl.text || scoreControl.desc || null) : null,
    boardValues,
    evidenceArtifact: null,
    requireArtifact: false,
  };
  // Cache the parsed inventory (with bounds) so the driving loops can act
  // WITHOUT re-dumping the hierarchy — on this emulator a dump costs ~3-4s
  // against 9-10s game timers, and a duplicate dump per step made rounds time
  // out before any tap landed (the v1 bottleneck class).
  ctx.lastControls = controls;
  obs.state = observeState({ ...obs, gameId }).state;
  // P1-C artifact policy: certification-critical observations MUST be bound to
  // a real artifact. `requireArtifact` is now genuinely set by the real sweep.
  obs.requireArtifact = observationRequiresArtifact(obs);
  if (key || obs.requireArtifact) {
    const pngPath = path.join(artDir, `obs-${String(obs.seq).padStart(2, '0')}-${phase}.png`);
    try {
      const buf = execFileSync(ADB, ['-s', serial, 'exec-out', 'screencap', '-p'], {
        encoding: 'buffer', timeout: 30000, windowsHide: true, maxBuffer: 32 * 1024 * 1024,
      });
      fs.mkdirSync(artDir, { recursive: true });
      fs.writeFileSync(pngPath, buf);
      const rel = path.relative(REPO_ROOT, pngPath).replace(/\\/g, '/');
      const art = {
        file: rel, bytes: buf.length, sha256: sha256(buf), sha1: sha1(buf),
        kind: 'screenshot', executionAttemptId: ctx.attemptId,
      };
      ctx.artifacts.push(art);
      obs.evidenceArtifact = { ...art };
    } catch { /* screenshot failure stays visible as evidenceArtifact: null */ }
    const xmlPath = path.join(artDir, `obs-${String(obs.seq).padStart(2, '0')}-${phase}.xml`);
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(xmlPath, xml);
    const relXml = path.relative(REPO_ROOT, xmlPath).replace(/\\/g, '/');
    const xmlArt = {
      file: relXml, bytes: Buffer.byteLength(xml), sha256: sha256(Buffer.from(xml)),
      sha1: sha1(Buffer.from(xml)), kind: 'hierarchy', executionAttemptId: ctx.attemptId,
    };
    ctx.artifacts.push(xmlArt);
    if (!obs.evidenceArtifact) obs.evidenceArtifact = { ...xmlArt };
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

/**
 * Advance/confirm control policy lives in the coverage contract so it is
 * unit-tested (see coverage-contract.mjs `pickAdvanceControl`). The local
 * literal list this replaces caused a confirmed math-fast-math false
 * negative: `next-problem` was not recognised, the loop stalled on the
 * feedback overlay and never tapped again.
 */
function center(bounds) {
  return bounds ? [Math.round((bounds[0] + bounds[2]) / 2), Math.round((bounds[1] + bounds[3]) / 2)] : null;
}

/**
 * Pick the next gameplay action from the OBSERVED playing-state controls.
 * Family adapters: selectors (tap), ordered sequences (index order), keypad
 * (keys + submit), submit flows (select then check), passive (wait only).
 */
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
    // Pattern-based, so `next-problem`/`next-trial`/`submit-estimate` are
    // recognised instead of silently stalling the loop (see ADVANCE_RE).
    const advance = pickAdvanceControl(controls);
    if (advance && has(advance)) {
      return { type: 'tap', target: advance, point: center(controls[advance].bounds) };
    }
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
  const advance = pickAdvanceControl(controls);
  if (advance && has(advance)) {
    return { type: 'tap', target: advance, point: center(controls[advance].bounds) };
  }
  return null; // passive / stimulus-driven: wait and observe instead
}

// --- per-game driver -------------------------------------------------------
async function driveGame(ctx) {
  const { serial, gameId } = ctx;
  // P1-B / review Q11: the command result is reported truthfully. Previously
  // `actionExecuted: true` was emitted unconditionally while the adb call ran
  // with `tolerant: true`, so a FAILED input was recorded as executed. A
  // command that never executed can never prove anything.
  const tap = (pt) => {
    if (!pt) return false;
    try {
      adb(serial, ['shell', 'input', 'tap', String(pt[0]), String(pt[1])], { timeout: 15000 });
      return true;
    } catch { return false; }
  };
  const pressBack = () => {
    try {
      adb(serial, ['shell', 'input', 'keyevent', 'KEYCODE_BACK'], { timeout: 15000 });
      return true;
    } catch { return false; }
  };

  const act = async (phase, action, target, point, key) => {
    const before = ctx.observations[ctx.observations.length - 1] || null;
    let executed = false;
    if (action === 'tap' && point) executed = tap(point);
    else if (action === 'back') executed = pressBack();
    else if (action === 'wait') executed = true;
    await sleep(action === 'back' ? 1200 : 900);
    const after = observe(ctx, phase, key !== false);
    // Acknowledgment: only when the application-level state changed
    // (fingerprint delta). A successful adb process is never acceptance.
    const changed = before ? stateFingerprint(before) !== stateFingerprint(after) : true;
    return emitEvent(ctx, {
      action, target,
      actionExecuted: executed,
      actionAcknowledged: executed ? (before ? changed : null) : false,
      before, after,
    });
  };

  // 0. Pre-launch observation binds the deeplink transition (an acknowledged
  //    action must reference before/after observations — contract 2.0). The app
  //    is not expected to be running yet, so absence here is NOT a crash.
  observe(ctx, 'pre-launch', true);

  // 1. Launch via deep link (identity proof comes from the observation).
  adb(serial, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `braintraining://game/${gameId}`], { timeout: 20000, tolerant: true });
  ctx.appLaunched = true;
  await sleep(2800);
  const launchObs = observe(ctx, 'launch', true);
  emitEvent(ctx, { action: 'deeplink', target: `braintraining://game/${gameId}`, actionExecuted: true, actionAcknowledged: launchObs.observedGameId === gameId, before: ctx.observations[ctx.observations.length - 2], after: launchObs });

  // 2. Tutorial traversal — only while the OBSERVED state is 'tutorial'.
  //
  //    Wave D replaced a generic blind-tap loop with the deterministic family
  //    solvers in scripts/qa/tutorial-solver.mjs. That matters because a guided,
  //    answer-driven demo validates a SPECIFIC answer: blind tapping cannot
  //    clear one, which is why 24 games previously stalled at L0. The solver
  //    proposes ONE step at a time with a stated reason and a solve TIER, and
  //    the harness still has to PROVE every transition — a plan is a proposal,
  //    never a certification.
  //
  //    Demo interaction is never credited as gameplay input: the contract only
  //    accepts input in the observed 'playing' state, so a solved tutorial can
  //    never inflate the gameplay axes. The tutorial-derived tier is recorded
  //    on the run so a reveal-guided clear is never described as
  //    knowledge-derived play.
  const tappedInTutorial = new Set();
  const tutorialSolveLog = [];
  let enteredDigits = '';
  let equationStaged = [];
  let lastTutorialTarget = null;
  for (let hop = 0; hop < 24; hop++) {
    const cur = ctx.observations[ctx.observations.length - 1];
    if (cur.state !== GameStates.TUTORIAL) break;
    const c = ctx.lastControls || parseControls(dumpHierarchy(serial), gameId);

    // Build the solver's view of the CURRENT observation from the parsed
    // control inventory (the same shape the recorded ledger uses).
    const obsView = {
      gameId,
      phase: `tutorial-${hop}`,
      controls: Object.keys(c),
      controlDetails: Object.fromEntries(Object.keys(c).map((k) => [k, {
        text: c[k].text || '',
        desc: c[k].desc || '',
      }])),
      boardValues: [],
    };
    const plan = planTutorialStep(obsView, {
      gameId,
      tapped: tappedInTutorial,
      enteredDigits,
      equation: equationStaged,
      lastTapped: lastTutorialTarget,
    });

    if (!plan) {
      // No legitimate step exists. Record the gap honestly instead of tapping
      // blindly — a blind tap here would be exactly the falsification the
      // certification contract exists to prevent.
      tutorialSolveLog.push({ hop, outcome: 'NO_LEGITIMATE_STEP', remaining: Object.keys(c).length });
      break;
    }

    // The solver may name a control that the parsed inventory has under a
    // different key form; resolve it before tapping.
    const key = c[plan.target] ? plan.target : Object.keys(c).find((k) => k === plan.target || k.endsWith(`.${plan.target}`));
    if (!key || !center(c[key].bounds)) {
      tutorialSolveLog.push({ hop, outcome: 'TARGET_NOT_TAPPABLE', target: plan.target });
      break;
    }

    tutorialSolveLog.push({
      hop,
      target: key,
      tier: plan.tier,
      reason: plan.reason,
    });
    tappedInTutorial.add(plan.target);
    tappedInTutorial.add(key);
    lastTutorialTarget = key;
    if (/^digit\.\d$/.test(key)) enteredDigits += key.slice('digit.'.length);
    if (key === 'submit') enteredDigits = '';
    if (/^color\.\d$/.test(key)) equationStaged = [...equationStaged, key];
    if (key === 'tutorial-submit') equationStaged = [];

    await act(`tutorial-demo-${hop}`, 'tap', `${gameId}.${key}`, center(c[key].bounds), hop === 0);
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
  // Wave D: the tutorial solve trail is persisted on the run. It records every
  // proposed step WITH its solve tier, so an auditor can distinguish a
  // knowledge-derived clear (DERIVED) from a reveal-guided one
  // (REVEAL_GUIDED) — and can see exactly where a demo defeated automation.
  ctx.tutorialSolveLog = tutorialSolveLog;
  return { terminalObs };
}

/**
 * Summarise a tutorial solve trail for the run record.
 *
 * The tier counts are deliberately NOT combined: a `derivedSteps` count means
 * the harness computed the answer, while `revealGuidedSteps` means the app
 * showed it. Reporting a single "solved" number would let a reveal-guided clear
 * be read as knowledge-derived play.
 */
function summariseTutorialSolve(log) {
  const entries = Array.isArray(log) ? log : [];
  const steps = entries.filter((e) => e && e.tier !== undefined);
  const stalled = entries.find((e) => e && e.outcome && e.outcome !== undefined && e.tier === undefined) || null;
  return {
    attempted: steps.length > 0 || stalled !== null,
    steps: steps.length,
    derivedSteps: steps.filter((e) => e.tier === SolveTier.DERIVED).length,
    revealGuidedSteps: steps.filter((e) => e.tier === SolveTier.REVEAL_GUIDED).length,
    // The last step taken, so a reader sees WHAT cleared the demo.
    last: steps.length ? steps[steps.length - 1] : null,
    // Where automation gave up, if it did. This is an automation gap to fix,
    // never an app defect to assume.
    blocked: stalled ? stalled.outcome : null,
    trail: entries,
  };
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
        // Wave D tutorial-solver trail (see driveGame step 2). Empty for a
        // returning player whose tutorial does not appear this attempt.
        tutorialSolve: summariseTutorialSolve(ctx.tutorialSolveLog),
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
