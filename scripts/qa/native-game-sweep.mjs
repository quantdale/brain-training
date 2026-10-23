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
import { createRequire } from 'node:module';
import { loadBuildManifest } from './artifact-integrity.mjs';
import {
  CONTRACT_VERSION,
  GameStates,
  classifyRun,
  deriveScreenKind,
  observationRequiresArtifact,
  createSha256,
  isIsoTimestamp,
  observeState,
  stateFingerprint,
} from './coverage-contract.mjs';
import { gameMetadata } from './gameplay-policy.mjs';
import { planTutorialStep, SolveTier } from './tutorial-solver.mjs';
import { center, chooseGameplayAction } from './gameplay-actions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const requireFromMobile = createRequire(path.join(REPO_ROOT, 'apps/mobile/package.json'));
const { SaxesParser } = requireFromMobile('saxes');
const BetterSqlite3 = requireFromMobile('better-sqlite3');
const IS_MAIN = !!process.argv[1] && path.resolve(process.argv[1]) === __filename;
const GAMES_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'games');
const DEFAULT_OUT = path.join(REPO_ROOT, 'scripts', 'qa', 'native-coverage-ledger.json');
/**
 * Artifact root — ONE DIRECTORY PER SWEEP RUN.
 *
 * This was a fixed path (`sweep-v2`), so every subsequent sweep overwrote the
 * previous sweep's screenshots and hierarchies while the older ledgers still
 * recorded the ORIGINAL digests for those paths. The independent verifier
 * caught it exactly as designed: 18 hash + byte-length mismatches on a second
 * sweep, i.e. ledgers whose cited evidence had been replaced by different bytes.
 *
 * That is precisely the "evidence reuse between execution attempts must be
 * detected" and "a screenshot must not be accepted because its filename
 * resembles the expected artifact" failure class, and it would silently
 * invalidate any coverage claim built on a superseded run.
 *
 * Each run therefore gets a unique directory keyed by the sweep's start time, so
 * evidence for one attempt can never be clobbered by another. Historical
 * evidence is preserved rather than rewritten.
 */
function makeArtifactRoot() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '').replace('Z', 'Z');
  return path.join(REPO_ROOT, 'qa-artifacts', '080', 'sweeps', stamp);
}
const ARTIFACT_ROOT = makeArtifactRoot();
const PACKAGE = 'com.braintraining.app';

// --- args ------------------------------------------------------------------
function usage() {
  console.log('usage: native-game-sweep.mjs [--games a,b,c] [--out FILE] [--serial S] [--steps N] [--dry-run] [--capture-receipts FILE] [--build-manifest FILE]');
}
const argv = IS_MAIN ? process.argv.slice(2) : [];
let onlyGames = null;
let outFile = DEFAULT_OUT;
let serialOverride = null;
let steps = 12;
let dryRun = false;
let captureReceiptsFile = null;
let buildManifestFile = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--games') onlyGames = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
  else if (a === '--out') outFile = path.resolve(argv[++i] || DEFAULT_OUT);
  else if (a === '--capture-receipts') captureReceiptsFile = path.resolve(argv[++i]);
  else if (a === '--build-manifest') {
    const file = argv[++i];
    if (!file || file.startsWith('-')) { console.error('--build-manifest requires a path'); usage(); process.exit(2); }
    buildManifestFile = path.resolve(file);
  }
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
const ADB = IS_MAIN ? findAdb() : null;

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

