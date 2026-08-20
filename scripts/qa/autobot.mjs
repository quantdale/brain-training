// Autobot — autonomous, emulator-local QA harness for brain-training.
//
// Design goals (constitution §28/§29, AGENTS.md "QA instrumentation"):
//  - One dedicated AVD; no host mouse/keyboard; no desktop focus theft.
//  - Drives the app purely through ADB + UI hierarchy + semantic testIDs.
//  - Deep-links directly to games; uses dev-only QA force-state hooks.
//  - Captures hierarchy dumps, logcat, screenshots, and the app DB.
//  - Emits structured per-game PASS/FAIL/NOT VALIDATED results + an
//    action trace for deterministic diagnosis.
//
// Only Node built-ins + the platform `adb`/`sqlite3` are used, so this runs
// without installing any npm dependencies. An offline `--self-test` mode
// exercises the pure parsing/selection/report logic with fixture XML, so the
// harness is CI-testable without an emulator.
//
// Usage:
//   node scripts/qa/autobot.mjs --mode game --game memory
//   node scripts/qa/autobot.mjs --mode game --game memory --pause
//   node scripts/qa/autobot.mjs --mode catalog
//   node scripts/qa/autobot.mjs --mode wordmatch
//   node scripts/qa/autobot.mjs --mode workout
//   node scripts/qa/autobot.mjs --mode all --pause
//   node scripts/qa/autobot.mjs --mode canaries
//   node scripts/qa/autobot.mjs --category Memory          # one category
//   node scripts/qa/autobot.mjs --list-games
//   node scripts/qa/autobot.mjs --self-test                # offline logic tests
//
// Env overrides:
//   QA_DEVICE   adb serial (default: first emulator-*)
//   QA_PKG      application id (default: com.braintraining.app)
//   QA_SCHEME   deep-link scheme (default: braintraining)
//   QA_OUT      artifact root (default: qa-artifacts)
//   QA_SQLITE   path to sqlite3 binary (default: $ANDROID_HOME/.../sqlite3.exe)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const PKG = process.env.QA_PKG || 'com.braintraining.app';
const SCHEME = process.env.QA_SCHEME || 'braintraining';
const OUT = process.env.QA_OUT || join(REPO_ROOT, 'qa-artifacts');
const SERIAL = (process.env.QA_DEVICE || firstEmulator()).trim();
const SQLITE = process.env.QA_SQLITE
  || join(process.env.ANDROID_HOME || '', 'platform-tools', 'sqlite3.exe');

// Canonical 24-game catalog (kept in sync with apps/mobile/src/registry via
// `node scripts/generate-game-registry.mjs`). This is the QA harness's own
// smoke list, not the product registry — it intentionally mirrors the catalog
// so every shipped game gets a deep-link smoke pass.
const GAMES = [
  'attention-odd-one-out', 'attention-target-count', 'attention-visual-search',
  'flexibility-card-sort', 'flexibility-color-stroop', 'flexibility-cue-shift',
  'language-sentence-builder', 'language-word-match', 'language-word-scramble',
  'logic-code-cracker', 'logic-next-sequence', 'logic-rule-grid',
  'math-equation-builder', 'math-fast-math', 'math-missing-operator',
  'memory', 'memory-pattern-tap-back', 'memory-sequence-memory',
  'spatial-grid-nav', 'spatial-mental-rotation', 'spatial-transform-match',
  'speed-color-match', 'speed-reaction-time', 'speed-tap-rush',
];
const CATEGORIES = {
  Memory: ['memory', 'memory-pattern-tap-back', 'memory-sequence-memory'],
  Attention: ['attention-odd-one-out', 'attention-target-count', 'attention-visual-search'],
  Speed: ['speed-tap-rush', 'speed-reaction-time', 'speed-color-match'],
  Math: ['math-fast-math', 'math-equation-builder', 'math-missing-operator'],
  Language: ['language-word-match', 'language-sentence-builder', 'language-word-scramble'],
  Logic: ['logic-next-sequence', 'logic-code-cracker', 'logic-rule-grid'],
  Flexibility: ['flexibility-card-sort', 'flexibility-color-stroop', 'flexibility-cue-shift'],
  Spatial: ['spatial-transform-match', 'spatial-mental-rotation', 'spatial-grid-nav'],
};
// One representative per category for the lightweight "canaries" mode.
const CANARIES = {
  Memory: 'memory', Attention: 'attention-odd-one-out', Speed: 'speed-tap-rush',
  Math: 'math-fast-math', Language: 'language-word-match', Logic: 'logic-next-sequence',
  Flexibility: 'flexibility-card-sort', Spatial: 'spatial-transform-match',
};

