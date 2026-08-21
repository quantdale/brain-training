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
// The game catalog is DERIVED, never hardcoded: `loadCatalog()` scans
// `apps/mobile/src/games/*/game.json` and cross-checks the ids against
// `apps/mobile/src/registry/registry.generated.ts`, so this harness scales
// automatically as the catalog grows. A documented canary subset (one stable
// representative per primary category) backs the quick `--mode canaries` run.
//
// Exit codes: 0 = requested checks all PASS; 1 = at least one FAIL (or a
// catalog/self-test assertion failed); 2 = BLOCKED (no usable adb device —
// every planned target is reported NOT VALIDATED, never faked green).
//
// Usage:
//   node scripts/qa/autobot.mjs --mode game --game memory
//   node scripts/qa/autobot.mjs --mode game --game memory --pause
//   node scripts/qa/autobot.mjs --mode catalog
//   node scripts/qa/autobot.mjs --mode wordmatch
//   node scripts/qa/autobot.mjs --mode workout
//   node scripts/qa/autobot.mjs --mode all --pause
//   node scripts/qa/autobot.mjs --mode canaries
//   node scripts/qa/autobot.mjs --category "Logic & Problem Solving"  # one category
//   node scripts/qa/autobot.mjs --list-games
//   node scripts/qa/autobot.mjs --self-test                # offline logic tests
//
// Env overrides:
//   QA_DEVICE   adb serial (default: first emulator-* in `device` state)
//   QA_PKG      application id (default: com.braintraining.app)
//   QA_SCHEME   deep-link scheme (default: braintraining)
//   QA_OUT      artifact root (default: qa-artifacts)
//   QA_SQLITE   path to sqlite3 binary (default: $ANDROID_HOME/.../sqlite3.exe)

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  renameSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const GAMES_DIR = join(REPO_ROOT, "apps", "mobile", "src", "games");
const REGISTRY_TS = join(
  REPO_ROOT,
  "apps",
  "mobile",
  "src",
  "registry",
  "registry.generated.ts",
);

const PKG = process.env.QA_PKG || "com.braintraining.app";
const SCHEME = process.env.QA_SCHEME || "braintraining";
const OUT = process.env.QA_OUT || join(REPO_ROOT, "qa-artifacts");
const SQLITE =
  process.env.QA_SQLITE ||
  join(process.env.ANDROID_HOME || "", "platform-tools", "sqlite3.exe");

// Game screens are lazy-loaded (`gameScreenLoaders` dynamic imports). Metro
// builds each game's chunk on first request; on a cold transform cache under
// heavy host load a single chunk took ~246s (1451 modules), which silently
// exceeded the old fixed 25s budget and masqueraded as a product failure
// ("screen did not load"). Budgets are env-tunable so constrained hosts can
// tighten them without code edits. Run `--mode warm-bundles` first to move
// the one-time build cost out of timed runs entirely.
const SCREEN_BUDGET_MS = Number(process.env.QA_SCREEN_BUDGET_MS || 120000);
const NEXT_BUDGET_MS = Number(process.env.QA_NEXT_BUDGET_MS || 60000);

// ---------------------------------------------------------------------------
// Catalog derivation (PURE-ish: filesystem only, no adb — exercised by
// --self-test and required by --list-games, both of which must work offline)
// ---------------------------------------------------------------------------
// Stable canary representatives (one per primary category) kept from the
// original hand-maintained list. If a category ever loses its preferred
// representative, the alphabetically-first id in that category is used instead,
// so `--mode canaries` always covers every category without manual upkeep.
const PREFERRED_CANARIES = {
  Memory: "memory",
  Attention: "attention-odd-one-out",
  Speed: "speed-tap-rush",
  Math: "math-fast-math",
  Language: "language-word-match",
  "Logic & Problem Solving": "logic-next-sequence",
  Flexibility: "flexibility-card-sort",
  Spatial: "spatial-transform-match",
};

let CATALOG = null; // cached result of loadCatalog()
function loadCatalog() {
  if (CATALOG) return CATALOG;
  const gamesDir = GAMES_DIR;
  if (!existsSync(gamesDir)) {
    throw new Error(`games directory not found: ${gamesDir}`);
  }
  const entries = [];
  for (const dir of listDirs(gamesDir)) {
    const jsonPath = join(gamesDir, dir, "game.json");
    if (!existsSync(jsonPath)) continue;
    let meta;
    try {
      meta = JSON.parse(readFileSync(jsonPath, "utf8"));
    } catch (e) {
      throw new Error(`unparseable game.json for ${dir}: ${e.message}`);
    }
    if (!meta.id || !/^[a-z0-9-]+$/.test(meta.id)) {
      throw new Error(`game.json for ${dir} has no valid id`);
    }
    if (meta.id !== dir) {
      throw new Error(
        `game.json id "${meta.id}" does not match directory name "${dir}"`,
      );
    }
    entries.push({
      id: meta.id,
      name: meta.name || meta.id,
      category: meta.primaryCategory || "Uncategorized",
      hasTutorial: !!meta.hasTutorial,
    });
  }
  if (entries.length === 0) {
    throw new Error(`no game.json found under ${gamesDir}`);
  }
  // Cross-check against the generated product registry (independent source).
  const registryIds = parseRegistryIds();
  const scannedIds = entries.map((g) => g.id).sort();
  const drift =
    registryIds.length > 0 &&
    (registryIds.join(",") !== scannedIds.join(","));
  const categories = {};
  for (const g of entries) {
    (categories[g.category] ||= []).push(g.id);
  }
  for (const cat of Object.keys(categories)) categories[cat].sort();
  const canaries = {};
  for (const [cat, ids] of Object.entries(categories)) {
    canaries[cat] =
      PREFERRED_CANARIES[cat] && ids.includes(PREFERRED_CANARIES[cat])
        ? PREFERRED_CANARIES[cat]
        : ids[0];
  }
  CATALOG = {
    games: entries.sort((a, b) => (a.id < b.id ? -1 : 1)),
    ids: scannedIds,
    categories,
    canaries,
    registryIds,
    registryDrift: drift,
  };
  return CATALOG;
}
function listDirs(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}
// Extract top-level game ids from the GENERATED registry module. The file is
// machine-generated with a stable shape (`    id: "<id>",` at 4-space indent),
// so a strict regex is deterministic and avoids a TS parser dependency.
function parseRegistryIds() {
  if (!existsSync(REGISTRY_TS)) return [];
  const out = [];
  const re = /^\s{4}id: "([a-z0-9-]+)",$/gm;
  const src = readFileSync(REGISTRY_TS, "utf8");
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out.sort();
}

// Device serial is resolved lazily (and only by paths that actually need a
// device) so --list-games / --self-test never spawn adb.
let SERIAL_CACHE = null;
function serial() {
  if (SERIAL_CACHE === null) {
    SERIAL_CACHE = (process.env.QA_DEVICE || firstEmulator()).trim();
  }
  return SERIAL_CACHE;
}