function adbBuffer(serial, sub, opts = {}) {
  const argv2 = serial ? ['-s', serial, ...sub] : sub;
  return execFileSync(ADB, argv2, {
    encoding: null, timeout: opts.timeout || 30000,
    maxBuffer: 32 * 1024 * 1024, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
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

/** Read the app's persisted tutorial fact without changing device state. */
export function tutorialStateFromPersistedRow(row) {
  if (row == null) {
    return { previouslyCompleted: false, completed: false, replayRequested: false, version: null, source: 'tutorial_state' };
  }
  if (![0, 1].includes(row.completed) || ![0, 1].includes(row.replay_requested) ||
      (row.version !== null && typeof row.version !== 'string')) return null;
  const completed = row.completed === 1;
  const replayRequested = row.replay_requested === 1;
  // The SDK's createTutorialLifecycle default is 1.0.0; a replay request,
  // incomplete row or different version means the current tutorial is due.
  return {
    previouslyCompleted: completed && !replayRequested && row.version === '1.0.0',
    completed, replayRequested, version: row.version, source: 'tutorial_state',
  };
}

/** Query a read-only local copy of the SQLite database and its WAL sidecar. */
export const TUTORIAL_STATE_QUERY = 'SELECT game_id, completed, replay_requested, version, updated_at FROM tutorial_state WHERE game_id = ?';

/** Run the exact read-only tutorial_state query against a copied SQLite snapshot. */
export function queryTutorialStateFromDatabaseBytes(databaseBytes, walBytes, gameId, tempRoot = os.tmpdir()) {
  if (!Buffer.isBuffer(databaseBytes) || !gameId || typeof gameId !== 'string') return null;
  const dir = fs.mkdtempSync(path.join(tempRoot, 'bt080-tutorial-state-'));
  const databaseFile = path.join(dir, 'brain-training.db');
  let db;
  try {
    fs.writeFileSync(databaseFile, databaseBytes);
    if (Buffer.isBuffer(walBytes) && walBytes.length > 0) fs.writeFileSync(`${databaseFile}-wal`, walBytes);
    db = new BetterSqlite3(databaseFile, { timeout: 2500 });
    const row = db.prepare(TUTORIAL_STATE_QUERY).get(gameId) ?? null;
    if (row !== null && (row.game_id !== gameId || ![0, 1].includes(row.completed) ||
        ![0, 1].includes(row.replay_requested) || (row.version !== null && typeof row.version !== 'string') ||
        !Number.isSafeInteger(row.updated_at))) return null;
    return { table: 'tutorial_state', columns: ['game_id', 'completed', 'replay_requested', 'version', 'updated_at'], where: { game_id: gameId }, row };
  } catch {
    return null;
  } finally {
    try { db?.close(); } catch { /* best-effort close of disposable read copy */ }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* disposable temp cleanup must not invent tutorial facts */ }
  }
}

export function readTutorialStateFromDatabaseBytes(databaseBytes, walBytes, gameId, tempRoot = os.tmpdir()) {
  const query = queryTutorialStateFromDatabaseBytes(databaseBytes, walBytes, gameId, tempRoot);
  return query ? tutorialStateFromPersistedRow(query.row) : null;
}

export function tutorialDatabaseReadCommand(uid, debuggable, fileName) {
  if (String(uid).trim() === '0') return ['exec-out', 'cat', `/data/user/0/${PACKAGE}/files/SQLite/${fileName}`];
  if (debuggable === true) return ['exec-out', 'run-as', PACKAGE, 'cat', `files/SQLite/${fileName}`];
  return null;
}

function persistedTutorialState(serial, gameId, ctx) {
  try {
    const uid = adb(serial, ['shell', 'id', '-u'], { tolerant: true }).trim();
    const packageInfo = adb(serial, ['shell', 'dumpsys', 'package', PACKAGE], { tolerant: true, timeout: 30000 });
    const debuggable = /\bDEBUGGABLE\b/.test(packageInfo);
    const dbCommand = tutorialDatabaseReadCommand(uid, debuggable, 'brain-training.db');
    if (!dbCommand) return null;
    const db = adbBuffer(serial, dbCommand);
    let wal = null;
    try { wal = adbBuffer(serial, tutorialDatabaseReadCommand(uid, debuggable, 'brain-training.db-wal')); } catch { /* no WAL is a valid checkpointed database */ }
    const query = queryTutorialStateFromDatabaseBytes(db, wal, gameId);
    if (!query) return null;
    const observationTimestamp = new Date().toISOString();
    const evidence = {
      schemaVersion: 1,
      executionAttemptId: ctx.attemptId,
      gameId,
      observationSeq: 0,
      observationTimestamp,
      capturedAt: observationTimestamp,
      query: { ...query, sql: TUTORIAL_STATE_QUERY },
    };
    const file = path.join(ctx.artDir, 'tutorial-state.json');
    fs.mkdirSync(ctx.artDir, { recursive: true });
    const bytes = Buffer.from(JSON.stringify(evidence, null, 2));
    fs.writeFileSync(file, bytes);
    const artifact = captureArtifact(ctx, file, bytes, 'tutorial-state', {
      seq: evidence.observationSeq, timestamp: evidence.observationTimestamp,
    });
    ctx.artifacts.push(artifact);
    evidence.artifact = artifact;
    return evidence;
  } catch {
    // A failed read is UNKNOWN, never an invented completed tutorial.
    return null;
  }
}
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
  return { gitSha: null, packageName: PACKAGE, versionName, versionCode: versionCode ? Number(versionCode) : null, apkSha256, installedApkPath: pkgPath };
}

export function bindBuildIdentityToManifest(installedIdentity, manifest) {
  if (!manifest || !/^[a-f0-9]{40}$/i.test(manifest.sourceSha || '')
      || !/^[a-f0-9]{64}$/i.test(manifest.apkSha256 || '')) throw new Error('validated source/APK build manifest is required');
  if (String(installedIdentity?.apkSha256 || '').toLowerCase() !== manifest.apkSha256.toLowerCase()) {
    throw new Error('installed APK digest does not match the build manifest');
  }
  return { ...installedIdentity, gitSha: manifest.sourceSha.toLowerCase(), apkSha256: manifest.apkSha256.toLowerCase() };
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
export function hierarchyStatus(xml) {
  if (typeof xml !== 'string' || !xml.trim()) return 'empty';
  let root = null;
  let depth = 0;
  let nodes = 0;
  let invalid = false;
  const parser = new SaxesParser();
  parser.on('error', () => { invalid = true; });
  parser.on('doctype', () => { invalid = true; });
  parser.on('opentag', (tag) => {
    if (depth++ === 0) root = tag.name;
    if (tag.name === 'node') nodes++;
  });
  parser.on('closetag', () => { depth--; });
  try { parser.write(xml).close(); } catch { invalid = true; }
  return invalid || root !== 'hierarchy' || depth !== 0 ? 'malformed' : nodes ? 'ok' : 'empty';
}

export function dumpHierarchy(serial, run = adb) {
  const remote = '/sdcard/bt-sweep-dump.xml';
  try {
    // Never let a failed dump read the PREVIOUS capture. Every acquisition
    // invalidates the remote path and all three commands must succeed.
    run(serial, ['shell', 'rm', '-f', remote], { timeout: 15000 });
    run(serial, ['shell', 'uiautomator', 'dump', remote], { timeout: 60000 });
    return run(serial, ['shell', 'cat', remote], { timeout: 30000 }) || '';
  } catch { return ''; }
}

export function parseHierarchyGameData(xml, expectedGameId) {
  const controls = {};
  const hierarchyControlIds = [];
  const nodeRe = /<node\b[^>]*>/g;
  let m;
  while ((m = nodeRe.exec(xml))) {
    const tag = m[0];
    const rid = /resource-id="([^"]*)"/.exec(tag)?.[1] || '';
    if (!rid) continue;
    hierarchyControlIds.push(rid);
    const candidateGameId = rid === expectedGameId || rid.startsWith(`${expectedGameId}.`)
      ? expectedGameId
      : rid.slice(0, rid.indexOf('.'));
    if (candidateGameId !== expectedGameId || !gameMetadata(candidateGameId)) continue;
    const suffix = rid === candidateGameId ? 'screen' : rid.slice(candidateGameId.length + 1);
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tag);
    controls[suffix] = {
      bounds: bounds ? [+bounds[1], +bounds[2], +bounds[3], +bounds[4]] : null,
      text: /text="([^"]*)"/.exec(tag)?.[1] || '',
      desc: /content-desc="([^"]*)"/.exec(tag)?.[1] || '',
    };
  }
  const observedGameIds = new Set(hierarchyControlIds.flatMap((resourceId) => {
    const dot = resourceId.indexOf('.');
    const gameId = dot < 0 ? resourceId : resourceId.slice(0, dot);
    return gameMetadata(gameId) ? [gameId] : [];
  }));
  return {
    controls,
    hierarchyControlIds,
    observedGameId: observedGameIds.size === 1 ? [...observedGameIds][0] : null,
  };
}

