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
 * Usage: node scripts/qa/data-management-journey.mjs [--out FILE] [--skip-wipe]
 * Exit: 0 = journey ran, 3 = no device, 2 = usage.
 */
'use strict';

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
let restoreTarget = 'brain-training-backup_';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outFile = path.resolve(argv[++i] || outFile);
  else if (argv[i] === '--skip-wipe') skipWipe = true;
  else if (argv[i] === '--restore-target') restoreTarget = argv[++i] || restoreTarget;
  else { console.error(`unknown option '${argv[i]}'`); process.exit(2); }
}

const SDK = process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const ADB = path.join(SDK, 'platform-tools', 'adb.exe');
const SQLITE = path.join(SDK, 'platform-tools', 'sqlite3.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

const SERIAL = (() => {
  const out = execFileSync(ADB, ['devices'], { encoding: 'utf8', windowsHide: true });
  const line = out.split('\n').map((l) => l.trim()).find((l) => /^emulator-\d+\s+device$/.test(l));
  if (!line) { console.error('[data] no emulator online'); process.exit(3); }
  return line.split(/\s+/)[0];
})();

function adb(sub, opts = {}) {
  try {
    return execFileSync(ADB, ['-s', SERIAL, ...sub], {
      encoding: 'utf8', timeout: opts.timeout || 30000, maxBuffer: 64 * 1024 * 1024,
      windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) { if (opts.tolerant) return ''; throw e; }
}

// --- UI helpers ------------------------------------------------------------
function dumpControls() {
  adb(['shell', 'rm', '-f', '/sdcard/bt-data-dump.xml'], { tolerant: true });
  adb(['shell', 'uiautomator', 'dump', '/sdcard/bt-data-dump.xml'], { timeout: 60000, tolerant: true });
  const xml = adb(['shell', 'cat', '/sdcard/bt-data-dump.xml'], { tolerant: true }) || '';
  const nodes = {};
  const re = /<node\b[^>]*>/g;
  let m = re.exec(xml);
  while (m !== null) {
    const tag = m[0];
    m = re.exec(xml);
    const rid = /resource-id="([^"]*)"/.exec(tag)?.[1] || '';
    if (!rid) continue;
    const key = rid.replace(/^com\.braintraining\.app:id\//, '');
    const bounds = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(tag);
    nodes[key] = {
      bounds: bounds ? [+bounds[1], +bounds[2], +bounds[3], +bounds[4]] : null,
      text: /text="([^"]*)"/.exec(tag)?.[1] || '',
      desc: /content-desc="([^"]*)"/.exec(tag)?.[1] || '',
    };
  }
  return nodes;
}

/**
 * SAFE tap: never emit a tap from garbage bounds. A corrupted RN a11y layout
 * produced negative/inverted rects whose "center" landed on the system nav
 * bar — one such tap sent the whole app to the launcher mid-flow (an artifact
 * that LOOKED like an app crash; crash buffer and dropbox were empty). Bounds
 * must be on-screen and clear of the nav bar, or the tap is refused and
 * reported as not executed.
 */
const tap = (node) => {
  if (!node || !node.bounds) return false;
  const [x1, y1, x2, y2] = node.bounds;
  if (!(x2 > x1) || !(y2 > y1)) return false;
  const x = Math.round((x1 + x2) / 2);
  const y = Math.round((y1 + y2) / 2);
  if (x < 0 || x > 1080 || y < 60 || y > 1800) return false;
  adb(['shell', 'input', 'tap', String(x), String(y)], { tolerant: true });
  return true;
};

/**
 * uiautomator reports only VISIBLE nodes for this app's scroll views, so any
 * control below the fold must be scrolled into the window before it can be
 * tapped or asserted. (Same lesson the workout driver learned.)
 */
function layoutHealthy(nodes) {
  // A corrupted RN a11y layout reports inverted bounds (observed bottom =
  // -5792) and the platform dumper then skips whole subtrees as invisible.
  return Object.values(nodes).every((v) => !v.bounds || v.bounds[3] >= v.bounds[1]);
}

const GENTLE_UP = ['shell', 'input', 'swipe', '540', '700', '540', '1150', '450'];   // toward top
const GENTLE_DOWN = ['shell', 'input', 'swipe', '540', '1150', '540', '700', '450']; // toward bottom