// Home testIDs that prove the JS bundle finished loading and the React
// navigation context is ready. We must reach one of these BEFORE deep-linking,
// otherwise the flow blanks. The Bridgeless dev runtime drops a deep-link
// intent delivered before the context is ready ("onNewIntent while context is
// not ready"), so warming Home first is mandatory.
const HOME_READY_IDS = ['home-brand', 'home-title', 'home-workout-list'];

// ---------------------------------------------------------------------------
// Action trace (structured, deterministic diagnosis)
// ---------------------------------------------------------------------------
const TRACE = [];
function trace(action, target, ok, detail) {
  const entry = { t: new Date().toISOString(), action, target: target ?? null, ok: !!ok, detail: detail ?? null };
  TRACE.push(entry);
  return entry;
}
function traceMs(start) { return Date.now() - start; }

// ---------------------------------------------------------------------------
// adb helpers (with bounded retry on transient transport errors)
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
function adbRetry(args, { tries = 3, intervalMs = 1000, opts = {} } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return adb(args, opts); }
    catch (e) { lastErr = e; if (/device offline|closed|transport/.test(String(e))) { sleep(intervalMs); continue; } throw e; }
  }
  throw lastErr;
}
function shell(cmd) { return adb(['shell', cmd]); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Hierarchy parsing (PURE — exercised by --self-test)
// ---------------------------------------------------------------------------
function parseBounds(bounds) {
  const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return null;
  const x1 = +m[1], y1 = +m[2], x2 = +m[3], y2 = +m[4];
  return { x1, y1, x2, y2, cx: Math.round((x1 + x2) / 2), cy: Math.round((y1 + y2) / 2) };
}
// RN Android renders `testID` as the node `resource-id`. We also accept
// `content-desc` and a literal `testID` attribute for cross-version robustness.
function findTestId(xml, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const attr of ['resource-id', 'testID', 'content-desc']) {
    const re = new RegExp(`${attr}="${escaped}"([^>]*)`);
    const m = xml ? xml.match(re) : null;
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
function centerOf(node) { return node && node.bounds ? { cx: node.bounds.cx, cy: node.bounds.cy } : null; }

// ---------------------------------------------------------------------------
// Artifact capture (writes real files; returns paths for the report)
// ---------------------------------------------------------------------------
let RUN_DIR = OUT;
let ART = { hierarchy: 'hierarchy', screenshots: 'screenshots', logcat: 'logcat', db: 'db' };
function initRunDir(mode) {
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const runId = `${ts}-autobot-${mode}`;
  RUN_DIR = join(OUT, runId);
  ART = {
    hierarchy: join(RUN_DIR, 'hierarchy'),
    screenshots: join(RUN_DIR, 'screenshots'),
    logcat: join(RUN_DIR, 'logcat'),
    db: join(RUN_DIR, 'db'),
  };
  for (const d of Object.values(ART)) mkdirSync(d, { recursive: true });
  return runId;
}
// uiautomator occasionally returns an empty/error dump during animations or
// while the device is not idle ("ERROR: could not get idle state",
// "null root node returned by UiTestAutomationBridge"). Treat those as
// transient: retry the dump and skip empty/error content so a stale or blank
// file is never mistaken for "element absent".
const DUMP_ERROR_RE = /ERROR:|null root node|UiTestAutomationBridge/i;
function dumpIsUsable(xml) { return !!xml && xml.includes('<node') && !DUMP_ERROR_RE.test(xml); }
function dumpHierarchy(tag) {
  const local = join(ART.hierarchy, `${tag}.xml`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      adbRetry(['shell', 'uiautomator', 'dump', '/sdcard/qa-hier.xml'], { tries: 2 });
      adbRetry(['pull', '/sdcard/qa-hier.xml', local], { tries: 2 });
      const xml = readFileSyncSafe(local);
      if (dumpIsUsable(xml)) return local;
    } catch (e) {
      trace('hierarchy.dump', tag, false, String(e).slice(0, 80));
    }
    sleep(400);
  }
  // Fallback: stream straight to stdout (no intermediate device file).
  try {
    const xml = adb(['exec-out', 'uiautomator', 'dump', '/dev/tty']);
    if (dumpIsUsable(xml)) { writeFileSync(local, xml); return local; }
  } catch { /* ignore */ }
  return local; // may be empty/error; callers still verify content
}
function screenshot(tag) {
  const local = join(ART.screenshots, `${tag}.png`);
  try {
    // `adb exec-out screencap -p` writes a PNG to stdout; capture it directly
    // rather than relying on a shell redirect (which the original passed as an
    // adb argument and was silently ignored).
    const buf = adbRetry(['exec-out', 'screencap', '-p'], { tries: 2, opts: { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 } });
    writeFileSync(local, buf);
  } catch { /* ignore */ }
  return local;
}
function captureLogcat(tag) {
  const local = join(ART.logcat, `${tag}.txt`);
  try {
    // Capture logcat to stdout and persist it; `-f <path>` would write on the
    // device, not the host, so we buffer instead.
    const out = adbRetry(['logcat', '-d'], { tries: 2, opts: { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 } });
    writeFileSync(local, out);
  } catch { /* ignore */ }
  return local;
}
function pullDb(tag) {
  const local = join(ART.db, `${tag}.sqlite`);
  try {
    const buf = execFileSync('adb', ['-s', SERIAL, 'exec-out', 'run-as', PKG, 'cat',
      'files/SQLite/brain-training.db'], { maxBuffer: 64 * 1024 * 1024, encoding: 'buffer' });
    writeFileSync(local, buf);
  } catch { /* leave absent */ }
  return local;
}
function queryDb(file, sql) {
  if (!existsSync(file) || !existsSync(SQLITE)) return null;
  try { return execFileSync(SQLITE, [file, sql], { encoding: 'utf8' }).trim(); }
  catch { return null; }
}
// Count persisted sessions for a game and flag duplicates (a regression class:
// a fresh reset + single force-win must yield exactly one row for the game).
function sessionStats(gameId) {
  const db = pullDb(`${gameId}-post`);
  if (!existsSync(db)) return { db: db, count: null, duplicates: false, note: 'db not pulled' };
  const count = queryDb(db, `SELECT COUNT(*) FROM game_sessions WHERE game_id='${gameId}';`);
  const rows = queryDb(db, `SELECT seed, generator_version FROM game_sessions WHERE game_id='${gameId}';`);
  const seeds = (rows || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const uniq = new Set(seeds);
  return {
    db,
    count: count == null ? null : Number(count),
    duplicates: seeds.length > uniq.size,
    note: count === '1' ? 'exactly one (OK)' : `count=${count}${seeds.length > uniq.size ? ' DUPLICATE SEEDS' : ''}`,
  };
}

// ---------------------------------------------------------------------------
// Wait helpers (state-based, not arbitrary sleeps)
// ---------------------------------------------------------------------------
function readFileSyncSafe(p) { try { return readFileSync(p, 'utf8'); } catch { return null; } }
async function waitFor(id, timeoutMs = 20000, tag = 'wait') {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const p = dumpHierarchy(`${tag}-${Date.now() % 100000}`);
    const xml = readFileSyncSafe(p);
    // Skip transient/empty dumps (animation, not-idle) rather than concluding
    // the element is absent from a stale file.
    if (xml && !DUMP_ERROR_RE.test(xml) && hasTestId(xml, id)) return xml;
    await sleep(750);
  }
  return null;
}
async function waitForAny(ids, timeoutMs = 20000, tag = 'waitAny') {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const p = dumpHierarchy(`${tag}-${Date.now() % 100000}`);
    const xml = readFileSyncSafe(p);
    if (xml && !DUMP_ERROR_RE.test(xml)) {
      for (const id of ids) if (hasTestId(xml, id)) return { id, xml };
    }
    await sleep(750);
  }
  return null;
}
// Wait for a stable home screen (bundle loaded, nav context ready).
async function waitForHome(timeoutMs = 40000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const p = dumpHierarchy('home-warm');
    const xml = readFileSyncSafe(p);
    if (xml && !DUMP_ERROR_RE.test(xml) && HOME_READY_IDS.some((id) => hasTestId(xml, id))) return xml;
    await sleep(1000);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Device lifecycle
// ---------------------------------------------------------------------------
// Disable system animations so `uiautomator dump` does not block waiting for
// the UI to go idle. Heavily-animated games (e.g. speed/spatial/attention)
// otherwise keep the accessibility service from ever reporting idle, causing
// every hierarchy dump to error ("could not get idle state") during gameplay
// and hiding perfectly-present semantic nodes from the harness. This mirrors
// Espresso's DisableAnimationsRule and is emulator-local + reversible on
// reboot.
function disableAnimations() {
  for (const key of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
    try { adb(['shell', 'settings', 'put', 'global', key, '0']); } catch { /* ignore */ }
  }
}
function launch() { adb(['shell', 'am', 'start', '-n', `${PKG}/.MainActivity`]); }
function reset() {
  disableAnimations();
  adb(['shell', 'am', 'force-stop', PKG]);
  sleep(500);
  try { adb(['shell', 'pm', 'clear', PKG]); } catch { /* ignore */ }
  sleep(500);
}
function deepLink(path) {
  adb(['shell', 'am', 'start', '-W', '-a', 'android.intent.action.VIEW',
    '-d', `${SCHEME}://${path}`, PKG]);
}
// Warm the app: if the home screen isn't already ready (cold start / dropped
// deep-link), launch Home and wait for the bundle to finish loading. This MUST
// run before any deep-link to avoid the Bridgeless "context not ready" gap.
async function ensureWarmHome() {
  const p = dumpHierarchy('home-check');
  const xml = readFileSyncSafe(p);
  if (xml && HOME_READY_IDS.some((id) => hasTestId(xml, id))) return true;
  launch();
  const ready = await waitForHome();
  return !!ready;
}
function tap(node) {
  if (!node || !node.bounds) return false;
  shell(`input tap ${node.bounds.cx} ${node.bounds.cy}`);
  return true;
}
function tapTestId(id, xml) {
  const node = xml ? findTestId(xml, id) : null;
  if (!node || !node.bounds) { trace('tap', id, false, 'node not found'); return false; }
  tap(node);
  trace('tap', id, true, `${node.bounds.cx},${node.bounds.cy}`);
  return true;
}

// ---------------------------------------------------------------------------
// Core game drive
// ---------------------------------------------------------------------------
async function flowGame(id, opts = {}) {
  const steps = [];
  const tag = `game-${id}`;
  const t0 = Date.now();
  reset();
  const warm = await ensureWarmHome();
  log(`warmed home: ${warm ? 'yes' : 'NO (deep-link may blank)'}`);
  if (!warm) {
    return { id, passed: false, reason: 'app did not warm to home (Metro/JS load)', steps, ms: traceMs(t0), artifacts: captureAll(tag), trace: traceSlice() };
  }

  deepLink(`game/${id}`);
  let xml = await waitFor(`${id}.screen`, 25000, tag) || await waitFor(`${id}.intro`, 25000, tag);
  if (!xml) { captureAll(tag); return fail(id, 'screen did not load', steps, t0, tag); }
  log('screen loaded');
  screenshot(`${tag}-screen`);

  // Tutorial skip (first play).
  if (tapTestId(`${id}.tutorial-skip`, xml)) {
    await sleep(700);
    xml = readFileSyncSafe(dumpHierarchy(`${tag}-postskip`));
    log('tutorial skipped');
  } else { log('no tutorial (already completed or none)'); }

  // Start.
  if (!tapTestId(`${id}.start`, xml)) {
    xml = await waitFor(`${id}.start`, 8000, tag);
    if (!xml || !tapTestId(`${id}.start`, xml)) {
      captureAll(tag); return fail(id, 'start button not found', steps, t0, tag);
    }
  }
  log('started');
  await sleep(400);

  // Optional pause/resume probe.
  if (opts.pause) {
    const px = await waitFor(`${id}.pause`, 6000, tag);
    if (px) {
      tapTestId(`${id}.pause`, px);
      await sleep(700);
      const paused = await waitFor(`${id}.pause-overlay`, 5000, tag);
      log(paused ? 'paused + overlay shown' : 'paused (overlay testID not matched)');
      const rp = await waitFor(`${id}.resume`, 4000, tag);
      if (rp) { tapTestId(`${id}.resume`, rp); await sleep(700); log('resumed'); }
    } else { log('no pause control (not applicable)'); }
  }

  // Open QA panel and force win. Some games only expose the QA toggle during
  // a specific in-session phase (e.g. a brief "study" phase before the choice
  // phase unmounts the panel), so poll the toggle→panel→force-win sequence in
  // a loop until results appear rather than assuming a single fixed wait.
  const results = await driveForceWin(id, tag);
  if (!results) { captureAll(tag); return fail(id, 'qa-toggle/force-win not reachable (qa panel may be phase-gated)', steps, t0, tag); }
  log(`results reached via ${results.id}`);
  screenshot(`${tag}-results`);

  // Persistence: exactly one session for this game after a fresh reset.
  const stats = sessionStats(id);
  log(`persistence: ${stats.note}`);
  captureLogcat(`${tag}-logcat`);

  const passed = stats.count === 1 && !stats.duplicates;
  return {
    id, passed,
    reason: passed ? 'force-win + exactly one persisted session + authoritative results'
      : `session count=${stats.count} (expected 1), duplicates=${stats.duplicates}`,
    steps, ms: traceMs(t0), artifacts: captureAll(tag), session: stats, trace: traceSlice(),
  };
}
function log(_s) { /* steps are recorded via trace; keep a local echo for clarity */ }

// Poll the QA toggle → panel → force-win sequence until results appear.
// Returns the matching results node (with `.id`) or null on timeout. This is
// resilient to games whose QA panel is only mounted during certain play
// phases: it taps force-win the moment the toggle is observable.
// One best-effort attempt at toggle → panel → force-win. Returns true if the
// force-win tap was issued (panel opened), false if the toggle was not
// currently reachable (e.g. the QA panel is phase-gated this frame).
async function tapForceWinOnce(id, tag) {
  const qa = await waitFor(`${id}.qa-toggle`, 3000, `${tag}-fw`);
  if (!qa) return false;
  tapTestId(`${id}.qa-toggle`, qa);
  await sleep(400);
  const panel = await waitFor(`${id}.qa-panel`, 3000, `${tag}-fw`);
  if (!panel) return false;
  tapTestId(`${id}.force-win`, panel);
  log('force-win pressed');
  return true;
}
// Poll the QA toggle → panel → force-win sequence until results appear.
async function driveForceWin(id, tag) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (tapForceWinOnce(id, tag)) {
      await sleep(800);
      const res = await waitForAny(['results-title', `${id}.results`, 'results-score'], 4000, `${tag}-fw`);
      if (res) return res;
    }
    await sleep(500);
  }
  return null;
}