function currentFocus(serial) {
  const out = adb(serial, ['shell', 'dumpsys', 'window'], { tolerant: true, timeout: 20000 });
  const line = /mCurrentFocus=Window\{[^}]*\s([^\s}]+)/.exec(out) || /mResumedActivity: ActivityInfo\{[^}]*\s([^\s/}]+)/.exec(out);
  return line ? line[1] : '';
}

function rawScreenFor(serial, xml, appExpectedRunning = true) {
  return {
    expectedPackage: PACKAGE,
    focusPackage: currentFocus(serial) || undefined,
    hierarchyStatus: hierarchyStatus(xml),
    appAlive: appExpectedRunning
      ? !!adb(serial, ['shell', 'pidof', PACKAGE], { tolerant: true, timeout: 15000 }).trim()
      : undefined,
  };
}

/** Write a receipt only for bytes actually acquired by this attempt. The
 * independent index is accumulated at acquisition, never reconstructed from
 * the ledger's claims. Static frames may legitimately have identical pixels. */
export function captureArtifact(ctx, file, bytes, kind, observation) {
  if (!Buffer.isBuffer(bytes) || !fs.existsSync(file)) throw new Error('capture receipt requires acquired artifact bytes on disk');
  if (!observation || !Number.isSafeInteger(observation.seq) || !isIsoTimestamp(observation.timestamp)) {
    throw new Error('capture receipt requires its source observation sequence and strict timestamp');
  }
  const digest = sha256(bytes);
  if (sha256(fs.readFileSync(file)) !== digest) throw new Error('captured artifact bytes differ from the acquired file');
  const capturedAt = new Date().toISOString();
  if (Date.parse(capturedAt) < Date.parse(observation.timestamp)) {
    throw new Error('capture receipt predates its bound observation');
  }
  const receipt = {
    schemaVersion: 1, captureId: crypto.randomUUID(),
    executionAttemptId: ctx.attemptId, artifactSha256: digest,
    artifactFile: path.relative(REPO_ROOT, file).split(path.sep).join('/'), artifactKind: kind,
    observationSeq: observation.seq, observationTimestamp: observation.timestamp,
    capturedAt,
    gitSha: ctx.buildIdentity.gitSha, apkSha256: ctx.buildIdentity.apkSha256,
  };
  if (!isIsoTimestamp(receipt.capturedAt)) throw new Error('capture receipt timestamp is invalid');
  const receiptFile = `${file}.capture.json`;
  const receiptBytes = Buffer.from(JSON.stringify(receipt, null, 2));
  fs.writeFileSync(receiptFile, receiptBytes);
  const ref = { file: path.relative(REPO_ROOT, receiptFile).split(path.sep).join('/'), sha256: sha256(receiptBytes) };
  if (!Array.isArray(ctx.captureReceipts)) ctx.captureReceipts = [];
  if (ctx.captureReceipts.some((existing) => existing.file === ref.file)) throw new Error(`duplicate capture receipt path: ${ref.file}`);
  ctx.captureReceipts.push(ref);
  return {
    file: path.relative(REPO_ROOT, file).split(path.sep).join('/'), bytes: bytes.length,
    sha256: digest, sha1: sha1(bytes), kind,
    executionAttemptId: ctx.attemptId, observationSeq: observation.seq,
    observationTimestamp: observation.timestamp, captureReceipt: ref,
  };
}