async function scrollUntil(keyRe, maxSwipes = 14, fromTop = true) {
  // Reset toward the top first when the target may sit ABOVE the current
  // scroll position. SMALL steps only — flings corrupt this app's a11y layout
  // bounds and silently detach taps from controls (the bug that looked like a
  // dead Replace-Import button). A target BELOW the current position must NOT
  // reset to top: the import card is ~3800px down and an 8-swipe budget from
  // the top can never reach it (screenshot-proven silent no-op taps).
  if (fromTop) {
    for (let i = 0; i < 4; i++) {
      adb(GENTLE_UP, { tolerant: true });
      await sleep(400);
    }
    await sleep(1500);
  }
  for (let i = 0; i < maxSwipes; i++) {
    const n = dumpControls();
    if (!layoutHealthy(n)) {
      // Broken layout: re-enter the screen to reset scroll state.
      adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'braintraining://data-management'], { tolerant: true });
      await sleep(3000);
      continue;
    }
    if (Object.keys(n).some((k) => keyRe.test(k))) return n;
    adb(GENTLE_DOWN, { tolerant: true });
    await sleep(1500);
  }
  return dumpControls();
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
  const before = dumpControls();
  if (act) await act(before);
  await sleep(1500);
  const after = dumpControls();
  const shot = screenshot(`step-${String(steps.length).padStart(2, '0')}-${name}`);
  const messages = Object.fromEntries(Object.entries(after)
    .filter(([k]) => /message|error|warn|storage|count-|preview|import-(merge|replace)/.test(k))
    .map(([k, v]) => [k, (v.text || v.desc || '').slice(0, 160)]));
  let status = 'recorded';
  const observed = expect ? expect(after) : null;
  if (observed === true) status = 'OK';
  else if (observed === false) status = 'NOT OBSERVED';
  steps.push({ seq: steps.length, name, timestamp: new Date().toISOString(), observed, ui: messages, evidenceArtifact: shot, ...extra });
  console.log(`[data] ${name}: ${status}`);
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
    console.error(`[data] sqlite failed: ${e.message}`);
    return null;
  }
}

const COUNT_TABLES = ['game_sessions', 'xp_awards', 'currency_ledger', 'currency_balance', 'quests',
  'quest_progress', 'achievements', 'achievement_unlocks', 'domain_ratings', 'rating_history',
  'tutorial_state', 'game_favorites', 'workout_instances', 'profile'];

