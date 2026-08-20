// Autobot — autonomous, emulator-local QA harness for brain-training.
//
// Design goals (constitution §28/§29, AGENTS.md "QA instrumentation"):
//  - One dedicated AVD; no host mouse/keyboard; no desktop focus theft.
//  - Drives the app purely through ADB + UI hierarchy + semantic testIDs.
//  - Deep-links directly to games; uses dev-only QA force-state hooks.
//  - Captures hierarchy dumps, logcat, screenshots, and the app DB.
//  - Emits structured per-game PASS/FAIL/NOT VALIDATED results.
//
// Only Node built-ins + the platform `adb`/`sqlite3` are used, so this runs
// without installing any npm dependencies.
//
// Usage:
//   node scripts/qa/autobot.mjs --mode game --game memory
//   node scripts/qa/autobot.mjs --mode catalog
//   node scripts/qa/autobot.mjs --mode wordmatch
//   node scripts/qa/autobot.mjs --mode workout
//   node scripts/qa/autobot.mjs --mode all
//
// Env overrides:
//   QA_DEVICE   adb serial (default: first emulator-*)
//   QA_PKG      application id (default: com.braintraining.app)
//   QA_SCHEME   deep-link scheme (default: braintraining)
//   QA_OUT      artifact root (default: qa-artifacts)

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const PKG = process.env.QA_PKG || 'com.braintraining.app';
const SCHEME = process.env.QA_SCHEME || 'braintraining';
const OUT = process.env.QA_OUT || join(REPO_ROOT, 'qa-artifacts');
const SERIAL = (process.env.QA_DEVICE || firstEmulator()).trim();
const SQLITE = process.env.QA_SQLITE || join(process.env.ANDROID_HOME || '', 'platform-tools', 'sqlite3.exe');
const GAMES = [
  'attention-odd-one-out', 'attention-visual-search',
  'flexibility-card-sort', 'flexibility-color-stroop',
  'language-sentence-builder', 'language-word-match', 'language-word-scramble',
  'logic-code-cracker', 'logic-next-sequence',
  'math-fast-math', 'math-equation-builder', 'math-missing-operator',
  'memory', 'memory-pattern-tap-back', 'memory-sequence-memory',
  'spatial-mental-rotation', 'spatial-transform-match',
  'speed-color-match', 'speed-reaction-time', 'speed-tap-rush',
];
const CATEGORIES = {
  Memory: 'memory', Attention: 'attention-odd-one-out', Speed: 'speed-tap-rush',
  Math: 'math-fast-math', Language: 'language-word-match', Logic: 'logic-next-sequence',
  Flexibility: 'flexibility-card-sort', Spatial: 'spatial-transform-match',
};

// ---------------------------------------------------------------------------
// adb helpers
// ---------------------------------------------------------------------------
function firstEmulator() {
  try {
    const out = execFileSync('adb', ['devices'], { encoding: 'utf8' });
    for (const line of out.split('\n')) {
      const m = line.match(/^(\S+)\s+device$/);
      if (m && /emulator|device/.test(m[1])) return m[1];
    }
  } catch { /* ignore */ }
  return 'emulator-5554';
}
function adb(args, opts = {}) {
  return execFileSync('adb', ['-s', SERIAL, ...args], { encoding: 'utf8', ...opts });
}
function shell(cmd) {
  return adb(['shell', cmd]);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// hierarchy
// ---------------------------------------------------------------------------
function dumpHierarchy(tag) {
  const local = join(OUT, `${tag}-hier.xml`);
  try {
    adb(['shell', 'uiautomator', 'dump', '/sdcard/qa-hier.xml']);
    adb(['pull', '/sdcard/qa-hier.xml', local]);
  } catch (e) {
    // Fallback: stream to tty (can be truncated but better than nothing).
    try {
      const xml = adb(['exec-out', 'uiautomator', 'dump', '/dev/tty']);
      writeFileSync(local, xml);
    } catch { /* leave absent */ }
  }
  return local;
}
function parseBounds(bounds) {
  const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return null;
  const x1 = +m[1], y1 = +m[2], x2 = +m[3], y2 = +m[4];
  return { x1, y1, x2, y2, cx: Math.round((x1 + x2) / 2), cy: Math.round((y1 + y2) / 2) };
}
function findTestId(xml, id) {
  // RN Android renders `testID` as the node `resource-id`. Match on either
  // attribute so the harness is robust across RN versions.
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const attr of ['resource-id', 'testID', 'content-desc']) {
    const re = new RegExp(`${attr}="${escaped}"([^>]*)`);
    const m = xml.match(re);
    if (m) {
      const a = m[1] || '';
      const b = a.match(/bounds="([^"]+)"/);
      const t = a.match(/text="([^"]*)"/);
      return { id, bounds: b ? parseBounds(b[1]) : null, text: t ? t[1] : '' };
    }
  }
  return null;
}
function hasTestId(xml, id) { return findTestId(xml, id) !== null; }
function tapTestId(id, xml) {
  const node = xml ? findTestId(xml, id) : null;
  if (!node || !node.bounds) return false;
  shell(`input tap ${node.bounds.cx} ${node.bounds.cy}`);
  return true;
}