/** The sidecar index is the independent acquisition boundary, not proof by itself. */
export function writeCaptureReceiptIndex(file, refs) {
  const unique = new Set();
  for (const ref of refs) {
    if (!ref || typeof ref.file !== 'string' || !ref.file || !/^[a-f0-9]{64}$/i.test(ref.sha256 || '')) {
      throw new Error('capture receipt index contains an invalid file/hash reference');
    }
    if (path.isAbsolute(ref.file) || ref.file.split(/[\\/]/).includes('..')) throw new Error('capture receipt index paths must be repo-relative');
    if (unique.has(ref.file)) throw new Error(`duplicate capture receipt index path: ${ref.file}`);
    unique.add(ref.file);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, receipts: refs.map(({ file: receiptFile, sha256: digest }) => ({ file: receiptFile, sha256: digest })) }, null, 2));
}

/**
 * Take one observation. `key` decides whether the full evidence bundle
 * (screenshot + hierarchy dump) is stored; the parsed control inventory,
 * score and board values are captured for EVERY observation either way.
 */
function observe(ctx, phase, key) {
  const { serial, gameId, artDir } = ctx;
  const xml = dumpHierarchy(serial);
  const rawScreen = rawScreenFor(serial, xml, ctx.appLaunched === true);
  const parsed = rawScreen.hierarchyStatus === 'ok'
    ? parseHierarchyGameData(xml, gameId)
    : { controls: {}, hierarchyControlIds: [], observedGameId: null };
  const controls = parsed.controls;
  const suffixes = Object.keys(controls).sort();
  const scoreControlId = ['score-final', 'score-live', 'score'].find((id) => controls[id]);
  const scoreControl = scoreControlId ? controls[scoreControlId] : null;
  const boardValues = suffixes
    .filter((s) => /(tile|card|option|word|choice|cell|item|node|target-card|number|symbol|token|chip|key|display|board|sequence|status|problem|text|answer|label|prompt)(\.\d+)?$/.test(s))
    .map((s) => `${s}=${controls[s].text || controls[s].desc || ''}`);
  const screenKind = deriveScreenKind({ ...rawScreen, controlCount: suffixes.length });
  // Control identity (text/desc) is captured so the causality contract can
  // attribute a change to the SPECIFIC control that was tapped (P1-A).
  const controlDetails = Object.fromEntries(suffixes.map((s) => [s, {
    text: controls[s].text || '',
    desc: controls[s].desc || '',
  }]));
  const obs = {
    seq: ctx.obsSeq++,
    executionAttemptId: ctx.attemptId,
    phase,
    timestamp: new Date().toISOString(),
    controls: suffixes,
    hierarchyControlIds: parsed.hierarchyControlIds,
    screenMarkers: [],
    rawScreen,
    screenKind,
    controlDetails,
    observedGameId: parsed.observedGameId,
    score: scoreControl ? (scoreControl.text || scoreControl.desc || null) : null,
    scoreControlId: scoreControl ? scoreControlId : null,
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
      const art = captureArtifact(ctx, pngPath, buf, 'screenshot', { seq: obs.seq, timestamp: obs.timestamp });
      ctx.artifacts.push(art);
      obs.evidenceArtifact = { ...art };
    } catch { /* screenshot failure stays visible as evidenceArtifact: null */ }
    if (rawScreen.hierarchyStatus === 'ok') {
      const xmlPath = path.join(artDir, `obs-${String(obs.seq).padStart(2, '0')}-${phase}.xml`);
      fs.mkdirSync(artDir, { recursive: true });
      fs.writeFileSync(xmlPath, xml);
      const xmlArt = captureArtifact(ctx, xmlPath, Buffer.from(xml), 'hierarchy', { seq: obs.seq, timestamp: obs.timestamp });
      ctx.artifacts.push(xmlArt);
      obs.hierarchyArtifact = { ...xmlArt };
      if (!obs.evidenceArtifact) obs.evidenceArtifact = { ...xmlArt };
    }
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
    actionExecuted: e.actionExecuted === true,
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
// The answer-surface family policy now lives in gameplay-actions.mjs so the
// workout driver and any future harness share ONE action selector. The old
// private copy that lived here is what let a stale advance-control list
// stall a leg (math-fast-math false negative), so there is exactly one site
// to extend when a game's control vocabulary grows.

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
  //
  // Launch is RETRIED, and its result is reported truthfully. A single tolerant
  // `am start` was not enough: when the previous game's activity was still
  // tearing down, the intent was delivered to a dying instance and the run
  // captured `launch:exited` / `launch:launcher` for the whole attempt. That
  // surfaced as `L0 FAILED no trustworthy native smoke evidence` — a FALSE
  // app-quality signal (an app defect is not indicated by a missed deep link
  // while a previous activity is still finishing). Two games were mis-reported
  // this way in one sweep and verified healthy on a re-run, so the harness now
  // waits for the app to settle, retries the intent, and records honestly
  // whether the launch actually executed.
  let launchExecuted = false;
  let launchObs = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(2500);
    try {
      adb(serial, ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `braintraining://game/${gameId}`], { timeout: 20000 });
      launchExecuted = true;
    } catch {
      launchExecuted = false;
    }
    ctx.appLaunched = true;
    await sleep(attempt === 0 ? 2800 : 3500);
    launchObs = observe(ctx, `launch${attempt === 0 ? '' : `-retry-${attempt}`}`, true);
    // The deep link landed when the game's own screen is observed. Anything
    // else (launcher / exited) means the intent did not take effect yet.
    if (launchObs.state === GameStates.TUTORIAL || launchObs.state === GameStates.INTRO ||
        launchObs.state === GameStates.PLAYING || launchObs.state === GameStates.RESULTS) break;
  }
  emitEvent(ctx, { action: 'deeplink', target: `braintraining://game/${gameId}`, actionExecuted: launchExecuted, actionAcknowledged: launchObs.observedGameId === gameId, before: ctx.observations[ctx.observations.length - 2], after: launchObs });

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
  const tutorialKnownCorrect = new Set();
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
      // Retry at most once per demo: taking it twice in a row means the demo is
      // not clearing for a reason the harness should report, not spin on.
      retriedThisDemo: tutorialSolveLog.some((e) => e && /^tutorial-(demo-)?retry$/.test(e.target || '')),
      // Accumulated across the whole tutorial attempt so knowledge survives a
      // board reset (the app clears selections but does not re-reveal targets).
      knownCorrect: tutorialKnownCorrect,
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
    // A demo that RESETS its board on "Clear and retry" requires the harness to
    // reset its own used-control set; otherwise every cell looks already-used
    // after one retry and the demo can never be re-attempted.
    if (plan.knownCorrect) {
      for (const k of plan.knownCorrect) tutorialKnownCorrect.add(k);
    }
    if (plan.resetsTapped) {
      // Clear only the USED set: learned targets are retained separately.
      tappedInTutorial.clear();
      enteredDigits = '';
      equationStaged = [];
    } else {
      tappedInTutorial.add(plan.target);
      tappedInTutorial.add(key);
    }
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
    // Pure advancement steps (acknowledging a demo the app marked complete, or
    // continuing past a notice). Counted separately: no answer was solved.
    navigationSteps: steps.filter((e) => e.tier === SolveTier.NAVIGATION).length,
    // The last step taken, so a reader sees WHAT cleared the demo.
    last: steps.length ? steps[steps.length - 1] : null,
    // Where automation gave up, if it did. This is an automation gap to fix,
    // never an app defect to assume.
    blocked: stalled ? stalled.outcome : null,
    trail: entries,
  };
}

