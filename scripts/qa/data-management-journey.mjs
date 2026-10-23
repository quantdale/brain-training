#!/usr/bin/env node
/**
 * data-management-journey.mjs — Campaign 080 Phase D: native backup/restore
 * qualification on the controlled emulator (isolated synthetic QA profile).
 *
 * Journey:
 *   baseline (DB + full app-data anchor) -> data-management screen -> export
 *   -> backup envelope validation (format/schema/checksum/manifest vs DB) ->
 *   failure matrix (malformed / truncated / bad schema / invalid values) with
 *   state-invariance proofs -> replace-import round trip -> merge idempotency
 *   -> wipe + restore (destructive round trip into wiped target) -> restart
 *   persistence.
 *
 * Safety: the profile is snapshotted to a tar anchor BEFORE any destructive
 * step; every failure fixture is a FILE in the app's own backups directory
 * loaded through the product's real Load path (no SAF automation, no host
 * input). The journey never touches any other device.
 *
 * Usage: node scripts/qa/data-management-journey.mjs --serial emulator-N
 *   --confirm-qa-profile [--out FILE] [--skip-wipe]
 * Parent must explicitly transfer the disposable emulator first. A normal
 * backup is never assumed to be a recovery anchor for a destructive test.
 * Exit: 0 = all requested assertions verified, 1 = failed/blocked, 2 = usage.
 */
'use strict';

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Importing this module for deterministic driver tests must never contact ADB.
const nodeContent = (node) => (node?.content || node?.desc || node?.text || '').trim();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// `currency_balance` is a VIEW. Query rows without rowid assumptions, then sort
// canonical row values in JS so both tables and views compare deterministically.
export const SNAPSHOT_TABLES = ['game_sessions', 'xp_awards', 'currency_ledger', 'currency_balance', 'quests',
  'quest_progress', 'achievements', 'achievement_unlocks', 'domain_ratings', 'rating_history',
  'tutorial_state', 'game_favorites', 'workout_instances', 'profile'];

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function canonicalRows(rows) {
  return rows.map((row) => JSON.stringify(canonicalJson(row))).sort();
}

export function snapshotRowsSql(table) {
  if (!SNAPSHOT_TABLES.includes(table)) throw new Error(`Unknown snapshot relation '${table}'`);
  return `SELECT * FROM "${table}"`;
}

export function validateRunConsent(serial, qaProfileConfirmed) {
  return /^emulator-\d+$/.test(serial) && qaProfileConfirmed === true;
}

/** Recompute the product's canonical SHA-256 after changing a rejection fixture. */
function withBackupChecksum(envelope) {
  const { checksum: _oldChecksum, ...payload } = envelope;
  return { ...payload, checksum: sha256(JSON.stringify(canonicalJson(payload))) };
}

/** Invalid fixtures carry a valid envelope checksum so rejection tests the intended gate. */
export function buildFailureFixtures(raw) {
  const envelope = JSON.parse(raw);
  const sessions = envelope?.data?.gameSessions;
  if (!Array.isArray(sessions) || sessions.length === 0) {
    throw new Error('Cannot build value-validation fixture without an exported game session');
  }
  const unsupportedVersion = withBackupChecksum({ ...envelope, version: envelope.version + 1 });
  const invalidValues = withBackupChecksum({
    ...envelope,
    data: {
      ...envelope.data,
      gameSessions: sessions.map((session, index) => index === 0 ? { ...session, xp: -5 } : session),
    },
  });
  return [
    { name: 'dm-case-malformed.json', expectedKind: 'malformed', content: '{"format":"brain-training-backup", "data": {' },
    { name: 'dm-case-truncated.json', expectedKind: 'malformed', content: raw.slice(0, Math.floor(raw.length / 2)) },
    { name: 'dm-case-unsupported-version.json', expectedKind: 'unsupported-version', content: JSON.stringify(unsupportedVersion) },
    { name: 'dm-case-invalid-values.json', expectedKind: 'data-validation', content: JSON.stringify(invalidValues) },
  ];
}