function fail(id, reason, steps, t0, tag) {
  return { id, passed: false, reason, steps, ms: traceMs(t0), artifacts: captureAll(tag), trace: traceSlice() };
}
function traceSlice() { return TRACE.slice(-12).map((e) => `${e.action}:${e.target}:${e.ok ? 'ok' : 'FAIL'}`); }
function captureAll(tag) {
  return {
    hierarchyScreen: join(ART.hierarchy, `${tag}-screen.xml`),
    hierarchyFail: join(ART.hierarchy, `${tag}-hier.xml`),
    screenshot: join(ART.screenshots, `${tag}.png`),
    db: join(ART.db, `${tag}-db.sqlite`),
    logcat: join(ART.logcat, `${tag}-logcat.txt`),
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
    const t0 = Date.now();
    reset();
    if (!(await ensureWarmHome())) { results.push({ tier, passed: false, reason: 'app did not warm' }); continue; }
    deepLink(`game/${id}`);
    const xml = await waitFor(`${id}.screen`, 25000, `wm-${tier}`) || await waitFor(`${id}.intro`, 25025, `wm-${tier}`);
    if (!xml) { results.push({ tier, passed: false, reason: 'screen did not load', ms: traceMs(t0) }); continue; }
    tapTestId(`${id}.tutorial-skip`, xml);
    await sleep(700);
    tapTestId(`${id}.difficulty-${tier}`, readFileSyncSafe(dumpHierarchy(`wm-${tier}-d`)));
    await sleep(400);
    tapTestId(`${id}.start`, readFileSyncSafe(dumpHierarchy(`wm-${tier}-s`)));
    await sleep(1200);
    let rounds = 0;
    for (let r = 0; r < 3; r++) {
      if (!tapForceWinOnce(id, `wm-${tier}-r${r}`)) break;
      await sleep(1400);
      rounds++;
      const cont = readFileSyncSafe(dumpHierarchy(`wm-${tier}-c${r}`));
      if (cont && hasTestId(cont, `${id}.next-round`)) {
        tapTestId(`${id}.next-round`, cont);
        await sleep(1100);
      } else if (cont && (hasTestId(cont, 'results-title') || hasTestId(cont, `${id}.results`))) {
        break;
      }
    }
    const fin = readFileSyncSafe(dumpHierarchy(`wm-${tier}-fin`));
    const ok = fin && (hasTestId(fin, 'results-title') || hasTestId(fin, `${id}.results`));
    results.push({ tier, passed: ok, rounds, reason: ok ? `tier ${tier}: ${rounds} rounds forced` : 'did not reach results', ms: traceMs(t0) });
  }
  const passed = results.every((r) => r.passed);
  return { id: 'language-word-match (3.6)', passed, details: results, artifacts: captureAll('wordmatch'), trace: traceSlice() };
}