// --- main ------------------------------------------------------------------
export async function main() {
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

  let buildManifest = null;
  if (buildManifestFile) {
    try { buildManifest = loadBuildManifest(buildManifestFile, REPO_ROOT); }
    catch (error) { console.error(`[sweep] REFUSING to sweep: ${error.message}`); process.exit(3); }
  }
  if (!buildManifest && !dryRun) {
    console.error('[sweep] REFUSING to sweep: --build-manifest is required to bind the installed APK to the packaged source inputs');
    process.exit(3);
  }
  let identity = buildIdentity(serial);
  if (buildManifest) {
    try { identity = bindBuildIdentityToManifest(identity, buildManifest); }
    catch (error) { console.error(`[sweep] REFUSING to sweep: ${error.message}`); process.exit(3); }
  }
  const harnessGitSha = gitSha();
  const device = deviceProfile(serial);
  console.log(`[sweep] adb=${ADB}\n[sweep] serial=${serial}\n[sweep] steps=${steps}`);
  console.log(`[sweep] build: source=${identity.gitSha || '(dry-run unbound)'} apk-sha256=${identity.apkSha256 || '(unavailable)'} harness=${harnessGitSha || '(unknown)'}`);
  if (dryRun) {
    for (const g of games) console.log(`  would sweep ${g.meta.id} (${g.meta.name})`);
    process.exit(0);
  }
  if (!identity.gitSha || !identity.apkSha256 || !identity.versionCode) {
    console.error('[sweep] REFUSING to sweep: provenance incomplete (F-080-005) — manifest source SHA, installed APK hash and versionCode are required');
    process.exit(3);
  }

  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const runs = [];
  const captureReceipts = [];
  captureReceiptsFile ||= `${outFile}.capture-receipts.json`;
  for (const g of games) {
    const id = g.meta.id;
    const artDir = path.join(ARTIFACT_ROOT, id);
    process.stdout.write(`[sweep] ${id} ... `);
    const attemptId = `sweep-${new Date().toISOString().replace(/[:.]/g, '')}--${id}`;
    const ctx = {
      serial, gameId: id, artDir, attemptId, buildIdentity: identity, captureReceipts,
      startedAt: new Date().toISOString(), obsSeq: g.meta.hasTutorial === true ? 1 : 0, eventSeq: 0,
      observations: [], events: [], artifacts: [], tutorialStateEvidence: null,
    };
    if (g.meta.hasTutorial === true) ctx.tutorialStateEvidence = persistedTutorialState(serial, id, ctx);
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
        tutorialStateEvidence: ctx.tutorialStateEvidence,
        buildIdentity: identity,
        deviceProfile: device,
        startedAt: ctx.startedAt,
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
        hasTutorial: g.meta.hasTutorial,
        tutorialStateEvidence: ctx.tutorialStateEvidence,
        buildIdentity: identity,
        deviceProfile: device,
        startedAt: ctx.startedAt,
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
    harness: 'scripts/qa/native-game-sweep.mjs (contract 2.1)',
    harnessGitSha,
    buildManifest: buildManifest ? { manifestSha256: buildManifest.manifestSha256, inputCount: buildManifest.inputCount } : null,
    environment: { ...identity, ...device },
    runs,
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(ledger, null, 2));

  writeCaptureReceiptIndex(captureReceiptsFile, captureReceipts);

  const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of runs) {
    const lvl = r.classification?.level ?? 0;
    dist[lvl] = (dist[lvl] || 0) + 1;
  }
  console.log('\n[sweep] DONE. Certified distribution:', JSON.stringify(dist));
  console.log('[sweep] ledger ->', outFile);
}

if (IS_MAIN) await main();