/** Preserve signed RN bounds and descendant text (cards themselves have no text). */
export function parseDataControls(xml) {
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<hierarchy\b/.test(xml) || !/<\/hierarchy>\s*$/.test(xml)) {
    throw new Error('Missing or incomplete current hierarchy');
  }
  const nodes = {};
  const stack = [];
  const decode = (text) => text.replace(/&(quot|apos|lt|gt|amp);/g,
    (_, entity) => ({ quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' })[entity]);
  for (const match of xml.matchAll(/<node\b[^>]*>|<\/node>/g)) {
    const tag = match[0];
    if (tag === '</node>') {
      if (!stack.pop()) throw new Error('Unbalanced hierarchy nodes');
      continue;
    }
    const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)]
      .map(([, key, value]) => [key, decode(value)]));
    const id = (attrs['resource-id'] || '').replace(/^com\.braintraining\.app:id\//, '');
    const rect = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/.exec(attrs.bounds || '');
    const node = {
      id, bounds: rect ? rect.slice(1).map(Number) : null,
      text: attrs.text || '', desc: attrs['content-desc'] || '',
      enabled: attrs.enabled === 'true', clickable: attrs.clickable === 'true',
      content: [attrs.text, attrs['content-desc']].filter(Boolean).join(' '),
    };
    for (const parent of stack) parent.content += ` ${node.content}`;
    if (id) {
      if (nodes[id]) throw new Error(`Duplicate control '${id}'`);
      nodes[id] = node;
    }
    if (!tag.endsWith('/>')) stack.push(node);
  }
  if (stack.length) throw new Error('Unclosed hierarchy nodes');
  return nodes;
}

/** Entire rectangle must be in the current app window, never the system bars. */
export function safeTapPoint(node, viewport) {
  if (!node?.enabled || !node.clickable || !Array.isArray(node.bounds)) return null;
  const [x1, y1, x2, y2] = node.bounds;
  if (![x1, y1, x2, y2].every(Number.isFinite) || x1 < viewport.left || y1 < viewport.top ||
      x2 > viewport.right || y2 > viewport.bottom || x2 <= x1 || y2 <= y1) return null;
  return [Math.round((x1 + x2) / 2), Math.round((y1 + y2) / 2)];
}

/** Drive the real preview/confirm contract, not a double-tap at stale coordinates. */
export async function applyPreviewedImport(mode, io) {
  if (!['merge', 'replace'].includes(mode)) throw new Error('Invalid import mode');
  const previewId = `data-preview-${mode}`;
  const actionId = `data-import-${mode}`;
  let nodes = await io.find(previewId);
  await io.tap(nodes, previewId);
  nodes = await io.find('data-preview-output');
  if (!nodeContent(nodes['data-preview-output']).includes(`Preview (${mode}): Valid`)) {
    throw new Error(`Matching valid ${mode} preview not observed`);
  }
  io.boundary('preview-validated', nodes);
  // Never manufacture consent for unknown-field loss. Stop for explicit review.
  if (nodes['data-preview-lossy-warning']) throw new Error('Lossy backup requires explicit user consent');
  nodes = await io.find(actionId);
  if (!nodes[actionId]?.enabled) throw new Error(`${actionId} is disabled (preview/consent not current)`);
  if (/Tap again to erase and restore/.test(nodeContent(nodes[actionId]))) {
    throw new Error('Unexpected pre-armed Replace control');
  }
  const armedAt = io.now();
  await io.tap(nodes, actionId);
  if (mode === 'replace') {
    // ConfirmButton expires after 4000ms. Leave dispatch headroom and fail
    // rather than treating a slow dump followed by a re-arm as an import.
    nodes = await io.read();
    io.boundary('replace-arm-observed', nodes);
    if (!/Tap again to erase and restore/.test(nodeContent(nodes[actionId])) || io.now() - armedAt >= 3000) {
      throw new Error('Replace arm missing or confirmation capture exceeded safe time budget');
    }
    await io.tap(nodes, actionId);
  }
  const completion = await io.completion(mode);
  const message = nodeContent(completion['data-message']);
  if (!message.startsWith(mode === 'replace' ? 'Replace complete:' : 'Merge complete:')) {
    throw new Error(`${mode} completion not observed: ${message || 'no message'}`);
  }
  io.boundary('import-completed', completion);
  return { mode, completionObserved: true, message };
}

/** Match the export projection: these IDs are regenerated, not backup identity.
 * Profile refresh updates its clock/seed fingerprint after Replace by design.
 * Exact row digests remain separate for rejection/rollback comparisons.
 */
export function portableRows(table, rows) {
  return canonicalRows(rows.map((original) => {
    const row = { ...original };
    if (['currency_ledger', 'rating_history', 'xp_awards'].includes(table)) delete row.id;
    if (table === 'profile') delete row.updated_at;
    for (const key of Object.keys(row)) {
      if (key.endsWith('_json') && typeof row[key] === 'string') row[key] = JSON.parse(row[key]);
    }
    if (table === 'profile' && row.settings_json) delete row.settings_json.progressionSeedVersion;
    return row;
  }));
}