// ---------------------------------------------------------------------------
// Daily Workout 4/4 + interruption/resume (gates 6.8 / 12.7)
// ---------------------------------------------------------------------------
async function flowWorkout() {
  const t0 = Date.now();
  reset();
  if (!(await ensureWarmHome())) return { id: 'daily-workout (6.8/12.7)', passed: false, reason: 'app did not warm to home', details: [], ms: traceMs(t0), artifacts: captureAll('workout'), trace: traceSlice() };
  let home = await waitFor('home-workout-list', 20000, 'wk-home');
  if (!home) return { id: 'daily-workout (6.8/12.7)', passed: false, reason: 'Home workout list not found', details: [], ms: traceMs(t0), artifacts: captureAll('workout'), trace: traceSlice() };

  const ids = [];
  for (const m of home.match(/home-workout-game-([a-z0-9-]+)/g) || []) ids.push(m.replace('home-workout-game-', ''));
  const uniq = [...new Set(ids)];
  if (uniq.length !== 4) {
    return { id: 'daily-workout (6.8/12.7)', passed: false, reason: `expected 4 workout games, found ${uniq.length}`, details: uniq, ms: traceMs(t0), artifacts: captureAll('workout'), trace: traceSlice() };
  }
  const order = uniq;
  const log = [];

  for (let i = 0; i < 4; i++) {
    const gameId = order[i];
    home = readFileSyncSafe(dumpHierarchy('wk-loop-home'));
    if (!tapTestId(`home-workout-game-${gameId}`, home)) {
      const r = readFileSyncSafe(dumpHierarchy('wk-loop-r'));
      if (hasTestId(r, 'results-next-game')) tapTestId('results-next-game', r);
      else return { id: 'daily-workout', passed: false, reason: `could not enter game ${gameId}`, details: log, ms: traceMs(t0), artifacts: captureAll('workout'), trace: traceSlice() };
    }
    await sleep(1400);
    const gxml = await waitFor(`${gameId}.screen`, 20000, `wk-g${i}`) || await waitFor(`${gameId}.intro`, 20000, `wk-g${i}`);
    if (!gxml) return { id: 'daily-workout', passed: false, reason: `game ${gameId} did not load`, details: log, ms: traceMs(t0), artifacts: captureAll('workout'), trace: traceSlice() };
    tapTestId(`${gameId}.tutorial-skip`, gxml);
    await sleep(700);
    tapTestId(`${gameId}.start`, readFileSyncSafe(dumpHierarchy(`wk-g${i}-s`)));
    await sleep(1200);
    if (!tapForceWinOnce(gameId, `wk-g${i}`)) return { id: 'daily-workout', passed: false, reason: `qa-toggle/force-win not reachable for ${gameId}`, details: log, ms: traceMs(t0), artifacts: captureAll('workout'), trace: traceSlice() };
    const res = await waitFor(i < 3 ? 'results-next-game' : 'results-workout-complete', 15000, `wk-g${i}-res`);
    if (!res) return { id: 'daily-workout', passed: false, reason: `results not reached for game ${i} (${gameId})`, details: log, ms: traceMs(t0), artifacts: captureAll('workout'), trace: traceSlice() };
    log.push(`completed ${gameId} (${i + 1}/4)`);
    if (i < 3) tapTestId('results-next-game', res);
    await sleep(1400);
  }

  const complete = readFileSyncSafe(dumpHierarchy('wk-complete'));
  const fourFour = complete && hasTestId(complete, 'results-workout-complete');
  log.push(fourFour ? '4/4 workout complete screen shown' : '4/4 complete screen NOT shown');

  // Interruption / relaunch resume probe.
  adb(['shell', 'am', 'force-stop', PKG]);
  await sleep(1500);
  launch();
  const resumed = await waitForHome();
  let allDone = false;
  if (resumed) {
    const statuses = resumed.match(/home-workout-game-status-([a-z0-9-]+)/g) || [];
    allDone = statuses.length > 0;
    for (const m of statuses) {
      const gid = m.replace('home-workout-game-status-', '');
      const node = findTestId(resumed, `home-workout-game-status-${gid}`);
      if (!node || !/done|complete/i.test(node.text || '')) { allDone = false; break; }
    }
  }
  log.push(allDone ? 'relaunch: all 4 games marked Done (resume/persist OK)' : 'relaunch: completion status not uniformly Done (see hierarchy)');
  captureAll('workout');

  const passed = fourFour && allDone;
  return {
    id: 'daily-workout (6.8/12.7)', passed,
    reason: passed ? '4/4 completed + relaunch shows persisted completion' : 'see log',
    details: log, ms: traceMs(t0), artifacts: captureAll('workout'), trace: traceSlice(),
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function summaryLine(r) {
  const status = r.passed ? 'PASS' : (r.reason ? 'FAIL' : 'NOT VALIDATED');
  return `[${status}] ${r.id}${r.reason ? ' — ' + r.reason : ''}`;
}
function writeRunJson(_runId, data) {
  mkdirSync(RUN_DIR, { recursive: true });
  const tmp = join(RUN_DIR, 'run.json.tmp');
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, join(RUN_DIR, 'run.json')); // atomic: a missing run.json == incomplete run
}

// ---------------------------------------------------------------------------
// Offline self-test (no emulator required)
// ---------------------------------------------------------------------------
function selfTest() {
  const xml = [
    '<node resource-id="memory.screen" bounds="[0,0][100,100]" text="Memory"/>',
    '<node resource-id="home-brand" bounds="[10,10][50,50]" text="Brain"/>',
    '<node content-desc="results-title" bounds="[0,200][300,260]" text="Results"/>',
    '<node resource-id="game-id-2" bounds="[0,0][40,40]" text="x"/>',
  ].join('');
  const checks = [];
  const assert = (name, cond, detail) => checks.push({ name, pass: !!cond, detail: detail ?? null });

  const b = parseBounds('[10,20][110,220]');
  assert('parseBounds', b && b.cx === 60 && b.cy === 120, JSON.stringify(b));
  assert('findTestId resource-id', !!findTestId(xml, 'memory.screen'));
  assert('findTestId content-desc', !!findTestId(xml, 'results-title'));
  assert('hasTestId negative', !hasTestId(xml, 'nope'));
  const c = centerOf(findTestId(xml, 'memory.screen'));
  assert('centerOf', c && c.cx === 50 && c.cy === 50, JSON.stringify(c));
  const seeds = ['a|1', 'a|1', 'b|1'];
  assert('duplicate seeds detected', new Set(seeds).size !== seeds.length);
  assert('catalog has 24 games', GAMES.length === 24, String(GAMES.length));
  assert('catalog unique', new Set(GAMES).size === GAMES.length);
  for (const [cat, list] of Object.entries(CATEGORIES)) {
    assert(`category ${cat} has 3`, list.length === 3, String(list.length));
    assert(`category ${cat} in catalog`, list.every((g) => GAMES.includes(g)));
  }
  assert('canaries in catalog', Object.values(CANARIES).every((g) => GAMES.includes(g)));

  const passed = checks.every((c) => c.pass);
  const report = { selfTest: true, passed, checks };
  writeFileSync(join(OUT, 'autobot-self-test.json'), JSON.stringify(report, null, 2));
  for (const c of checks) console.log(`[${c.pass ? 'PASS' : 'FAIL'}] ${c.name}${c.detail ? ' — ' + c.detail : ''}`);
  console.log(`Self-test: ${checks.filter((c) => c.pass).length}/${checks.length} passed`);
  return passed;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const mode = get('--mode', 'all');
  const onlyGame = get('--game', null);
  const category = get('--category', null);
  const pause = args.includes('--pause');
  const listGames = args.includes('--list-games');
  const self = args.includes('--self-test');
  const exitNonZero = args.includes('--exit-nonzero-on-fail') || !args.includes('--exit-zero');

  if (self) { process.exit(selfTest() ? 0 : 1); }
  // Animation-disabled dumps are reliable across every game (see disableAnimations).
  disableAnimations();
  if (listGames) {
    console.log(GAMES.join('\n'));
    if (category) console.log(`\nCategory ${category}: ${(CATEGORIES[category] || []).join(', ')}`);
    process.exit(0);
  }

  const runId = initRunDir(mode);
  mkdirSync(OUT, { recursive: true });
  const report = {
    runId, device: SERIAL, pkg: PKG, scheme: SCHEME, mode,
    startedAt: new Date().toISOString(), results: [],
  };

  let list = GAMES;
  if (onlyGame) list = [onlyGame];
  else if (category && CATEGORIES[category]) list = CATEGORIES[category];
  if (args.includes('--canaries-only')) list = Object.values(CANARIES);

  if (mode === 'game' || mode === 'all' || mode === 'catalog') {
    for (const g of list) report.results.push(await flowGame(g, { pause }));
  }
  if (mode === 'wordmatch' || mode === 'all') report.results.push(await flowWordMatch());
  if (mode === 'workout' || mode === 'all') report.results.push(await flowWorkout());
  if (mode === 'canaries' || mode === 'all') {
    for (const g of Object.values(CANARIES)) {
      if (!report.results.some((r) => r.id === g)) report.results.push(await flowGame(g, { pause }));
    }
  }

  report.endedAt = new Date().toISOString();
  report.passed = report.results.filter((r) => r.passed).length;
  report.failed = report.results.filter((r) => !r.passed).length;
  report.artifactsDir = RUN_DIR;

  writeRunJson(runId, report);
  console.log(`\n=== Autobot QA report (${report.passed} PASS / ${report.failed} FAIL) ===`);
  for (const r of report.results) console.log(summaryLine(r));
  console.log(`Run dir: ${RUN_DIR}`);
  console.log(`Report: ${join(RUN_DIR, 'run.json')}`);

  if (exitNonZero && report.failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