function snapshotDb(tag) {
  fs.mkdirSync(DB_ROOT, { recursive: true });
  for (const ext of ['', '-wal', '-shm']) {
    adb(['shell', 'cp', `/data/data/${PACKAGE}/files/SQLite/brain-training.db${ext}`, `/sdcard/bt-data${ext}.db`], { tolerant: true });
  }
  const local = path.join(DB_ROOT, `${tag}.db`);
  for (const ext of ['', '-wal', '-shm']) {
    try {
      execFileSync(ADB, ['-s', SERIAL, 'pull', `/sdcard/bt-data${ext}.db`, local + ext],
        { timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch { /* sidecars optional */ }
  }
  const counts = {};
  for (const t of COUNT_TABLES) {
    const rows = sqliteJson(local, `SELECT COUNT(*) AS n FROM ${t}`);
    counts[t] = rows ? rows[0].n : null;
  }
  const aggregates = {
    sessionXp: sqliteJson(local, 'SELECT COALESCE(SUM(xp),0) AS s FROM game_sessions')?.[0]?.s ?? null,
    ledgerSum: sqliteJson(local, 'SELECT COALESCE(SUM(amount),0) AS s FROM currency_ledger')?.[0]?.s ?? null,
    balance: sqliteJson(local, 'SELECT balance FROM currency_balance')?.[0]?.balance ?? null,
  };
  const summary = { tag, capturedAt: new Date().toISOString(), counts, aggregates };
  fs.writeFileSync(path.join(DB_ROOT, `${tag}.summary.json`), JSON.stringify(summary, null, 2));
  console.log(`[data] db snapshot '${tag}'`);
  return summary;
}

// --- app-data anchor -------------------------------------------------------
function anchorAppData(tag) {
  adb(['shell', `cd /data/data && tar -czf /sdcard/bt-data-anchor.tgz ${PACKAGE}`], { tolerant: true, timeout: 120000 });
  const local = path.join(RUN_ROOT, `appdata-anchor-${tag}.tgz`);
  try {
    execFileSync(ADB, ['-s', SERIAL, 'pull', '/sdcard/bt-data-anchor.tgz', local],
      { timeout: 120000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const buf = fs.readFileSync(local);
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

function findLoadControl(nodes, namePart) {
  return Object.keys(nodes).find((k) => k.startsWith('data-backup-load-') && k.includes(namePart)) || null;
}

// --- main ------------------------------------------------------------------
(async function main() {
  fs.mkdirSync(RUN_ROOT, { recursive: true });
  console.log(`[data] serial=${SERIAL} run=${RUN_STAMP}`);

  const result = { schemaVersion: 1, journey: 'data-management-backup-restore', runStamp: RUN_STAMP, device: SERIAL, steps: [] };

  // 0. Safety anchor + baseline.
  result.anchorBefore = anchorAppData('before');
  const baseline = snapshotDb('baseline');
  result.baseline = baseline;

  // 1. Open the data-management surface through the documented deep link.
  await step('open-data-management', async () => {
    adb(['shell', 'am', 'force-stop', PACKAGE]);
    await sleep(1500);
    adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'braintraining://data-management'], { tolerant: true });
    await sleep(4000);
  }, (n) => !!n['data-management-title'] && !!n['data-export-button']);

  // 2. Export a backup through the product UI.
  const before = new Set(listBackups());
  await step('export-backup', async (n) => {
    tap(n['data-export-button']);
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

    // 3. Failure matrix: crafted FILES loaded through the product's Load path.
    const cases = [];
    const raw = fs.readFileSync(b1Path, 'utf8');
    const fixtures = [
      { name: 'dm-case-malformed.json', content: '{"format":"brain-training-backup", "data": {' },
      { name: 'dm-case-truncated.json', content: raw.slice(0, Math.floor(raw.length / 2)) },
      { name: 'dm-case-schema999.json', content: raw.replace(/"schemaVersion":\s*\d+/, '"schemaVersion": 999') },
      { name: 'dm-case-invalid-values.json', content: raw.replace(/"xp":\s*\d+/, '"xp": -5') },
    ];
    for (const fx of fixtures) {
      const localFx = path.join(RUN_ROOT, fx.name);
      fs.writeFileSync(localFx, fx.content);
      pushBackup(localFx, fx.name);
    }
    for (const fx of fixtures) {
      const pre = snapshotDb(`pre-${fx.name.slice(0, 12)}`);
      const st = await step(`reject-${fx.name}`, async (n) => {
        // Reload the screen so the pushed fixture appears in the list.
        adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'braintraining://data-management'], { tolerant: true });
        await sleep(2500);
        const nodes = await scrollUntil(new RegExp(`data-backup-load-.*${fx.name.slice(5, 20).replace(/[.]/g, '\\.')}`));
        const loadKey = findLoadControl(nodes, fx.name);
        if (loadKey) tap(nodes[loadKey]);
        await sleep(2500);
      }, null);
      const post = snapshotDb(`post-${fx.name.slice(0, 12)}`);
      cases.push({
        fixture: fx.name,
        uiMessages: steps[steps.length - 1].ui,
        stateUnchanged: JSON.stringify(pre.counts) === JSON.stringify(post.counts)
          && JSON.stringify(pre.aggregates) === JSON.stringify(post.aggregates),
      });
      void st;
    }
    result.failureMatrix = cases;

    // 4. Replace-import round trip (same data -> state must be identical).
    await step('replace-import', async () => {
      const nodes = await scrollUntil(new RegExp(`data-backup-load-.*${b1Name.slice(5, 30).replace(/[.]/g, '\\.')}`));
      const loadKey = Object.keys(nodes).find((k) => k.startsWith('data-backup-load-') && k.includes(restoreTarget));
      if (loadKey) tap(nodes[loadKey]);
      await sleep(2500);
      const n2 = await scrollUntil(/data-preview-(replace|output|merge)/, 16, false);
      tap(n2['data-preview-replace']);
      await sleep(1200);
      const n3 = await scrollUntil(/^data-import-(merge|replace)$/, 4, false);
      tap(n3['data-import-replace']);
      await sleep(3500);
    }, null);
    const afterReplace = snapshotDb('after-replace');
    result.replaceRoundTrip = {
      countsEqualBaseline: JSON.stringify(afterReplace.counts) === JSON.stringify(baseline.counts),
      aggregatesEqualBaseline: JSON.stringify(afterReplace.aggregates) === JSON.stringify(baseline.aggregates),
      counts: afterReplace.counts,
    };

    // 5. Merge idempotency: importing the SAME backup twice must not duplicate.
    for (let round = 1; round <= 2; round++) {
      await step(`merge-import-${round}`, async () => {
        const nodes = await scrollUntil(new RegExp(`data-backup-load-.*${restoreTarget.replace(/[.]/g, '\.')}`), 16, true);
        const loadKey = Object.keys(nodes).find((k) => k.startsWith('data-backup-load-') && k.includes(restoreTarget));
        if (loadKey) tap(nodes[loadKey]);
        await sleep(2500);
        const n2 = await scrollUntil(/data-preview-(merge|output|replace)/, 16, false);
        tap(n2['data-preview-merge']);
        await sleep(1200);
        const n3 = await scrollUntil(/^data-import-(merge|replace)$/, 4, false);
        tap(n3['data-import-merge']);
        await sleep(3500);
      }, null);
    }
    const afterMerge = snapshotDb('after-merge');
    result.mergeIdempotency = {
      countsEqualBaseline: JSON.stringify(afterMerge.counts) === JSON.stringify(baseline.counts),
      aggregatesEqualBaseline: JSON.stringify(afterMerge.aggregates) === JSON.stringify(baseline.aggregates),
      counts: afterMerge.counts,
    };

    // 6. Wipe + restore into the wiped target (destructive round trip).
    if (!skipWipe) {
      const wiped = await step('wipe-local-data', async () => {
        let nodes = await scrollUntil(/data-wipe-button/, 18, true);
        if (nodes['data-wipe-confirm']) {
          tap(nodes['data-wipe-confirm']);
          await sleep(800);
          adb(['shell', 'input', 'text', 'DELETE'], { tolerant: true });
          await sleep(800);
        }
        const n2 = dumpControls();
        tap(n2['data-wipe-button']);
        await sleep(4000);
      }, null);
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
      await step('restore-after-wipe', async () => {
        adb(['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'braintraining://data-management'], { tolerant: true });
        await sleep(3000);
        const nodes = await scrollUntil(new RegExp(`data-backup-load-.*${restoreTarget.replace(/[.]/g, '\.')}`), 16, true);
        const loadKey = Object.keys(nodes).find((k) => k.startsWith('data-backup-load-') && k.includes(restoreTarget));
        if (loadKey) tap(nodes[loadKey]);
        await sleep(2500);
        const n2 = await scrollUntil(/data-preview-(replace|output|merge)/, 16, false);
        tap(n2['data-preview-replace']);
        await sleep(1200);
        const n3 = await scrollUntil(/^data-import-(merge|replace)$/, 4, false);
        tap(n3['data-import-replace']);
        await sleep(4000);
      }, null);
      const afterRestore = snapshotDb('after-restore');
      result.restoreAfterWipe = {
        countsEqualBaseline: JSON.stringify(afterRestore.counts) === JSON.stringify(baseline.counts),
        aggregatesEqualBaseline: JSON.stringify(afterRestore.aggregates) === JSON.stringify(baseline.aggregates),
        counts: afterRestore.counts,
        aggregates: afterRestore.aggregates,
      };
    }
  }

  // 7. Persistence: restart and re-verify counts + a healthy Home.
  await step('persistence-restart', async () => {
    adb(['shell', 'am', 'force-stop', PACKAGE]);
    await sleep(2000);
    adb(['shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1'], { tolerant: true });
    await sleep(5000);
  }, (n) => !!n['home-title'] || !!n['home-workout-cta'] || !!n['tab-home']);
  const finalSnap = snapshotDb('final');
  const baselineRef = result.baseline?.counts;
  result.persistence = {
    countsEqualBaseline: JSON.stringify(finalSnap.counts) === JSON.stringify(baselineRef),
    counts: finalSnap.counts,
    aggregates: finalSnap.aggregates,
  };
  result.anchorAfter = anchorAppData('after');

  result.steps = steps;
  result.summary = {
    stepsRecorded: steps.length,
    stepsObserved: steps.filter((s) => s.observed === true).length,
    failureCasesRejected: (result.failureMatrix || []).filter((c) => c.stateUnchanged).length,
    failureCasesTotal: (result.failureMatrix || []).length,
  };
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`[data] evidence -> ${outFile}`);
  console.log(`[data] steps observed ${result.summary.stepsObserved}/${steps.length}`);
})();