function hasCompleteSnapshot(snapshot) {
  return !!snapshot && Array.isArray(snapshot.integrity) && snapshot.integrity.length === 1 &&
    snapshot.integrity[0]?.integrity_check === 'ok' &&
    SNAPSHOT_TABLES.every((table) => Number.isSafeInteger(snapshot.counts?.[table]) && snapshot.counts[table] >= 0 &&
      /^[a-f0-9]{64}$/.test(snapshot.rowDigests?.[table] || '') &&
      /^[a-f0-9]{64}$/.test(snapshot.portableRowDigests?.[table] || '')) &&
    ['sessionXp', 'ledgerSum', 'balance'].every((key) => Number.isFinite(snapshot.aggregates?.[key]));
}

/** Reject freshly seeded/empty QA profiles: equal empty snapshots prove no recovery. */
export function hasSubstantiveSnapshot(snapshot) {
  return hasCompleteSnapshot(snapshot) && snapshot.counts.profile > 0 &&
    snapshot.counts.game_sessions > 0 && snapshot.counts.currency_ledger > 0;
}

function snapshotComparison(before, after) {
  const substantive = hasSubstantiveSnapshot(before) && hasSubstantiveSnapshot(after);
  const countsEqualBaseline = substantive && JSON.stringify(before.counts) === JSON.stringify(after.counts);
  const aggregatesEqualBaseline = substantive && JSON.stringify(before.aggregates) === JSON.stringify(after.aggregates);
  const rowsEqualBaseline = substantive &&
    JSON.stringify(before.portableRowDigests) === JSON.stringify(after.portableRowDigests);
  return { substantive, countsEqualBaseline, aggregatesEqualBaseline, rowsEqualBaseline,
    verified: substantive && countsEqualBaseline && aggregatesEqualBaseline && rowsEqualBaseline };
}

/** Equal counts without a matching completed product operation and full rows prove no recovery. */
export function qualifyImportRoundTrip(operations, before, after, expectedMode) {
  const complete = operations.length > 0 && operations.every((op) =>
    op?.completionObserved === true && op.mode === expectedMode);
  const comparison = snapshotComparison(before, after);
  return { ...comparison, verified: complete && comparison.verified,
    completionObserved: complete, counts: after.counts, aggregates: after.aggregates };
}

async function runJourney() {
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_ROOT = path.join(REPO_ROOT, 'qa-artifacts', '080', 'data-management', RUN_STAMP);
const DB_ROOT = path.join(RUN_ROOT, 'db');
const PACKAGE = 'com.braintraining.app';
const REMOTE_BACKUPS = `/data/data/${PACKAGE}/files/backups`;

const argv = process.argv.slice(2);
let outFile = path.join(RUN_ROOT, 'data-management-journey.json');
let skipWipe = false;
let serial = '';
let qaProfileConfirmed = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outFile = path.resolve(argv[++i] || outFile);
  else if (argv[i] === '--skip-wipe') skipWipe = true;
  else if (argv[i] === '--serial') serial = argv[++i] || '';
  else if (argv[i] === '--confirm-qa-profile') qaProfileConfirmed = true;
  else { console.error(`unknown option '${argv[i]}'`); process.exit(2); }
}

if (!validateRunConsent(serial, qaProfileConfirmed)) {
  console.error('Require --serial emulator-N --confirm-qa-profile (dedicated disposable profile only)');
  process.exitCode = 2;
  return;
}