// Home testIDs that prove the JS bundle finished loading and the React
// navigation context is ready. We must reach one of these BEFORE deep-linking,
// otherwise the flow blanks. The Bridgeless dev runtime drops a deep-link
// intent delivered before the context is ready ("onNewIntent while context is
// not ready"), so warming Home first is mandatory.
const HOME_READY_IDS = ["home-brand", "home-title", "home-workout-list"];

// Interactive in-game item testIDs (see apps/mobile/src/sdk/testid.ts:
// testId(gameId, element, ...) → `<gameId>.<element>...`). The interaction
// probe taps one of these to prove real gameplay input works before the
// force-win shortcut. Tutorial/QA/result surfaces are excluded on purpose.
const INTERACTIVE_SUFFIXES =
  "(?:tile|option|cell|trigger|choice|(?:card-grid\\.card))\\.";
function interactiveRe(gameId) {
  const esc = gameId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc}\\.${INTERACTIVE_SUFFIXES}`);
}

// ---------------------------------------------------------------------------
// Action trace (structured, deterministic diagnosis)
// ---------------------------------------------------------------------------
const TRACE = [];
function trace(action, target, ok, detail) {
  const entry = {
    t: new Date().toISOString(),
    action,
    target: target ?? null,
    ok: !!ok,
    detail: detail ?? null,
  };
  TRACE.push(entry);
  return entry;
}
function traceMs(start) {
  return Date.now() - start;
}
// Per-flow human-readable step log (returned inside results for run.json).
let STEPS = [];
function beginSteps() {
  STEPS = [];
}
function log(msg) {
  STEPS.push({ t: new Date().toISOString(), msg });
}
function stepsOut() {
  return STEPS.slice(-60);
}

// ---------------------------------------------------------------------------
// adb helpers (with bounded retry on transient transport errors)
// ---------------------------------------------------------------------------
// Device build metadata — captured once per run for triage/diagnostics (H).
function deviceInfo() {
  try {
    const rel = adb(["shell", "getprop", "ro.build.version.release"]).trim();
    const sdk = adb(["shell", "getprop", "ro.build.version.sdk"]).trim();
    const model = adb(["shell", "getprop", "ro.product.model"]).trim();
    return {
      androidRelease: rel || null,
      sdk: sdk || null,
      model: model || null,
    };
  } catch {
    return {};
  }
}

// Host-level `adb devices` parse. Returns {ready[], other[]} or {error} when
// the adb binary itself cannot be executed. Never touches a specific device.
function adbHostDevices() {
  let out;
  try {
    out = execFileSync("adb", ["devices"], { encoding: "utf8" });
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
  const ready = [];
  const other = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^(\S+)\s+(device|offline|unauthorized)\s*$/);
    if (!m) continue;
    if (m[2] === "device") ready.push(m[1]);
    else other.push(`${m[1]} (${m[2]})`);
  }
  return { ready, other };
}
// Preflight: is there a usable device? Degrades to a clear BLOCKED reason
// instead of letting individual adb calls fail with cryptic errors mid-run.
function preflightDevice() {
  const d = adbHostDevices();
  if (d.error) return { ok: false, reason: `adb not runnable: ${d.error}` };
  const want = process.env.QA_DEVICE ? process.env.QA_DEVICE.trim() : null;
  if (want) {
    if (d.ready.includes(want)) return { ok: true, serial: want };
    return {
      ok: false,
      reason: `QA_DEVICE=${want} is not in adb 'device' state (ready=[${d.ready.join(", ") || "none"}], other=[${d.other.join(", ") || "none"}])`,
    };
  }
  if (d.ready.length > 0) {
    const emu = d.ready.find((s) => /^emulator-/.test(s));
    return { ok: true, serial: emu || d.ready[0] };
  }
  return {
    ok: false,
    reason: `no adb device in 'device' state (other=[${d.other.join(", ") || "none"}]). Boot the AVD: scripts/android/avd.sh boot`,
  };
}
function firstEmulator() {
  const d = adbHostDevices();
  if (d.ready) {
    const emu = d.ready.find((s) => /^emulator-/.test(s));
    if (emu) return emu;
    if (d.ready.length) return d.ready[0];
  }
  return "emulator-5554";
}
function adb(args, opts = {}) {
  return execFileSync("adb", ["-s", serial(), ...args], {
    encoding: "utf8",
    ...opts,
  });
}
function adbRetry(args, { tries = 3, intervalMs = 1000, opts = {} } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return adb(args, opts);
    } catch (e) {
      lastErr = e;
      if (/device offline|closed|transport/.test(String(e))) {
        sleep(intervalMs);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
function shell(cmd) {
  return adb(["shell", cmd]);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Hierarchy parsing (PURE — exercised by --self-test)
// ---------------------------------------------------------------------------
function parseBounds(bounds) {
  const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!m) return null;
  const x1 = +m[1],
    y1 = +m[2],
    x2 = +m[3],
    y2 = +m[4];
  return {
    x1,
    y1,
    x2,
    y2,
    cx: Math.round((x1 + x2) / 2),
    cy: Math.round((y1 + y2) / 2),
  };
}
// RN Android renders `testID` as the node `resource-id`. We also accept
// `content-desc` and a literal `testID` attribute for cross-version robustness.
function findTestId(xml, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const attr of ["resource-id", "testID", "content-desc"]) {
    const re = new RegExp(`${attr}="${escaped}"([^>]*)`);
    const m = xml ? xml.match(re) : null;
    if (m) {
      const a = m[1] || "";
      const b = a.match(/bounds="([^"]+)"/);
      const t = a.match(/text="([^"]*)"/);
      return { id, bounds: b ? parseBounds(b[1]) : null, text: t ? t[1] : "" };
    }
  }
  return null;
}
function hasTestId(xml, id) {
  return findTestId(xml, id) !== null;
}
function centerOf(node) {
  return node && node.bounds
    ? { cx: node.bounds.cx, cy: node.bounds.cy }
    : null;
}
// Pure selector for the generic gameplay-interaction probe: collect tappable
// in-game item nodes (`<id>.option.N`, `<id>.tile.N`, `<id>.cell.X`,
// `<id>.choice.*`, `<id>.trigger.*`, `<id>.card-grid.card.N`) from a hierarchy
// dump, excluding tutorial/QA/result surfaces. Clickable nodes sort first.
function findInteractionCandidates(xml, gameId) {
  if (!xml) return [];
  const re = interactiveRe(gameId);
  const out = [];
  for (const node of xml.match(/<node\b[^>]*>/g) || []) {
    const idm = node.match(/resource-id="([^"]+)"/);
    if (!idm || !re.test(idm[1])) continue;
    if (/tutorial|qa-panel|round-result/.test(idm[1])) continue;
    const bm = node.match(/bounds="([^"]+)"/);
    const b = bm ? parseBounds(bm[1]) : null;
    if (!b || b.x2 <= b.x1 || b.y2 <= b.y1) continue;
    out.push({
      id: idm[1],
      bounds: b,
      clickable: /clickable="true"/.test(node),
    });
  }
  return out.sort((a, b) => (b.clickable ? 1 : 0) - (a.clickable ? 1 : 0));
}

// ---------------------------------------------------------------------------
// Artifact capture (writes real files; returns paths for the report)
// ---------------------------------------------------------------------------
let RUN_DIR = OUT;
let ART = {
  hierarchy: "hierarchy",
  screenshots: "screenshots",
  logcat: "logcat",
  db: "db",
};
function initRunDir(mode) {
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const runId = `${ts}-autobot-${mode}`;
  RUN_DIR = join(OUT, runId);
  ART = {
    hierarchy: join(RUN_DIR, "hierarchy"),
    screenshots: join(RUN_DIR, "screenshots"),
    logcat: join(RUN_DIR, "logcat"),
    db: join(RUN_DIR, "db"),
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
function dumpIsUsable(xml) {
  return !!xml && xml.includes("<node") && !DUMP_ERROR_RE.test(xml);
}
function dumpHierarchy(tag) {
  const local = join(ART.hierarchy, `${tag}.xml`);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      adbRetry(["shell", "uiautomator", "dump", "/sdcard/qa-hier.xml"], {
        tries: 2,
      });
      adbRetry(["pull", "/sdcard/qa-hier.xml", local], { tries: 2 });
      const xml = readFileSyncSafe(local);
      if (dumpIsUsable(xml)) return local;
    } catch (e) {
      trace("hierarchy.dump", tag, false, String(e).slice(0, 80));
    }
    sleep(400);
  }
  // Fallback: stream straight to stdout (no intermediate device file).
  try {
    const xml = adb(["exec-out", "uiautomator", "dump", "/dev/tty"]);
    if (dumpIsUsable(xml)) {
      writeFileSync(local, xml);
      return local;
    }
  } catch {
    /* ignore */
  }
  return local; // may be empty/error; callers still verify content
}
function screenshot(tag) {
  const local = join(ART.screenshots, `${tag}.png`);
  try {
    // `adb exec-out screencap -p` writes a PNG to stdout; capture it directly
    // rather than relying on a shell redirect (which the original passed as an
    // adb argument and was silently ignored).
    const buf = adbRetry(["exec-out", "screencap", "-p"], {
      tries: 2,
      opts: { encoding: "buffer", maxBuffer: 32 * 1024 * 1024 },
    });
    writeFileSync(local, buf);
  } catch {
    /* ignore */
  }
  return local;
}
function captureLogcat(tag) {
  const local = join(ART.logcat, `${tag}.txt`);
  try {
    // Capture logcat to stdout and persist it; `-f <path>` would write on the
    // device, not the host, so we buffer instead.
    const out = adbRetry(["logcat", "-d"], {
      tries: 2,
      opts: { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    });
    writeFileSync(local, out);
  } catch {
    /* ignore */
  }
  return local;
}
// Bounded recent logcat slice — cheap, machine-readable triage context for a
// single failing game without multi-MB full-buffer dumps per failure.
function captureLogcatSlice(tag, lines = 800) {
  const local = join(ART.logcat, `${tag}-slice.txt`);
  try {
    const out = adbRetry(["logcat", "-d", "-t", String(lines)], {
      tries: 2,
      opts: { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    });
    writeFileSync(local, out);
  } catch {
    /* ignore */
  }
  return local;
}
function pullDb(tag) {
  const local = join(ART.db, `${tag}.sqlite`);
  try {
    const buf = execFileSync(
      "adb",
      [
        "-s",
        serial(),
        "exec-out",
        "run-as",
        PKG,
        "cat",
        "files/SQLite/brain-training.db",
      ],
      { maxBuffer: 64 * 1024 * 1024, encoding: "buffer" },
    );
    writeFileSync(local, buf);
  } catch {
    /* leave absent */
  }
  return local;
}
function queryDb(file, sql) {
  if (!existsSync(file) || !existsSync(SQLITE)) return null;
  try {
    return execFileSync(SQLITE, [file, sql], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}
// Count persisted sessions for a game and flag duplicates (a regression class:
// a fresh reset + single force-win must yield exactly one row for the game).
function sessionStats(gameId) {
  const db = pullDb(`${gameId}-post`);
  if (!existsSync(db))
    return { db: db, count: null, duplicates: false, note: "db not pulled" };
  const count = queryDb(
    db,
    `SELECT COUNT(*) FROM game_sessions WHERE game_id='${gameId}';`,
  );
  const rows = queryDb(
    db,
    `SELECT seed, generator_version FROM game_sessions WHERE game_id='${gameId}';`,
  );
  const seeds = (rows || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const uniq = new Set(seeds);
  return {
    db,
    count: count == null ? null : Number(count),
    duplicates: seeds.length > uniq.size,
    note:
      count === "1"
        ? "exactly one (OK)"
        : `count=${count}${seeds.length > uniq.size ? " DUPLICATE SEEDS" : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Wait helpers (state-based, not arbitrary sleeps)
// ---------------------------------------------------------------------------
function readFileSyncSafe(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}
async function waitFor(id, timeoutMs = 20000, tag = "wait") {
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
async function waitForAny(ids, timeoutMs = 20000, tag = "waitAny") {
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
// Measured on the dedicated AVD (2026-08-21, 38-game catalog, dev client):
// a `pm clear` + relaunch cold start reaches interactive Home in ~50s
// (bundle fetch + JS execution). The budget must exceed that with headroom,
// otherwise every game after the first reset false-fails on warm-home.
async function waitForHome(timeoutMs = 120000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const p = dumpHierarchy("home-warm");
    const xml = readFileSyncSafe(p);
    if (
      xml &&
      !DUMP_ERROR_RE.test(xml) &&
      HOME_READY_IDS.some((id) => hasTestId(xml, id))
    )
      return xml;
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
  for (const key of [
    "window_animation_scale",
    "transition_animation_scale",
    "animator_duration_scale",
  ]) {
    try {
      adb(["shell", "settings", "put", "global", key, "0"]);
    } catch {
      /* ignore */
    }
  }
}
function launch() {
  adb(["shell", "am", "start", "-n", `${PKG}/.MainActivity`]);
}
function reset() {
  disableAnimations();
  adb(["shell", "am", "force-stop", PKG]);
  sleep(500);
  try {
    adb(["shell", "pm", "clear", PKG]);
  } catch {
    /* ignore */
  }
  sleep(500);
}
function deepLink(path) {
  adb([
    "shell",
    "am",
    "start",
    "-W",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    `${SCHEME}://${path}`,
    PKG,
  ]);
}
// Warm the app: if the home screen isn't already ready (cold start / dropped
// deep-link), launch Home and wait for the bundle to finish loading. This MUST
// run before any deep-link to avoid the Bridgeless "context not ready" gap.
async function ensureWarmHome() {
  const p = dumpHierarchy("home-check");
  const xml = readFileSyncSafe(p);
  if (xml && HOME_READY_IDS.some((id) => hasTestId(xml, id))) return true;
  launch();
  let ready = await waitForHome();
  if (ready) return true;
  // Recovery: the process may be alive but wedged off-Home (e.g. left on a
  // lazy-loading game route by an earlier probe) — `am start` is a no-op for
  // an already-top-most activity, so force-stop and relaunch once.
  try {
    adb(["shell", "am", "force-stop", PKG]);
    await sleep(1000);
    launch();
    ready = await waitForHome();
  } catch {
    /* fall through */
  }
  return !!ready;
}
function tap(node) {
  if (!node || !node.bounds) return false;
  shell(`input tap ${node.bounds.cx} ${node.bounds.cy}`);
  return true;
}
function tapTestId(id, xml) {
  const node = xml ? findTestId(xml, id) : null;
  if (!node || !node.bounds) {
    trace("tap", id, false, "node not found");
    return false;
  }
  tap(node);
  trace("tap", id, true, `${node.bounds.cx},${node.bounds.cy}`);
  return true;
}
// True when the app process still owns (or recently owned) the foreground —
// used after BACK/input probes to distinguish "navigated somewhere valid"
// from "app crashed or was backgrounded".
function appForeground() {
  try {
    const out = shell("dumpsys window");
    return out.includes(PKG);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Failure artifacts (machine-readable JSON + screenshot + hierarchy + logcat
// slice + DB snapshot, per failing game)
// ---------------------------------------------------------------------------
function captureFailure(id, tag, reason, extra = {}) {
  mkdirSync(RUN_DIR, { recursive: true });
  const artifacts = {
    screenshot: screenshot(`${tag}-fail`),
    hierarchy: dumpHierarchy(`${tag}-fail`),
    logcatSlice: captureLogcatSlice(`${tag}-fail`),
    db: pullDb(`${tag}-fail-db`),
  };
  const manifest = {
    gameId: id,
    reason,
    at: new Date().toISOString(),
    device: { serial: serial(), pkg: PKG, scheme: SCHEME, ...deviceInfo() },
    steps: stepsOut(),
    trace: TRACE.slice(-24),
    artifacts,
    ...extra,
  };
  const dir = join(RUN_DIR, "failures");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${id}.json`);
  writeFileSync(file, JSON.stringify(manifest, null, 2));
  log(`failure artifacts written: ${file}`);
  return { manifest: file, ...artifacts };
}

// ---------------------------------------------------------------------------
// QA force-win driving
// ---------------------------------------------------------------------------
// Scroll up to `attempts` times looking for `id` — tall game boards can push
// the dev-only QA controls several viewport-heights down their ScrollView.
async function findWithScroll(gameId, id, tag, attempts = 3) {
  let node = await waitFor(id, 2500, tag);
  let i = 0;
  while (!node && i < attempts) {
    shell("input swipe 540 1900 540 300 350");
    await sleep(700);
    node = await waitFor(id, 2000, tag);
    i += 1;
  }
  return node;
}
// One best-effort attempt at toggle → panel → force-win. Returns true if the
// force-win tap was issued (panel opened), false if the sequence was not
// currently reachable (phase-gated or below the ScrollView fold).
async function tapForceWinOnce(id, tag) {
  const toggle = await findWithScroll(id, `${id}.qa-toggle`, `${tag}-fw`);
  if (!toggle) return false;
  tapTestId(`${id}.qa-toggle`, toggle);
  await sleep(400);
  const panel = await findWithScroll(id, `${id}.qa-panel`, `${tag}-fw`);
  if (!panel) return false;
  tapTestId(`${id}.force-win`, panel);
  log("force-win pressed");
  return true;
}
// Poll the QA toggle → panel → force-win sequence until results appear.
// Returns the matching results node (with `.id`) or null on timeout. This is
// resilient to games whose QA panel is only mounted during certain play
// phases: it taps force-win the moment the toggle is observable.
async function driveForceWin(id, tag) {
  const end = Date.now() + 15000;
  while (Date.now() < end) {
    if (tapForceWinOnce(id, tag)) {
      await sleep(800);
      const res = await waitForAny(
        ["results-title", `${id}.results`, "results-score"],
        4000,
        `${tag}-fw`,
      );
      if (res) return res;
    }
    await sleep(500);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core game drive
// ---------------------------------------------------------------------------
async function flowGame(id, opts = {}) {
  beginSteps();
  const tag = `game-${id}`;
  const t0 = Date.now();
  reset();
  const warm = await ensureWarmHome();
  log(`warmed home: ${warm ? "yes" : "NO (deep-link may blank)"}`);
  if (!warm) {
    const artifacts = captureFailure(
      id,
      tag,
      "app did not warm to home (Metro/JS load)",
    );
    return {
      id,
      passed: false,
      status: "FAIL",
      reason: "app did not warm to home (Metro/JS load)",
      steps: stepsOut(),
      ms: traceMs(t0),
      artifacts,
      trace: traceSlice(),
    };
  }

  deepLink(`game/${id}`);
  let xml =
    (await waitFor(`${id}.screen`, SCREEN_BUDGET_MS, tag)) ||
    (await waitFor(`${id}.intro`, SCREEN_BUDGET_MS, tag));
  if (!xml) {
    return failGame(id, "screen did not load", t0, tag);
  }
  log("screen loaded");
  screenshot(`${tag}-screen`);

  // Tutorial bypass: skip button first, then done/next variants (some games
  // gate the skip control behind an intro page or expose only "Done").
  let skippedTutorial = false;
  for (const tid of [
    `${id}.tutorial-skip`,
    `${id}.tutorial-done`,
    `${id}.tutorial-next`,
  ]) {
    if (tapTestId(tid, xml)) {
      skippedTutorial = true;
      await sleep(700);
      xml = readFileSyncSafe(dumpHierarchy(`${tag}-postskip`));
      break;
    }
  }
  log(skippedTutorial ? "tutorial bypassed" : "no tutorial (already completed or none)");

  // Start.
  if (!tapTestId(`${id}.start`, xml)) {
    xml = await waitFor(`${id}.start`, 8000, tag);
    if (!xml || !tapTestId(`${id}.start`, xml)) {
      return failGame(id, "start button not found", t0, tag);
    }
  }
  log("started");
  await sleep(400);

  // Real gameplay interaction probe: tap one in-game item (option/tile/cell/
  // choice/trigger/card) so the smoke proves actual input handling, not just
  // the force-win shortcut. Best-effort: study/countdown phases may legitimately
  // expose nothing tappable yet, so a miss is recorded but never fails the run.
  const interaction = await probeInteraction(id, tag);
  log(
    interaction.attempted
      ? `interaction tapped ${interaction.nodeId}`
      : `interaction: no tappable item visible (${interaction.reason})`,
  );

  // Optional pause/resume probe.
  let pauseProbe = { attempted: !!opts.pause, paused: false, resumed: false };
  if (opts.pause) {
    const px = await waitFor(`${id}.pause`, 6000, tag);
    if (px) {
      tapTestId(`${id}.pause`, px);
      await sleep(700);
      const paused = await waitForAny(
        [`${id}.pause-overlay`, `${id}.resume`],
        5000,
        tag,
      );
      pauseProbe.paused = !!paused;
      log(
        paused ? "paused + overlay shown" : "paused (overlay testID not matched)",
      );
      const rp = await waitFor(`${id}.resume`, 4000, tag);
      if (rp) {
        tapTestId(`${id}.resume`, rp);
        await sleep(700);
        pauseProbe.resumed = true;
        log("resumed");
      } else {
        // Patient retry: the overlay can render late under load. Without a
        // resumed state every later tap lands on the opaque overlay.
        const rp2 = await waitFor(`${id}.resume`, 9000, tag);
        if (rp2) {
          tapTestId(`${id}.resume`, rp2);
          await sleep(700);
          pauseProbe.resumed = true;
          log("resumed (retry)");
        } else {
          log("resume not reachable");
        }
      }
    } else {
      log("no pause control (not applicable)");
    }
  }

  // Open QA panel and force win. Some games only expose the QA toggle during
  // a specific in-session phase (e.g. a brief "study" phase before the choice
  // phase unmounts the panel), so poll the toggle→panel→force-win sequence in
  // a loop until results appear rather than assuming a single fixed wait.
  // If the pause probe left the app paused, force-win polling would tap into
  // the opaque overlay — report that honestly instead.
  if (pauseProbe.paused && !pauseProbe.resumed) {
    return failGame(
      id,
      "app left paused: resume control not reachable after retry",
      t0,
      tag,
      { interaction, pause: pauseProbe },
    );
  }
  const results = await driveForceWin(id, tag);
  if (!results) {
    return failGame(
      id,
      "qa-toggle/force-win not reachable (qa panel may be phase-gated)",
      t0,
      tag,
      { interaction, pause: pauseProbe },
    );
  }
  log(`results reached via ${results.id}`);
  screenshot(`${tag}-results`);

  // Persistence: exactly one session for this game after a fresh reset.
  const stats = sessionStats(id);
  log(`persistence: ${stats.note}`);
  captureLogcatSlice(`${tag}`);

  // Back navigation: after results, BACK must land somewhere known (home,
  // intro, or results surfaces) with the app still alive — not crash/background.
  const back = await probeBackNavigation(id, tag);
  log(
    back.ok
      ? `back navigation OK (surface: ${back.surface || "app foreground"})`
      : "back navigation FAILED (app dead/backgrounded)",
  );

  // Next-game navigation: deep-link to the neighboring catalog entry and prove
  // its screen loads (per-game smoke covers "next game" traversal).
  const next = await probeNextGame(id, tag);
  log(
    next.ok
      ? `next-game navigation OK (${next.next})`
      : `next-game navigation FAILED (${next.next})`,
  );

  const coreOk = stats.count === 1 && !stats.duplicates;
  const passed = coreOk && back.ok && next.ok;
  const reason = passed
    ? "force-win + exactly one persisted session + authoritative results + back/next navigation"
    : !coreOk
      ? `session count=${stats.count} (expected 1), duplicates=${stats.duplicates}`
      : !back.ok
        ? "back navigation left the app dead/backgrounded"
        : `next-game screen did not load (${next.next})`;
  return {
    id,
    passed,
    status: passed ? "PASS" : "FAIL",
    reason,
    interaction,
    pause: pauseProbe,
    back,
    next: next.next,
    steps: stepsOut(),
    ms: traceMs(t0),
    artifacts: captureAll(tag),
    session: stats,
    trace: traceSlice(),
  };
}

// Generic gameplay-interaction probe. Taps the first tappable in-game item
// found right after start; retries once just before force-win (some games only
// mount their answer grid after a countdown/study phase). Non-gating.
async function probeInteraction(id, tag) {
  const attemptAt = async (label) => {
    const xml = readFileSyncSafe(dumpHierarchy(`${tag}-ix-${label}`));
    const candidates = findInteractionCandidates(xml, id);
    if (candidates.length === 0) return null;
    const c = candidates[0];
    tap(c);
    trace("tap.interaction", c.id, true, `${c.bounds.cx},${c.bounds.cy}`);
    await sleep(500);
    if (!appForeground()) {
      return { nodeId: c.id, crashedAfterTap: true };
    }
    return { nodeId: c.id };
  };
  const first = await attemptAt("post-start");
  if (first) {
    return {
      attempted: true,
      ...first,
      reason: first.crashedAfterTap ? "app died after tap" : "tapped",
    };
  }
  const second = await attemptAt("retry");
  if (second) {
    return {
      attempted: true,
      ...second,
      reason: second.crashedAfterTap ? "app died after tap" : "tapped (late mount)",
    };
  }
  return { attempted: false, reason: "no interactive item mounted at probe time" };
}

// BACK navigation probe: press KEYCODE_BACK (emulator-local), then require the
// app to still be foreground AND showing a known surface (home / game intro /
// game screen / shared results). Lenient about WHICH surface appears because
// nav stacks differ per entry point; strict about the app staying alive.
async function probeBackNavigation(id, tag) {
  try {
    shell("input keyevent 4");
  } catch (e) {
    trace("keyevent.BACK", id, false, String(e).slice(0, 80));
  }
  await sleep(1200);
  const surfaces = [
    ...HOME_READY_IDS,
    `${id}.screen`,
    `${id}.intro`,
    "results-title",
  ];
  const found = await waitForAny(surfaces, 8000, `${tag}-back`);
  const alive = appForeground();
  return {
    ok: !!(found && alive),
    surface: found ? found.id : null,
    alive,
  };
}

// Next-game probe: deep-link to the next catalog id (wrap-around) and require
// its screen/intro to mount. Proves per-game navigation beyond the current game.
async function probeNextGame(id, tag) {
  const cat = loadCatalog();
  const idx = cat.ids.indexOf(id);
  const next = cat.ids[(idx + 1) % cat.ids.length];
  deepLink(`game/${next}`);
  const xml =
    (await waitFor(`${next}.screen`, NEXT_BUDGET_MS, `${tag}-next`)) ||
    (await waitFor(`${next}.intro`, NEXT_BUDGET_MS, `${tag}-next`));
  return { next, ok: !!xml };
}

// Warm-bundles mode: trigger Metro's lazy-route builds for every catalog id
// ahead of timed runs. Each deep link makes the app call import() for that
// game's chunk; Metro keeps the built graph in its transform cache regardless
// of whether the UI finishes mounting, so later timed flows hit warm caches.
// Ids whose screen did not mount within the per-id cap get one retry pass —
// a miss usually means the chunk was still building, not that it is broken.
async function flowWarmBundles() {
  beginSteps();
  const t0 = Date.now();
  const stepMs = Number(process.env.QA_WARM_STEP_MS || 3000);
  const capMs = Number(process.env.QA_WARM_CAP_MS || 30000);
  if (!(await ensureWarmHome())) {
    return {
      id: "warm-bundles",
      passed: false,
      status: "FAIL",
      reason: "app did not warm to home",
      details: [],
      ms: traceMs(t0),
      artifacts: captureAll("warm"),
      trace: traceSlice(),
    };
  }
  const cat = loadCatalog();
  const attempt = async (ids, label) => {
    const out = [];
    for (const id of ids) {
      deepLink(`game/${id}`);
      const xml =
        (await waitFor(`${id}.screen`, capMs, `warm-${label}-${id}`)) ||
        (await waitFor(`${id}.intro`, capMs, `warm-${label}-${id}`));
      out.push({ id, mounted: !!xml });
      log(`${label}: ${id} ${xml ? "mounted" : "COLD (chunk building)"}`);
    }
    return out;
  };
  const first = await attempt(cat.ids, "p1");
  let cold = first.filter((r) => !r.mounted).map((r) => r.id);
  if (cold.length > 0) {
    await sleep(5000); // give Metro a moment to drain pending builds
    const retry = await attempt(cold, "p2");
    cold = retry.filter((r) => !r.mounted).map((r) => r.id);
  }
  const warmedCount = cat.ids.length - cold.length;
  return {
    id: "warm-bundles",
    passed: cold.length === 0,
    status: cold.length === 0 ? "PASS" : "FAIL",
    reason:
      cold.length === 0
        ? `${warmedCount}/${cat.ids.length} game chunks mounted`
        : `cold after retry (${cold.length}): ${cold.join(", ")}`,
    details: {
      firstPassMisses: first.filter((r) => !r.mounted).map((r) => r.id),
      finalCold: cold,
    },
    steps: stepsOut(),
    ms: traceMs(t0),
    artifacts: captureAll("warm"),
    trace: traceSlice(),
  };
}

function failGame(id, reason, t0, tag, extra = {}) {
  const artifacts = captureFailure(id, tag, reason, extra);
  return {
    id,
    passed: false,
    status: "FAIL",
    reason,
    ...extra,
    steps: stepsOut(),
    ms: traceMs(t0),
    artifacts,
    trace: traceSlice(),
  };
}
function traceSlice() {
  return TRACE.slice(-12).map(
    (e) => `${e.action}:${e.target}:${e.ok ? "ok" : "FAIL"}`,
  );
}
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
  beginSteps();
  const id = "language-word-match";
  const tiers = ["easy", "normal", "hard", "expert"];
  const results = [];
  for (const tier of tiers) {
    const t0 = Date.now();
    reset();
    if (!(await ensureWarmHome())) {
      results.push({ tier, passed: false, reason: "app did not warm" });
      continue;
    }
    deepLink(`game/${id}`);
    const xml =
      (await waitFor(`${id}.screen`, 25000, `wm-${tier}`)) ||
      (await waitFor(`${id}.intro`, 25025, `wm-${tier}`));
    if (!xml) {
      results.push({
        tier,
        passed: false,
        reason: "screen did not load",
        ms: traceMs(t0),
      });
      continue;
    }
    tapTestId(`${id}.tutorial-skip`, xml);
    await sleep(700);
    tapTestId(
      `${id}.difficulty-${tier}`,
      readFileSyncSafe(dumpHierarchy(`wm-${tier}-d`)),
    );
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
      } else if (
        cont &&
        (hasTestId(cont, "results-title") || hasTestId(cont, `${id}.results`))
      ) {
        break;
      }
    }
    const fin = readFileSyncSafe(dumpHierarchy(`wm-${tier}-fin`));
    const ok =
      fin &&
      (hasTestId(fin, "results-title") || hasTestId(fin, `${id}.results`));
    results.push({
      tier,
      passed: ok,
      rounds,
      reason: ok
        ? `tier ${tier}: ${rounds} rounds forced`
        : "did not reach results",
      ms: traceMs(t0),
    });
  }
  const passed = results.every((r) => r.passed);
  return {
    id: "language-word-match (3.6)",
    passed,
    status: passed ? "PASS" : "FAIL",
    details: results,
    steps: stepsOut(),
    artifacts: captureAll("wordmatch"),
    trace: traceSlice(),
  };
}

// ---------------------------------------------------------------------------
// Daily Workout 4/4 + interruption/resume (gates 6.8 / 12.7)
// ---------------------------------------------------------------------------
async function flowWorkout() {
  beginSteps();
  const t0 = Date.now();
  reset();
  if (!(await ensureWarmHome()))
    return {
      id: "daily-workout (6.8/12.7)",
      passed: false,
      status: "FAIL",
      reason: "app did not warm to home",
      details: [],
      ms: traceMs(t0),
      artifacts: captureAll("workout"),
      trace: traceSlice(),
    };
  let home = await waitFor("home-workout-list", 20000, "wk-home");
  if (!home)
    return {
      id: "daily-workout (6.8/12.7)",
      passed: false,
      status: "FAIL",
      reason: "Home workout list not found",
      details: [],
      ms: traceMs(t0),
      artifacts: captureAll("workout"),
      trace: traceSlice(),
    };

  const ids = [];
  // `home-workout-game-status-<id>` child markers (added with the Home
  // workout progress UI) must not count as separate games.
  for (const m of home.match(/home-workout-game-(?!status-)([a-z0-9-]+)/g) || [])
    ids.push(m.replace("home-workout-game-", ""));
  const uniq = [...new Set(ids)];
  if (uniq.length !== 4) {
    return {
      id: "daily-workout (6.8/12.7)",
      passed: false,
      status: "FAIL",
      reason: `expected 4 workout games, found ${uniq.length}`,
      details: uniq,
      ms: traceMs(t0),
      artifacts: captureAll("workout"),
      trace: traceSlice(),
    };
  }
  const order = uniq;
  const log = [];

  for (let i = 0; i < 4; i++) {
    const gameId = order[i];
    home = readFileSyncSafe(dumpHierarchy("wk-loop-home"));
    if (!tapTestId(`home-workout-game-${gameId}`, home)) {
      const r = readFileSyncSafe(dumpHierarchy("wk-loop-r"));
      if (hasTestId(r, "results-next-game")) tapTestId("results-next-game", r);
      else
        return {
          id: "daily-workout",
          passed: false,
          status: "FAIL",
          reason: `could not enter game ${gameId}`,
          details: log,
          ms: traceMs(t0),
          artifacts: captureAll("workout"),
          trace: traceSlice(),
        };
    }
    await sleep(1400);
    const gxml =
      (await waitFor(`${gameId}.screen`, 20000, `wk-g${i}`)) ||
      (await waitFor(`${gameId}.intro`, 20000, `wk-g${i}`));
    if (!gxml)
      return {
        id: "daily-workout",
        passed: false,
        status: "FAIL",
        reason: `game ${gameId} did not load`,
        details: log,
        ms: traceMs(t0),
        artifacts: captureAll("workout"),
        trace: traceSlice(),
      };
    tapTestId(`${gameId}.tutorial-skip`, gxml);
    await sleep(700);
    tapTestId(`${gameId}.start`, readFileSyncSafe(dumpHierarchy(`wk-g${i}-s`)));
    await sleep(1200);
    // Multi-round games land on an intermediate round-advance surface after
    // each forced win, so poll force-win → (next-round)* → shared results
    // instead of assuming a single tap reaches the workout results. This is
    // the root-cause fix for the 009 abort at game 0 (context-fit timing).
    const wantId = i < 3 ? "results-next-game" : "results-workout-complete";
    let res = null;
    let fwTaps = 0;
    const fwDeadline = Date.now() + 45000;
    while (Date.now() < fwDeadline && !res) {
      if (tapForceWinOnce(gameId, `wk-g${i}`)) {
        fwTaps += 1;
        await sleep(1000);
      }
      res = await waitFor(wantId, 3000, `wk-g${i}-res`);
      if (!res) {
        // Round gate: advance through intermediate rounds when offered.
        const rx = readFileSyncSafe(dumpHierarchy(`wk-g${i}-round`));
        if (rx && hasTestId(rx, `${gameId}.next-round`)) {
          tapTestId(`${gameId}.next-round`, rx);
          await sleep(1100);
        }
      }
    }
    if (!res)
      return {
        id: "daily-workout",
        passed: false,
        status: "FAIL",
        reason: `results (${wantId}) not reached for game ${i} (${gameId}) after ${fwTaps} force-win taps`,
        details: log,
        ms: traceMs(t0),
        artifacts: captureAll("workout"),
        trace: traceSlice(),
      };
    log.push(`completed ${gameId} (${i + 1}/4)`);
    if (i < 3) tapTestId("results-next-game", res);
    await sleep(1400);
  }

  const complete = readFileSyncSafe(dumpHierarchy("wk-complete"));
  const fourFour = complete && hasTestId(complete, "results-workout-complete");
  log.push(
    fourFour
      ? "4/4 workout complete screen shown"
      : "4/4 complete screen NOT shown",
  );

  // Interruption / relaunch resume probe.
  adb(["shell", "am", "force-stop", PKG]);
  await sleep(1500);
  launch();
  const resumed = await waitForHome();
  let allDone = false;
  if (resumed) {
    const statuses =
      resumed.match(/home-workout-game-status-([a-z0-9-]+)/g) || [];
    allDone = statuses.length > 0;
    for (const m of statuses) {
      const gid = m.replace("home-workout-game-status-", "");
      const node = findTestId(resumed, `home-workout-game-status-${gid}`);
      if (!node || !/done|complete/i.test(node.text || "")) {
        allDone = false;
        break;
      }
    }
  }
  log.push(
    allDone
      ? "relaunch: all 4 games marked Done (resume/persist OK)"
      : "relaunch: completion status not uniformly Done (see hierarchy)",
  );
  captureAll("workout");

  const passed = fourFour && allDone;
  return {
    id: "daily-workout (6.8/12.7)",
    passed,
    status: passed ? "PASS" : "FAIL",
    reason: passed
      ? "4/4 completed + relaunch shows persisted completion"
      : "see log",
    details: log,
    steps: stepsOut(),
    ms: traceMs(t0),
    artifacts: captureAll("workout"),
    trace: traceSlice(),
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function summaryLine(r) {
  const status = r.status || (r.passed ? "PASS" : "FAIL");
  return `[${status}] ${r.id}${r.reason ? " — " + r.reason : ""}`;
}
function writeRunJson(_runId, data) {
  mkdirSync(RUN_DIR, { recursive: true });
  const tmp = join(RUN_DIR, "run.json.tmp");
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, join(RUN_DIR, "run.json")); // atomic: a missing run.json == incomplete run
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
  ].join("");
  const fixtureXml = [
    '<node resource-id="g1.qa-toggle" clickable="true" bounds="[0,0][100,40]" text=""/>',
    '<node resource-id="g1.option.2" clickable="true" bounds="[10,60][110,160]" text=""/>',
    '<node resource-id="g1.tile.5" clickable="false" bounds="[0,200][50,250]" text=""/>',
    '<node resource-id="g1.card-grid.card.1" clickable="true" bounds="[0,260][80,340]" text=""/>',
    '<node resource-id="g1.tutorial-grid.option.0" clickable="true" bounds="[0,350][90,430]" text=""/>',
  ].join("");
  const checks = [];
  const assert = (name, cond, detail) =>
    checks.push({ name, pass: !!cond, detail: detail ?? null });

  const b = parseBounds("[10,20][110,220]");
  assert("parseBounds", b && b.cx === 60 && b.cy === 120, JSON.stringify(b));
  assert("findTestId resource-id", !!findTestId(xml, "memory.screen"));
  assert("findTestId content-desc", !!findTestId(xml, "results-title"));
  assert("hasTestId negative", !hasTestId(xml, "nope"));
  const c = centerOf(findTestId(xml, "memory.screen"));
  assert("centerOf", c && c.cx === 50 && c.cy === 50, JSON.stringify(c));
  const seeds = ["a|1", "a|1", "b|1"];
  assert("duplicate seeds detected", new Set(seeds).size !== seeds.length);

  // Interaction-probe selector (pure): picks tappable in-game items, prefers
  // clickable nodes, excludes tutorial/QA surfaces.
  const candidates = findInteractionCandidates(fixtureXml, "g1");
  assert(
    "interaction candidates exclude qa/tutorial",
    candidates.every(
      (n) => !/qa-toggle|tutorial/.test(n.id),
    ),
    JSON.stringify(candidates.map((n) => n.id)),
  );
  assert(
    "interaction candidates include option/tile/card",
    ["g1.option.2", "g1.tile.5", "g1.card-grid.card.1"].every((id) =>
      candidates.some((n) => n.id === id),
    ),
    JSON.stringify(candidates.map((n) => n.id)),
  );
  assert(
    "interaction candidates prefer clickable",
    candidates.length > 0 && candidates[0].id === "g1.option.2",
    JSON.stringify(candidates.map((n) => `${n.id}:${n.clickable}`)),
  );
  assert(
    "interaction candidates empty for unrelated xml",
    findInteractionCandidates(xml, "g1").length === 0,
  );

  // Catalog derivation: scan game.json + cross-check against the generated
  // registry. Both sources must agree — any drift fails loudly here instead of
  // silently smoke-testing a stale list.
  try {
    const cat = loadCatalog();
    assert("catalog non-empty", cat.ids.length > 0, String(cat.ids.length));
    assert(
      "catalog ids unique",
      new Set(cat.ids).size === cat.ids.length,
      String(cat.ids.length),
    );
    assert(
      "catalog matches registry.generated.ts",
      !cat.registryDrift,
      `scanned=${cat.ids.length} registry=${cat.registryIds.length}`,
    );
    assert(
      "every category non-empty",
      Object.values(cat.categories).every((l) => l.length > 0),
      JSON.stringify(
        Object.fromEntries(
          Object.entries(cat.categories).map(([k, v]) => [k, v.length]),
        ),
      ),
    );
    assert(
      "one canary per category, all in catalog",
      Object.keys(cat.canaries).length === Object.keys(cat.categories).length &&
        Object.values(cat.canaries).every(
          (g) => cat.ids.includes(g),
        ),
      JSON.stringify(cat.canaries),
    );
    assert(
      "canary preferred reps honored where present",
      Object.entries(PREFERRED_CANARIES).every(
        ([catName, pref]) =>
          !cat.categories[catName] ||
          !cat.categories[catName].includes(pref) ||
          cat.canaries[catName] === pref,
      ),
      JSON.stringify(cat.canaries),
    );
  } catch (e) {
    assert("catalog loads", false, String(e).slice(0, 200));
  }

  const passed = checks.every((c) => c.pass);
  const report = { selfTest: true, passed, checks };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "autobot-self-test.json"),
    JSON.stringify(report, null, 2),
  );
  for (const c of checks)
    console.log(
      `[${c.pass ? "PASS" : "FAIL"}] ${c.name}${c.detail ? " — " + c.detail : ""}`,
    );
  console.log(
    `Self-test: ${checks.filter((c) => c.pass).length}/${checks.length} passed`,
  );
  return passed;
}

// ---------------------------------------------------------------------------
// Target selection (shared by live runs and the blocked path so both report
// exactly the same planned set)
// ---------------------------------------------------------------------------
function selectTargets(mode, onlyGame, category, canariesOnly) {
  const cat = loadCatalog();
  const targets = [];
  if (mode === "warm-bundles") return [{ kind: "warm", id: "warm-bundles" }];
  const wantsGames = mode === "game" || mode === "all" || mode === "catalog";
  if (wantsGames) {
    let list = cat.ids;
    if (onlyGame) list = [onlyGame];
    else if (category && cat.categories[category])
      list = cat.categories[category];
    if (canariesOnly && !onlyGame) list = Object.values(cat.canaries);
    for (const g of list) targets.push({ kind: "game", id: g });
  }
  if (mode === "wordmatch" || mode === "all")
    targets.push({ kind: "wordmatch", id: "language-word-match (3.6)" });
  if (mode === "workout" || mode === "all")
    targets.push({ kind: "workout", id: "daily-workout (6.8/12.7)" });  if (mode === "canaries" || mode === "all") {
    for (const g of Object.values(cat.canaries)) {
      if (!targets.some((t) => t.kind === "game" && t.id === g))
        targets.push({ kind: "game", id: g });
    }
  }
  return targets;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const get = (k, d) => {
    const i = args.indexOf(k);
    return i >= 0 ? args[i + 1] : d;
  };
  const mode = get("--mode", "all");
  const onlyGame = get("--game", null);
  const category = get("--category", null);
  const pause = args.includes("--pause");
  const listGames = args.includes("--list-games");
  const self = args.includes("--self-test");
  const exitZero = args.includes("--exit-zero");
  const exitNonZero = args.includes("--exit-nonzero-on-fail") || !exitZero;

  // Offline modes first: they must never spawn adb or touch a device.
  if (self) {
    process.exit(selfTest() ? 0 : 1);
  }

  // Catalog load + CLI validation (offline; exits before any device contact).
  let cat;
  try {
    cat = loadCatalog();
  } catch (e) {
    console.error(`[BLOCKED] catalog derivation failed: ${e.message}`);
    process.exit(1);
  }
  if (listGames) {
    for (const id of cat.ids) console.log(id);
    console.error(`# ${cat.ids.length} games derived from apps/mobile/src/games/*/game.json`);
    if (category) {
      const list = cat.categories[category] || [];
      console.error(`# Category ${category}: ${list.join(", ")}`);
    }
    console.error(
      `# Canaries: ${JSON.stringify(cat.canaries)}`,
    );
    if (cat.registryDrift) {
      console.error(
        "# DRIFT: game.json set differs from registry.generated.ts — regenerate the registry",
      );
      process.exit(1);
    }
    process.exit(0);
  }
  if (onlyGame && !cat.ids.includes(onlyGame)) {
    console.error(
      `[ERROR] unknown --game '${onlyGame}'. Valid ids (${cat.ids.length}):`,
    );
    console.error(cat.ids.join("\n"));
    process.exit(1);
  }
  if (category && !cat.categories[category]) {
    console.error(
      `[ERROR] unknown --category '${category}'. Valid categories: ${Object.keys(cat.categories).join(" | ")}`,
    );
    process.exit(1);
  }

  const planned = selectTargets(mode, onlyGame, category, args.includes("--canaries-only"));

  // Preflight: without a usable device, report BLOCKED + NOT VALIDATED per
  // planned target and exit 2. Never fake PASS.
  const pf = preflightDevice();
  if (!pf.ok) {
    const runId = initRunDir(`${mode}-blocked`);
    const results = planned.map((t) => ({
      id: t.id,
      passed: false,
      status: "NOT VALIDATED",
      reason: `blocked: ${pf.reason}`,
    }));
    const report = {
      runId,
      status: "BLOCKED",
      pkg: PKG,
      scheme: SCHEME,
      mode,
      blockedReason: pf.reason,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      results,
      passed: 0,
      failed: 0,
      notValidated: results.length,
      artifactsDir: RUN_DIR,
    };
    writeRunJson(runId, report);
    console.error(`[BLOCKED] ${pf.reason}`);
    for (const r of results) console.log(summaryLine(r));
    console.log(`Run dir: ${RUN_DIR}`);
    process.exit(exitZero ? 0 : 2);
  }
  SERIAL_CACHE = pf.serial;

  // Animation-disabled dumps are reliable across every game (see disableAnimations).
  disableAnimations();

  const runId = initRunDir(mode);
  const report = {
    runId,
    status: "COMPLETED",
    device: serial(),
    pkg: PKG,
    scheme: SCHEME,
    mode,
    catalogSize: cat.ids.length,
    deviceInfo: deviceInfo(),
    startedAt: new Date().toISOString(),
    results: [],
  };

  for (const t of planned) {
    if (t.kind === "game") report.results.push(await flowGame(t.id, { pause }));
    else if (t.kind === "warm")
      report.results.push(await flowWarmBundles());
    else if (t.kind === "wordmatch")
      report.results.push(await flowWordMatch());
    else if (t.kind === "workout") report.results.push(await flowWorkout());
  }

  report.endedAt = new Date().toISOString();
  report.passed = report.results.filter((r) => r.passed).length;
  report.failed = report.results.filter((r) => !r.passed).length;
  report.artifactsDir = RUN_DIR;

  writeRunJson(runId, report);
  console.log(
    `\n=== Autobot QA report (${report.passed} PASS / ${report.failed} FAIL) ===`,
  );
  for (const r of report.results) console.log(summaryLine(r));
  console.log(`Run dir: ${RUN_DIR}`);
  console.log(`Report: ${join(RUN_DIR, "run.json")}`);

  if (exitNonZero && report.failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