// ---------------------------------------------------------------------------
// device lifecycle
// ---------------------------------------------------------------------------
function launch() {
  adb(['shell', 'am', 'start', '-n', `${PKG}/.MainActivity`]);
}
function reset() {
  adb(['shell', 'am', 'force-stop', PKG]);
  sleep(500);
  try { adb(['shell', 'pm', 'clear', PKG]); } catch { /* ignore */ }
  sleep(500);
}
function deepLink(path) {
  adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
    '-d', `${SCHEME}://${path}`, PKG]);
}
function screenshot(tag) {
  const local = join(OUT, `${tag}.png`);
  try { adb(['exec-out', 'screencap', '-p', `> ${local}`]); } catch { /* ignore */ }
  return local;
}
function captureLogcat(tag) {
  const local = join(OUT, `${tag}-logcat.txt`);
  try { adb(['logcat', '-d', '-f', local]); } catch { /* ignore */ }
  return local;
}
function pullDb(tag) {
  const local = join(OUT, `${tag}-db.sqlite`);
  try {
    const buf = execFileSync('adb', ['-s', SERIAL, 'exec-out', 'run-as', PKG, 'cat',
      'files/SQLite/brain-training.db'], { maxBuffer: 64 * 1024 * 1024, encoding: 'buffer' });
    writeFileSync(local, buf);
  } catch { /* ignore */ }
  return local;
}
function queryDb(file, sql) {
  if (!existsSync(file) || !existsSync(SQLITE)) return null;
  try {
    const out = execFileSync(SQLITE, [file, sql], { encoding: 'utf8' });
    return out.trim();
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// wait helpers
// ---------------------------------------------------------------------------
async function waitFor(id, timeoutMs = 20000, tag = 'wait') {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const xml = readFileSyncSafe(dumpHierarchy(`${tag}-${Date.now() % 100000}`));
    if (xml && hasTestId(xml, id)) return xml;
    await sleep(1000);
  }
  return null;
}
function readFileSyncSafe(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }

// ---------------------------------------------------------------------------
// core game drive
// ---------------------------------------------------------------------------
async function flowGame(id, opts = {}) {
  const steps = [];
  const tag = `game-${id}`;
  const log = (s) => { steps.push(s); };
  reset();
  deepLink(`game/${id}`);
  let xml = await waitFor(`${id}.screen`, 25000, tag) || await waitFor(`${id}.intro`, 25000, tag);
  if (!xml) { return { id, passed: false, reason: 'screen did not load', steps, artifacts: artifacts(tag) }; }
  log('screen loaded');

  // Tutorial skip (first play).
  if (tapTestId(`${id}.tutorial-skip`, xml)) {
    await sleep(800);
    log('tutorial skipped');
    xml = readFileSyncSafe(dumpHierarchy(`${tag}-postskip`));
  } else { log('no tutorial (already completed or none)'); }

  // Start.
  if (!tapTestId(`${id}.start`, xml)) {
    // re-dump in case layout shifted
    xml = await waitFor(`${id}.start`, 8000, tag);
    if (!xml || !tapTestId(`${id}.start`, xml)) {
      return { id, passed: false, reason: 'start button not found', steps, artifacts: artifacts(tag) };
    }
  }
  log('started');
  await sleep(1500);

  // Optional pause/resume probe (where applicable).
  if (opts.pause) {
    const px = await waitFor(`${id}.pause`, 6000, tag);
    if (px) {
      tapTestId(`${id}.pause`, px);
      await sleep(800);
      const paused = await waitFor(`${id}.pause-overlay`, 5000, tag);
      log(paused ? 'paused + overlay shown' : 'paused (overlay testID not matched)');
      // resume so QA controls stay tappable (the opaque pause overlay otherwise covers them)
      const rp = await waitFor(`${id}.resume`, 4000, tag);
      if (rp) { tapTestId(`${id}.resume`, rp); await sleep(800); log('resumed'); }
    } else { log('no pause control (not applicable)'); }
  }

  // Open QA panel, force win.
  const qa = await waitFor(`${id}.qa-toggle`, 8000, tag);
  if (!qa) { return { id, passed: false, reason: 'qa-toggle not found (not a dev build?)', steps, artifacts: artifacts(tag) }; }
  tapTestId(`${id}.qa-toggle`, qa);
  await sleep(600);
  const panel = await waitFor(`${id}.qa-panel`, 5000, tag);
  if (!panel) { return { id, passed: false, reason: 'qa-panel did not open', steps, artifacts: artifacts(tag) }; }
  tapTestId(`${id}.force-win`, panel);
  log('force-win pressed');

  // Wait for results (in-game or app /results route).
  const results = await waitFor('results-title', 15000, tag)
    || await waitFor(`${id}.results`, 15000, tag)
    || await waitFor('results-score', 15000, tag);
  if (!results) { return { id, passed: false, reason: 'results not reached', steps, artifacts: artifacts(tag) }; }
  log('results reached');

  // Persistence: exactly one session for this game after a fresh reset.
  const db = pullDb(`${tag}-post`);
  const count = queryDb(db, `SELECT COUNT(*) FROM game_sessions WHERE game_id='${id}';`);
  const expectedOne = count === '1';
  log(`persisted sessions for ${id}: ${count}${expectedOne ? ' (OK)' : ' (EXPECTED 1)'}`);

  const passed = expectedOne;
  return {
    id, passed,
    reason: passed ? 'force-win + exactly one persisted session + authoritative results' : `session count=${count} expected 1`,
    steps, artifacts: artifacts(tag),
  };
}

// ---------------------------------------------------------------------------
// Word Match multi-round / multi-tier smoke (gate 3.6)
// ---------------------------------------------------------------------------
async function flowWordMatch() {
  const id = 'language-word-match';
  const tiers = ['easy', 'normal', 'hard', 'expert'];
  const results = [];
  for (const tier of tiers) {
    reset();
    deepLink(`game/${id}`);
    let xml = await waitFor(`${id}.screen`, 25000, `wm-${tier}`) || await waitFor(`${id}.intro`, 25000, `wm-${tier}`);
    if (!xml) { results.push({ tier, passed: false, reason: 'screen did not load' }); continue; }
    tapTestId(`${id}.tutorial-skip`, xml);
    await sleep(800);
    // Select difficulty if a selector exists.
    tapTestId(`${id}.difficulty-${tier}`, readFileSyncSafe(dumpHierarchy(`wm-${tier}-d`)));
    await sleep(400);
    tapTestId(`${id}.start`, readFileSyncSafe(dumpHierarchy(`wm-${tier}-s`)));
    await sleep(1200);
    // Drive 2-3 rounds via force-win to exercise multi-round flow.
    let rounds = 0;
    for (let r = 0; r < 3; r++) {
      const qa = await waitFor(`${id}.qa-toggle`, 8000, `wm-${tier}-r${r}`);
      if (!qa) break;
      tapTestId(`${id}.qa-toggle`, qa);
      await sleep(500);
      const panel = await waitFor(`${id}.qa-panel`, 4000, `wm-${tier}-r${r}`);
      if (!panel) break;
      tapTestId(`${id}.force-win`, panel);
      await sleep(1500);
      rounds++;
      // If round-result appears (multi-round), continue; else results reached.
      const cont = readFileSyncSafe(dumpHierarchy(`wm-${tier}-c${r}`));
      if (cont && hasTestId(cont, `${id}.next-round`)) {
        tapTestId(`${id}.next-round`, cont);
        await sleep(1200);
      } else if (cont && (hasTestId(cont, 'results-title') || hasTestId(cont, `${id}.results`))) {
        break;
      }
    }
    const fin = readFileSyncSafe(dumpHierarchy(`wm-${tier}-fin`));
    const ok = fin && (hasTestId(fin, 'results-title') || hasTestId(fin, `${id}.results`));
    results.push({ tier, passed: ok, rounds, reason: ok ? `tier ${tier}: ${rounds} rounds forced` : 'did not reach results' });
  }
  const passed = results.every((r) => r.passed);
  return { id: 'language-word-match (3.6)', passed, details: results, artifacts: artifacts('wordmatch') };
}

// ---------------------------------------------------------------------------
// Daily Workout 4/4 + interruption/resume (gates 6.8 / 12.7)
// ---------------------------------------------------------------------------
async function flowWorkout() {
  reset();
  launch();
  let home = await waitFor('home-workout-list', 20000, 'wk-home');
  if (!home) return { id: 'daily-workout (6.8/12.7)', passed: false, reason: 'Home workout list not found', details: [] };

  // Discover the 4 workout games in order.
  const ids = [];
  for (const m of home.match(/home-workout-game-([a-z0-9-]+)/g) || []) {
    ids.push(m.replace('home-workout-game-', ''));
  }
  const uniq = [...new Set(ids)];
  if (uniq.length !== 4) {
    return { id: 'daily-workout (6.8/12.7)', passed: false, reason: `expected 4 workout games, found ${uniq.length}`, details: uniq };
  }
  const order = uniq;
  const log = [];

  // Complete games 0..3 via results-next-game chain.
  for (let i = 0; i < 4; i++) {
    const gameId = order[i];
    // From Home, tap the workout row.
    home = readFileSyncSafe(dumpHierarchy('wk-loop-home'));
    if (!tapTestId(`home-workout-game-${gameId}`, home)) {
      // Maybe already inside results-next-game chain; if results-next-game exists use it.
      const r = readFileSyncSafe(dumpHierarchy('wk-loop-r'));
      if (hasTestId(r, 'results-next-game')) { tapTestId('results-next-game', r); }
      else { return { id: 'daily-workout', passed: false, reason: `could not enter game ${gameId}`, details: log }; }
    }
    await sleep(1500);
    let gxml = await waitFor(`${gameId}.screen`, 20000, `wk-g${i}`) || await waitFor(`${gameId}.intro`, 20000, `wk-g${i}`);
    if (!gxml) return { id: 'daily-workout', passed: false, reason: `game ${gameId} did not load`, details: log };
    tapTestId(`${gameId}.tutorial-skip`, gxml);
    await sleep(700);
    tapTestId(`${gameId}.start`, readFileSyncSafe(dumpHierarchy(`wk-g${i}-s`)));
    await sleep(1200);
    const qa = await waitFor(`${gameId}.qa-toggle`, 8000, `wk-g${i}-q`);
    if (!qa) return { id: 'daily-workout', passed: false, reason: `qa-toggle missing for ${gameId}`, details: log };
    tapTestId(`${gameId}.qa-toggle`, qa);
    await sleep(500);
    const panel = await waitFor(`${gameId}.qa-panel`, 4000, `wk-g${i}-p`);
    if (!panel) return { id: 'daily-workout', passed: false, reason: `qa-panel missing for ${gameId}`, details: log };
    tapTestId(`${gameId}.force-win`, panel);
    const res = await waitFor(i < 3 ? 'results-next-game' : 'results-workout-complete', 15000, `wk-g${i}-res`);
    if (!res) return { id: 'daily-workout', passed: false, reason: `results not reached for game ${i} (${gameId})`, details: log };
    log.push(`completed ${gameId} (${i + 1}/4)`);
    if (i < 3) tapTestId('results-next-game', res);
    await sleep(1500);
  }
  // 4/4 reached: results-workout-complete should be visible.
  const complete = readFileSyncSafe(dumpHierarchy('wk-complete'));
  const fourFour = complete && hasTestId(complete, 'results-workout-complete');
  log.push(fourFour ? '4/4 workout complete screen shown' : '4/4 complete screen NOT shown');

  // Interruption / relaunch resume probe: kill, relaunch, confirm persisted completion.
  adb(['shell', 'am', 'force-stop', PKG]);
  await sleep(1500);
  launch();
  const resumed = await waitFor('home-workout-list', 15000, 'wk-resume');
  let allDone = false;
  if (resumed) {
    for (const gameId of order) {
      const status = findTestId(resumed, `home-workout-game-status-${gameId}`);
      if (status && /done|complete/i.test(status.text)) allDone = true;
      else { allDone = false; break; }
    }
  }
  log.push(allDone ? 'relaunch: all 4 games marked Done (resume/persist OK)'
    : 'relaunch: completion status not uniformly Done (see hierarchy)');

  const passed = fourFour && allDone;
  return {
    id: 'daily-workout (6.8/12.7)', passed,
    reason: passed ? '4/4 completed + relaunch shows persisted completion' : 'see log',
    details: log, artifacts: artifacts('workout'),
  };
}

// ---------------------------------------------------------------------------
// reporting
// ---------------------------------------------------------------------------
function artifacts(tag) {
  return {
    hierarchy: join(OUT, `${tag}-hier.xml`),
    screenshot: join(OUT, `${tag}.png`),
    db: join(OUT, `${tag}-db.sqlite`),
  };
}
function writeReport(name, data) {
  mkdirSync(OUT, { recursive: true });
  const json = join(OUT, `${name}-report.json`);
  writeFileSync(json, JSON.stringify(data, null, 2));
  return json;
}
function summaryLine(r) {
  const status = r.passed ? 'PASS' : (r.reason ? 'FAIL' : 'NOT VALIDATED');
  return `[${status}] ${r.id}${r.reason ? ' — ' + r.reason : ''}`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
async function main() {
  mkdirSync(OUT, { recursive: true });
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const mode = get('--mode', 'all');
  const onlyGame = get('--game', null);
  const pause = args.includes('--pause');
  const report = { device: SERIAL, pkg: PKG, scheme: SCHEME, startedAt: new Date().toISOString(), results: [] };

  if (mode === 'game' || mode === 'all') {
    const list = onlyGame ? [onlyGame] : GAMES;
    for (const g of list) report.results.push(await flowGame(g, { pause }));
  }
  if (mode === 'wordmatch' || mode === 'all') report.results.push(await flowWordMatch());
  if (mode === 'workout' || mode === 'all') report.results.push(await flowWorkout());
  if (mode === 'canaries' || mode === 'all') {
    for (const [cat, g] of Object.entries(CATEGORIES)) report.results.push(await flowGame(g, { pause }));
  }

  report.endedAt = new Date().toISOString();
  report.passed = report.results.filter((r) => r.passed).length;
  report.failed = report.results.filter((r) => !r.passed).length;
  const json = writeReport('qa', report);
  console.log(`\n=== Autobot QA report (${report.passed} PASS / ${report.failed} FAIL) ===`);
  for (const r of report.results) console.log(summaryLine(r));
  console.log(`Report: ${json}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