const SDK = process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = path.join(SDK, 'platform-tools', 'adb.exe');
const SQLITE = path.join(SDK, 'platform-tools', 'sqlite3.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SERIAL = serial;
if (execFileSync(ADB, ['-s', SERIAL, 'get-state'], { encoding: 'utf8', windowsHide: true }).trim() !== 'device') {
  throw new Error('Selected emulator is not online');
}

function adb(sub, opts = {}) {
  try {
    return execFileSync(ADB, ['-s', SERIAL, ...sub], {
      encoding: 'utf8', timeout: opts.timeout || 30000, maxBuffer: 64 * 1024 * 1024,
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) { if (opts.tolerant) return ''; throw e; }
}

// --- UI helpers ------------------------------------------------------------
let captureSeq = 0;
const actions = [];
function dumpControls() {
  const remote = '/sdcard/bt-data-dump.xml';
  // Failed removal/dump must never reuse an earlier tree.
  adb(['shell', 'rm', '-f', remote]);
  adb(['shell', 'uiautomator', 'dump', remote], { timeout: 60000 });
  const xml = adb(['shell', 'cat', remote]);
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  const file = path.join(RUN_ROOT, `hierarchy-${++captureSeq}.xml`);
  fs.writeFileSync(file, xml);
  const nodes = parseDataControls(xml);
  const artifact = { file: path.relative(REPO_ROOT, file).split(path.sep).join('/'), sha256: sha256(xml) };
  Object.defineProperty(nodes, 'evidenceArtifact', { value: artifact });
  return nodes;
}

// WindowManager's app frame excludes system bars; never guess the framebuffer.
const windowDump = adb(['shell', 'dumpsys', 'window', 'windows']);
const appWindow = windowDump.split(/Window #/).find((block) => block.includes(PACKAGE) && /mFrame=/.test(block));
const frame = /mFrame=\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(appWindow || '');
if (!frame) throw new Error('Cannot establish app window bounds; open Backups & data before running');
const [left, top, right, bottom] = frame.slice(1).map(Number);
const viewport = { left, top, right, bottom };
function tap(nodes, key) {
  const node = nodes[key];
  const point = safeTapPoint(node, viewport);
  const event = { timestamp: new Date().toISOString(), target: key, bounds: node?.bounds,
    enabled: node?.enabled, clickable: node?.clickable, point, actionRequested: true,
    actionExecuted: false, beforeArtifact: nodes.evidenceArtifact };
  actions.push(event);
  fs.writeFileSync(path.join(RUN_ROOT, 'actions.json'), JSON.stringify(actions, null, 2));
  if (!point) throw new Error(`Refused unavailable/unsafe tap: ${key}`);
  try {
    adb(['shell', 'input', 'tap', ...point.map(String)]);
    event.actionExecuted = true;
  } catch (error) {
    event.error = error.message;
    throw error;
  } finally {
    fs.writeFileSync(path.join(RUN_ROOT, 'actions.json'), JSON.stringify(actions, null, 2));
  }
}

/**
 * uiautomator reports only VISIBLE nodes for this app's scroll views, so any
 * control below the fold must be scrolled into the window before it can be
 * tapped or asserted. (Same lesson the workout driver learned.)
 */
function layoutHealthy(nodes) {
  // A corrupted RN a11y layout reports inverted bounds (observed bottom =
  // -5792) and the platform dumper then skips whole subtrees as invisible.
  return Object.values(nodes).every((v) => !v.bounds ||
    (v.bounds[2] >= v.bounds[0] && v.bounds[3] >= v.bounds[1]));
}

const centerX = Math.round((left + right) / 2);
const upperY = Math.round(top + (bottom - top) * 0.35);
const lowerY = Math.round(top + (bottom - top) * 0.6);
const GENTLE_UP = ['shell', 'input', 'swipe', centerX, upperY, centerX, lowerY, 450].map(String);
const GENTLE_DOWN = ['shell', 'input', 'swipe', centerX, lowerY, centerX, upperY, 450].map(String);

async function scrollUntil(keyRe, maxSwipes = 14, fromTop = true, predicate = () => true) {
  // Reset toward the top first when the target may sit ABOVE the current
  // scroll position. SMALL steps only — flings corrupt this app's a11y layout
  // bounds and silently detach taps from controls (the bug that looked like a
  // dead Replace-Import button). A target BELOW the current position must NOT
  // reset to top: the import card is ~3800px down and an 8-swipe budget from
  // the top can never reach it (screenshot-proven silent no-op taps).
  if (fromTop) {
    for (let i = 0; i < 4; i++) {
      adb(GENTLE_UP);
      await sleep(400);
    }
    await sleep(1500);
  }
  for (let i = 0; i < maxSwipes; i++) {
    const n = dumpControls();
    if (!layoutHealthy(n)) throw new Error('Corrupt RN bounds; stop and re-enter manually, do not continue with lost preview');
    if (Object.keys(n).some((k) => keyRe.test(k) && predicate(n[k]) &&
        (!n[k].clickable || !!safeTapPoint({ ...n[k], enabled: true }, viewport)))) return n;
    adb(GENTLE_DOWN);
    await sleep(1500);
  }
  throw new Error(`Control not reached: ${keyRe}`);
}

function screenshot(name) {
  try {
    const buf = execFileSync(ADB, ['-s', SERIAL, 'exec-out', 'screencap', '-p'], {
      encoding: 'buffer', timeout: 30000, windowsHide: true, maxBuffer: 32 * 1024 * 1024,
    });
    fs.mkdirSync(RUN_ROOT, { recursive: true });
    const f = path.join(RUN_ROOT, `${name}.png`);
    fs.writeFileSync(f, buf);
    return { file: path.relative(REPO_ROOT, f).replace(/\\/g, '/'), sha256: sha256(buf) };
  } catch { return null; }
}

const steps = [];
async function step(name, act, expect, extra = {}) {
  const before = name === 'open-data-management' ? {} : dumpControls();
  try {
    if (act) await act(before);
  } catch (error) {
    steps.push({ seq: steps.length, name, observed: false, error: error.message,
      evidenceArtifact: screenshot(`failed-${name}`) });
    fs.writeFileSync(path.join(RUN_ROOT, 'failed-steps.json'), JSON.stringify(steps, null, 2));
    throw error;
  }
  await sleep(1500);
  const after = dumpControls();
  const shot = screenshot(`step-${String(steps.length).padStart(2, '0')}-${name}`);
  const messages = Object.fromEntries(Object.entries(after)
    .filter(([k]) => /message|error|warn|storage|count-|preview|import-(merge|replace)/.test(k))
    .map(([k, v]) => [k, nodeContent(v).slice(0, 800)]));
  let status = 'recorded';
  const observed = expect ? expect(after) : null;
  if (observed === true) status = 'OK';
  else if (observed === false) status = 'NOT OBSERVED';
  steps.push({ seq: steps.length, name, timestamp: new Date().toISOString(), observed, ui: messages, evidenceArtifact: shot, ...extra });
  console.log(`[data] ${name}: ${status}`);
  if (observed !== true) {
    fs.writeFileSync(path.join(RUN_ROOT, 'failed-steps.json'), JSON.stringify(steps, null, 2));
    throw new Error(`Step '${name}' was not observed; stopping before further actions`);
  }
  return after;
}

// --- database --------------------------------------------------------------
function sqliteJson(dbFile, sql) {
  try {
    const out = execFileSync(SQLITE, ['-json', dbFile, sql], {
      encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024, windowsHide: true,
    });
    return JSON.parse(out || '[]');
  } catch (e) {
    throw new Error(`Snapshot query failed: ${e.message}`);
  }
}

function snapshotDb(tag) {
  fs.mkdirSync(DB_ROOT, { recursive: true });
  const local = path.join(DB_ROOT, `${tag}.db`);
  for (const ext of ['', '-wal', '-shm']) {
    const source = `/data/data/${PACKAGE}/files/SQLite/brain-training.db${ext}`;
    const remote = `/sdcard/bt-data${ext}.db`;
    adb(['shell', 'rm', '-f', remote]);
    // Missing sidecars are allowed; a failed copy/pull is not. In particular
    // never replay a previous snapshot's WAL against a new main database.
    if (ext && adb(['shell', `if [ -f ${source} ]; then echo present; fi`]).trim() !== 'present') continue;
    adb(['shell', 'cp', source, remote]);
    execFileSync(ADB, ['-s', SERIAL, 'pull', remote, local + ext],
      { timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  }
  const integrity = sqliteJson(local, 'PRAGMA integrity_check');
  if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('Snapshot integrity check failed');
  const counts = {};
  const rowDigests = {};
  const portableRowDigests = {};
  for (const t of SNAPSHOT_TABLES) {
    const rows = sqliteJson(local, `SELECT COUNT(*) AS n FROM "${t}"`);
    counts[t] = rows[0].n;
    // Never ORDER BY rowid here: currency_balance is a view. Canonical row
    // sorting preserves stable comparisons for ordinary tables and views alike.
    const data = sqliteJson(local, snapshotRowsSql(t));
    if (data.length !== counts[t]) throw new Error(`Snapshot rows changed while reading '${t}' (${counts[t]} count, ${data.length} rows)`);
    rowDigests[t] = sha256(JSON.stringify(canonicalRows(data)));
    portableRowDigests[t] = sha256(JSON.stringify(portableRows(t, data)));
  }
  const aggregates = {
    sessionXp: sqliteJson(local, 'SELECT COALESCE(SUM(xp),0) AS s FROM game_sessions')?.[0]?.s ?? null,
    ledgerSum: sqliteJson(local, 'SELECT COALESCE(SUM(amount),0) AS s FROM currency_ledger')?.[0]?.s ?? null,
    balance: sqliteJson(local, 'SELECT balance FROM currency_balance')?.[0]?.balance ?? null,
  };
  const summary = { tag, capturedAt: new Date().toISOString(), integrity, counts, aggregates, rowDigests, portableRowDigests };
  fs.writeFileSync(path.join(DB_ROOT, `${tag}.summary.json`), JSON.stringify(summary, null, 2));
  console.log(`[data] db snapshot '${tag}'`);
  return summary;
}

// --- app-data anchor -------------------------------------------------------
function anchorAppData(tag) {
  adb(['shell', 'rm', '-f', '/sdcard/bt-data-anchor.tgz']);
  adb(['shell', `cd /data/data && tar -czf /sdcard/bt-data-anchor.tgz ${PACKAGE}`], { timeout: 120000 });
  const local = path.join(RUN_ROOT, `appdata-anchor-${tag}.tgz`);
  try {
    execFileSync(ADB, ['-s', SERIAL, 'pull', '/sdcard/bt-data-anchor.tgz', local],
      { timeout: 120000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const buf = fs.readFileSync(local);
    const listing = execFileSync('tar', ['-tzf', local], { encoding: 'utf8', windowsHide: true });
    if (!listing.includes(`${PACKAGE}/files/SQLite/brain-training.db`)) return null;
    return { file: path.relative(REPO_ROOT, local).replace(/\\/g, '/'), bytes: buf.length, sha256: sha256(buf) };
  } catch { return null; }
}

// --- backups transport -----------------------------------------------------
function listBackups() {
  const out = adb(['shell', 'ls', REMOTE_BACKUPS], { tolerant: true });
  return out.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('.'));
}

function pullBackup(name, localName) {
  const local = path.join(RUN_ROOT, localName);
  execFileSync(ADB, ['-s', SERIAL, 'pull', `${REMOTE_BACKUPS}/${name}`, local],
    { timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  return local;
}

function pushBackup(localPath, name) {
  execFileSync(ADB, ['-s', SERIAL, 'push', localPath, `${REMOTE_BACKUPS}/${name}`],
    { timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  adb(['shell', 'am', 'broadcast', '-a', 'android.intent.action.MEDIA_SCANNER_SCAN_FILE'], { tolerant: true });
}

const exactControl = (key) => new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const importBoundaries = [];
const importIo = {
  find: (key) => scrollUntil(exactControl(key), 18, false),
  read: dumpControls,
  tap,
  now: Date.now,
  boundary: (phase, nodes) => {
    importBoundaries.push({ phase, timestamp: new Date().toISOString(), artifact: nodes.evidenceArtifact,
      controls: Object.fromEntries(Object.entries(nodes).filter(([key]) => /data-(preview|import|message)/.test(key))) });
    fs.writeFileSync(path.join(RUN_ROOT, 'import-boundaries.json'), JSON.stringify(importBoundaries, null, 2));
  },
  completion: async (mode) => {
    await sleep(500);
    // Import invalidates/removes the preview, moving feedback UP.
    return scrollUntil(/^data-message$/, 18, true, (node) =>
      nodeContent(node).startsWith(mode === 'replace' ? 'Replace complete:' : 'Merge complete:'));
  },
};
async function loadBackup(name) {
  const key = `data-backup-load-${name}`;
  const nodes = await scrollUntil(exactControl(key), 24, true);
  tap(nodes, key);
  await sleep(500);
}
async function importBackup(name, mode) {
  await loadBackup(name);
  return applyPreviewedImport(mode, importIo);
}

// --- main ------------------------------------------------------------------
await (async function main() {
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  console.log(`[data] serial=${SERIAL} run=${RUN_STAMP}`);

  const result = { schemaVersion: 1, journey: 'data-management-backup-restore', runStamp: RUN_STAMP, device: SERIAL, steps: [] };

  // 0. Safety anchor + baseline.
  adb(['shell', 'am', 'force-stop', PACKAGE]);
  result.anchorBefore = anchorAppData('before');
  if (!result.anchorBefore) throw new Error('No readable app-data anchor; refusing all mutations');


  // 1. Open the data-management surface through the documented deep link.
  await step('open-data-management', async () => {
    adb(['shell', 'am', 'force-stop', PACKAGE]);
    await sleep(1500);
    adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'braintraining://data-management']);
    await sleep(4000);
  }, (n) => !!n['data-management-title'] && !!n['data-export-button']);

  const baseline = snapshotDb('baseline');
  result.baseline = baseline;
  if (!hasSubstantiveSnapshot(baseline)) {
    throw new Error('Refusing an empty/unseeded profile; require profile, session and currency-ledger rows before testing restore');
  }

  // 2. Export a backup through the product UI.
  const before = new Set(listBackups());
  await step('export-backup', async (n) => {
    tap(n, 'data-export-button');
    await sleep(3000);
  }, (n) => !!n['data-export-output'] || !!n['data-saved-backups']);
  const created = listBackups().filter((f) => !before.has(f));
  result.export = { backupsBefore: [...before], backupsAfter: listBackups(), created };
  if (created.length) {
    const b1Name = created[0];
    const b1Path = pullBackup(b1Name, 'backup-b1.json');
    let envelope = null;
    let integrity = null;
    try {
      const raw = fs.readFileSync(b1Path, 'utf8');
      envelope = JSON.parse(raw);
      const sections = envelope.data || {};
      const sectionCounts = Object.fromEntries(Object.entries(sections).map(([k, v]) => [
        k,
        Array.isArray(v) ? v.length : (v && typeof v === 'object' ? 1 : 0),
      ]));
      const totalRecords = Object.values(sectionCounts).reduce((s, n2) => s + (n2 || 0), 0);
      integrity = {
        formatOk: envelope.format === 'brain-training-backup',
        schemaVersion: envelope.schemaVersion,
        engineVersion: envelope.engineVersion,
        checksumPresent: typeof envelope.checksum === 'string' && envelope.checksum.length === 64,
        checksumAlgorithm: envelope.checksumAlgorithm,
        manifestTotalRecords: envelope.manifest?.totalRecords ?? null,
        actualTotalRecords: totalRecords,
        manifestMatchesContent: (envelope.manifest?.totalRecords ?? -1) === totalRecords,
        sectionCounts,
        // Content-vs-database agreement for the headline sections.
        dbAgreement: {
          gameSessions: sectionCounts.gameSessions === baseline.counts.game_sessions,
          currencyLedger: sectionCounts.currencyLedger === baseline.counts.currency_ledger,
          questDefinitions: sectionCounts.questDefinitions === baseline.counts.quests,
          questProgress: sectionCounts.questProgress === baseline.counts.quest_progress,
          achievementUnlocks: sectionCounts.achievementUnlocks === baseline.counts.achievement_unlocks,
          ratingHistory: sectionCounts.ratingHistory === baseline.counts.rating_history,
          tutorialState: sectionCounts.tutorialState === baseline.counts.tutorial_state,
          workoutInstances: sectionCounts.workoutInstances === baseline.counts.workout_instances,
        },
      };
    } catch (e) {
      integrity = { parseError: e.message };
    }
    result.backupFile = { name: b1Name, local: path.relative(REPO_ROOT, b1Path).replace(/\\/g, '/'), envelope: envelope ? { format: envelope.format, schemaVersion: envelope.schemaVersion, engineVersion: envelope.engineVersion, version: envelope.version } : null, integrity };

    // 3. Failure matrix: each fixture is rejected visibly through the product's Load path.
    const cases = [];
    const raw = fs.readFileSync(b1Path, 'utf8');
    const fixtures = buildFailureFixtures(raw);
    for (const fx of fixtures) {
      const localFx = path.join(RUN_ROOT, fx.name);
      fs.writeFileSync(localFx, fx.content);
      pushBackup(localFx, fx.name);
    }
    for (const fx of fixtures) {
      const pre = snapshotDb(`pre-${fx.name.slice(0, 12)}`);
      let rejected = false;
      await step(`reject-${fx.name}`, async () => {
        // Refresh inventory, then actually validate the loaded file. Loading
        // alone cannot prove invalid input was rejected by the engine.
        adb(['shell', 'am', 'force-stop', PACKAGE]);
        adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'braintraining://data-management']);
        await sleep(2500);
        await loadBackup(fx.name);
        const nodes = await importIo.find('data-preview-merge');
        tap(nodes, 'data-preview-merge');
        const previewNodes = await importIo.find('data-preview-output');
        const preview = nodeContent(previewNodes['data-preview-output']);
        rejected = preview.includes(`Preview (merge): Invalid (${fx.expectedKind})`);
        if (!rejected) throw new Error(`Fixture was not rejected as ${fx.expectedKind}: ${preview || fx.name}`);
      }, () => rejected);
      const post = snapshotDb(`post-${fx.name.slice(0, 12)}`);
      cases.push({
        fixture: fx.name,
        expectedRejectionKind: fx.expectedKind,
        rejectionObserved: rejected,
        uiMessages: steps[steps.length - 1].ui,
        stateUnchanged: JSON.stringify(pre.rowDigests) === JSON.stringify(post.rowDigests),
      });
    }
    result.failureMatrix = cases;

    // 4. Equal DB counts are not a round trip without observed completion.
    let replaced;
    await step('replace-import', async () => {
      replaced = await importBackup(b1Name, 'replace');
    }, () => replaced?.completionObserved === true);
    const afterReplace = snapshotDb('after-replace');
    result.replaceRoundTrip = qualifyImportRoundTrip([replaced], baseline, afterReplace, 'replace');

    // 5. Both merges must complete, with row content checked as well as counts.
    const merges = [];
    for (let round = 1; round <= 2; round++) {
      await step(`merge-import-${round}`, async () => {
        merges.push(await importBackup(b1Name, 'merge'));
      }, () => merges.length === round && merges[round - 1].completionObserved);
    }
    const afterMerge = snapshotDb('after-merge');
    result.mergeIdempotency = qualifyImportRoundTrip(merges, afterReplace, afterMerge, 'merge');

    // 6. Wipe + restore into the wiped target (destructive round trip).
    if (!skipWipe) {
      const wiped = await step('wipe-local-data', async () => {
        let nodes = await scrollUntil(/data-wipe-button/, 18, true);
        if (nodes['data-wipe-confirm']) {
          tap(nodes, 'data-wipe-confirm');
          await sleep(800);
          adb(['shell', 'input', 'text', 'DELETE'], { tolerant: true });
          await sleep(800);
        }
        const n2 = dumpControls();
        tap(n2, 'data-wipe-button');
        await sleep(4000);
      }, (n) => Object.values(n).some((node) => node.id === 'data-message' &&
        nodeContent(node).startsWith('All local training data wiped.')));
      void wiped;
      const afterWipe = snapshotDb('after-wipe');
      // User DATA must be gone. Catalog tables (quests/achievements), the
      // local profile row and a freshly generated workout are APP-RESEEDED by
      // design (wipe.ts clears FK_DELETE_ORDER then the app reseeds content),
      // so their presence is not a wipe failure.
      // quest_progress is deliberately excluded from the zero-check: the app
      // RESEEDS zero-progress rows for its shipped quests after a wipe (9 rows
      // here), which is catalog rehydration, not surviving user data.
      const userTables = ['game_sessions', 'xp_awards', 'currency_ledger', 'rating_history',
        'domain_ratings', 'tutorial_state', 'game_favorites', 'workout_instances',
        'achievement_unlocks'];
      result.wipe = {
        counts: afterWipe.counts,
        dataGone: userTables.every((t) => (afterWipe.counts[t] || 0) === 0),
        reseededCatalog: { quests: afterWipe.counts.quests, achievements: afterWipe.counts.achievements, profile: afterWipe.counts.profile },
      };
      let restored;
      await step('restore-after-wipe', async () => {
        restored = await importBackup(b1Name, 'replace');
      }, () => restored?.completionObserved === true);
      const afterRestore = snapshotDb('after-restore');
      result.restoreAfterWipe = qualifyImportRoundTrip([restored], baseline, afterRestore, 'replace');
    }
  }

  // 7. Persistence: restart and re-verify counts + a healthy Home.
  await step('persistence-restart', async () => {
    adb(['shell', 'am', 'force-stop', PACKAGE]);
    await sleep(2000);
    adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1']);
    await sleep(5000);
  }, (n) => !!n['home-title'] || !!n['home-workout-cta'] || !!n['tab-home']);
  const finalSnap = snapshotDb('final');
  result.persistence = snapshotComparison(baseline, finalSnap);
  result.persistence.counts = finalSnap.counts;
  result.persistence.aggregates = finalSnap.aggregates;
  adb(['shell', 'am', 'force-stop', PACKAGE]);
  result.anchorAfter = anchorAppData('after');

  result.steps = steps;
  result.actions = actions;
  result.importBoundaries = importBoundaries;
  result.summary = {
    stepsRecorded: steps.length,
    stepsObserved: steps.filter((s) => s.observed === true).length,
    allStepsObserved: steps.length > 0 && steps.every((s) => s.observed === true),
    exportVerified: !!result.backupFile?.integrity &&
      result.backupFile.integrity.formatOk && result.backupFile.integrity.checksumPresent &&
      result.backupFile.integrity.manifestMatchesContent &&
      Object.values(result.backupFile.integrity.dbAgreement || {}).length === 8 &&
      Object.values(result.backupFile.integrity.dbAgreement || {}).every(Boolean),
    failureCasesRejected: (result.failureMatrix || []).filter((c) => c.rejectionObserved && c.stateUnchanged).length,
    failureCasesTotal: (result.failureMatrix || []).length,
  };
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  if (!result.anchorBefore || !result.anchorAfter || !result.summary.allStepsObserved ||
      !result.summary.exportVerified || !result.replaceRoundTrip?.verified || !result.mergeIdempotency?.verified ||
      (!skipWipe && (!result.wipe?.dataGone || !result.restoreAfterWipe?.verified)) ||
      result.summary.failureCasesTotal !== 4 || result.summary.failureCasesRejected !== 4 ||
      !result.persistence.verified) process.exitCode = 1;
  console.log(`[data] evidence -> ${outFile}`);
  console.log(`[data] steps observed ${result.summary.stepsObserved}/${steps.length}`);
})();

}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runJourney().catch((error) => { console.error(`[data] ${error.stack || error}`); process.exitCode = 1; });
}
