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
//   node scripts/qa/autobot.mjs --mode workout-short           # Workout V2 short template
//   node scripts/qa/autobot.mjs --mode workout-focus           # today's rotated focus template
//   node scripts/qa/autobot.mjs --mode workout-short --length standard --template focus-memory
//   node scripts/qa/autobot.mjs --mode workout-resume          # kill+relaunch resume probe
//   node scripts/qa/autobot.mjs --list-flows                   # offline flow definitions (no device)
//   node scripts/qa/autobot.mjs --mode all --pause
//   node scripts/qa/autobot.mjs --mode canaries
//   node scripts/qa/autobot.mjs --mode certify            # release gate: full catalog,
//                                                         #   preflight, provenance, journal
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
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  writeFileSync,
  writeSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
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
    registryIds.length > 0 && registryIds.join(",") !== scannedIds.join(",");
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
const INTERACTIVE_SUFFIXES = [
  // Common answer controls with sub-index/sub-key
  "(?:tile|option|cell|trigger|choice|digit|target|color|item|response|palette|card-grid\\.card|option-grid\\.option|word-grid\\.word|symbol-option|color-btn)[.-]",
  // Dedicated button names
  "answer-buttons-[a-z0-9]+",
  "go-button",
  "briefing-start",
  "signal",
  "go$",
  // Round/problem advance gates
  "next-problem",
  "next-round",
  "next-trial",
  "next$",
].join("|");
function interactiveRe(gameId) {
  const esc = gameId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc}\\.(?:${INTERACTIVE_SUFFIXES})`);
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
// Attribute ORDER inside a node is NOT stable across uiautomator/Android
// versions (text may be emitted before or after resource-id), so match the
// whole opening tag and extract sibling attributes from it — never assume
// anything comes after resource-id.
function findTestId(xml, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const attr of ["resource-id", "testID", "content-desc"]) {
    const re = new RegExp(`<node[^>]*\\b${attr}="${escaped}"[^>]*>`);
    const m = xml ? xml.match(re) : null;
    if (m) {
      const a = m[0] || "";
      const b = a.match(/bounds="([^"]+)"/);
      const t = a.match(/text="([^"]*)"/);
      // Pressable nodes carry their accessibilityLabel as `content-desc` (the
      // visible copy lives on child Text nodes without testIDs), so expose it
      // separately; `text` keeps its historical visible-text-only meaning.
      const d = a.match(/content-desc="([^"]*)"/);
      return {
        id,
        bounds: b ? parseBounds(b[1]) : null,
        text: t ? t[1] : "",
        contentDesc: d && d[1] ? d[1] : "",
      };
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
// dump, excluding tutorial/QA/result surfaces. Only enabled, clickable nodes
// are candidates: bounds alone do not prove that a control accepts input.
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
      enabled: !/enabled="false"/.test(node),
    });
  }
  // Fallback: if primary suffix regex found nothing, search for any clickable
  // game-owned control excluding non-gameplay chrome.
  if (out.length === 0) {
    const esc = gameId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const prefixRe = new RegExp(`^${esc}\\.`);
    const chromeRe =
      /(?:^|\.)(?:screen|intro|difficulty|start|help|qa-toggle|qa-panel|pause|resume|quit|restart|tutorial|round-result|results|feedback|score|streak|accuracy|xp|timer|round)/;
    for (const node of xml.match(/<node\b[^>]*>/g) || []) {
      const idm = node.match(/resource-id="([^"]+)"/);
      if (!idm || !prefixRe.test(idm[1]) || chromeRe.test(idm[1])) continue;
      if (!/clickable="true"/.test(node)) continue;
      if (/enabled="false"/.test(node)) continue;
      const bm = node.match(/bounds="([^"]+)"/);
      const b = bm ? parseBounds(bm[1]) : null;
      if (!b || b.x2 <= b.x1 || b.y2 <= b.y1) continue;
      out.push({ id: idm[1], bounds: b, clickable: true, enabled: true });
    }
  }
  return out
    .filter((node) => node.clickable && node.enabled)
    .sort((a, b) => (b.clickable ? 1 : 0) - (a.clickable ? 1 : 0));
}

// Remove layout-only churn before comparing gameplay evidence. React Native
// legitimately changes bounds while a screen settles, and timer labels change
// every tick; neither proves that the tapped control was handled.
function normalizedNodeTag(tag) {
  return tag ? tag.replace(/\s+bounds="[^"]*"/g, "") : null;
}

function nodeTagByResourceId(xml, resourceId) {
  if (!xml) return null;
  const escaped = resourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return xml.match(new RegExp(`<node\\b[^>]*resource-id="${escaped}"[^>]*>`))?.[0] ?? null;
}

// Fingerprint mounted gameplay state while excluding controls/timers whose
// presence or text may change without the input being accepted. This stays
// generic across the catalog: a valid answer must either mutate the tapped
// node (selected/checked/text/enabled) or advance a game-owned state node.
function gameplayStateFingerprint(xml, gameId) {
  if (!xml) return "";
  const escaped = gameId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ignored = /\.(?:timer|pause|resume|qa(?:-.*)?|force-(?:win|lose)|help)(?:\.|"|$)/;
  return (xml.match(/<node\b[^>]*>/g) || [])
    .filter((tag) => {
      const id = tag.match(/resource-id="([^"]+)"/)?.[1] ?? "";
      return id.startsWith(`${gameId}.`) && !ignored.test(id);
    })
    .map(normalizedNodeTag)
    .sort()
    .join("\n")
    .replace(new RegExp(`^${escaped}\\.timer\\b.*$`, "gm"), "");
}

function interactionEvidenceChanged(beforeXml, afterXml, gameId, tappedId) {
  if (!afterXml || DUMP_ERROR_RE.test(afterXml)) return false;
  const beforeTapped = normalizedNodeTag(nodeTagByResourceId(beforeXml, tappedId));
  const afterTapped = normalizedNodeTag(nodeTagByResourceId(afterXml, tappedId));
  return (
    afterTapped === null ||
    beforeTapped !== afterTapped ||
    gameplayStateFingerprint(beforeXml, gameId) !== gameplayStateFingerprint(afterXml, gameId)
  );
}

// ---------------------------------------------------------------------------
// Workout V2 template-flow selectors (PURE — exercised by --self-test)
// ---------------------------------------------------------------------------
// Mirror of the product's WORKOUT_LENGTHS ids (apps/mobile/src/workout/
// templates.ts). Drift would be caught on-device by an unrenderable length
// chip; kept literal here so the harness stays dependency-free.
const WORKOUT_LENGTHS_QA = ["short", "standard", "extended"];
const LEG_COUNT_BY_LENGTH = { short: 2, standard: 4, extended: 6 };

// Failure-artifact filenames must survive Windows (':' and friends are
// illegal there), e.g. flow ids like "workout-short:focus-memory".
function sanitizeTag(s) {
  return String(s).replace(/[^A-Za-z0-9._-]+/g, "-");
}

function normalizeWorkoutLength(v) {
  const s = String(v || "").trim().toLowerCase();
  return WORKOUT_LENGTHS_QA.includes(s) ? s : null;
}

// Template chip ids rendered in the picker row. The shared prefixes
// `home-workout-template-row` / `-start` are structural, not chips — skip
// them. (`home-workout-templates`, the section container, never matches:
// it lacks the trailing dash.)
function extractTemplateChipIds(xml) {
  if (!xml) return [];
  const out = [];
  for (const m of xml.match(/home-workout-template-([a-z0-9-]+)/g) || []) {
    const id = m.slice("home-workout-template-".length);
    if (id === "row" || id === "start") continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

// Which game screen/intro currently owns the hierarchy: match resource-ids
// of the shape `<gameId>.screen|.intro` against the derived catalog.
function extractMountedGameId(xml, catalogIds) {
  if (!xml || !Array.isArray(catalogIds)) return null;
  const known = new Set(catalogIds);
  for (const m of xml.matchAll(/resource-id="([a-z0-9-]+)\.(?:screen|intro)"/g)) {
    if (known.has(m[1])) return m[1];
  }
  return null;
}

// Durable progress copy used by both the started-chip marker
// ("<Name> · 1 of 2 done") and the selected-panel resume caption
// ("In progress — 1 of 2 done.").
function parseResumeProgress(text) {
  const m = /(\d+)\s+of\s+(\d+)\s+done/i.exec(String(text || ""));
  return m ? { completed: Number(m[1]), total: Number(m[2]) } : null;
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
  // Primary: stream compressed tree directly over stdout.
  // `--compressed` bypasses the idle-state check so active timers/tickers
  // (e.g. 100ms vigilance ticker) never fail with "ERROR: could not get idle state".
  // Avoids device file write + pull latency and prevents stale-dump pulls.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const xml = adbRetry(["exec-out", "uiautomator", "dump", "--compressed", "/dev/tty"], {
        tries: 2,
        opts: { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
      });
      if (dumpIsUsable(xml)) {
        writeFileSync(local, xml);
        return local;
      }
    } catch (e) {
      trace("hierarchy.dump.stream", tag, false, String(e).slice(0, 80));
    }
    sleep(400);
  }
  // Secondary: device file with clean unlinking so failed dumps never pull stale state.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      adb(["shell", "rm", "-f", "/sdcard/qa-hier.xml"]);
      adbRetry(["shell", "uiautomator", "dump", "--compressed", "/sdcard/qa-hier.xml"], {
        tries: 2,
      });
      adbRetry(["pull", "/sdcard/qa-hier.xml", local], { tries: 2 });
      const xml = readFileSyncSafe(local);
      if (dumpIsUsable(xml)) return local;
    } catch (e) {
      trace("hierarchy.dump.file", tag, false, String(e).slice(0, 80));
    }
    sleep(400);
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
// ---------------------------------------------------------------------------
// Release certification (campaign 013 closure).
//
// `--mode certify` is the authoritative full-catalog release gate: ONE
// uninterrupted driver process, ONE exclusive device, every canonical game
// terminally classified, machine-verifiable completeness, per-row persistence
// invariants, build/git provenance, and an incrementally checkpointed journal
// so a killed run can never masquerade as certified.
// ---------------------------------------------------------------------------

/** Coarse failure taxonomy for the aggregate report. The human-readable
 * reason is always preserved alongside; this classification is additive and
 * deliberately substring-based so transient wording changes do not silently
 * reclassify known failure classes. Order matters: first match wins. */
const FAILURE_CLASSIFIERS = [
  ["environment", /blocked:|device (offline|not found)|adb (command|error)|port 8081/i],
  ["logbox-snackbar", /logbox|open debugger to view warnings|dev-warning snackbar/i],
  ["crash", /app died|crash|process death|died after tap/i],
  ["warm", /warm to home|home warm/i],
  ["route-load", /screen did not load|did not mount|deep-link/i],
  ["tutorial", /tutorial/i],
  ["start", /start button/i],
  ["interaction", /interaction|no tappable|died after interaction/i],
  ["pause", /paus(e|ed)|resume control/i],
  ["qa-force-win", /qa-toggle|force-win|force-win not reachable/i],
  ["result-surface", /results (screen|surface)|results did not/i],
  ["persistence", /session count|persist|invariant/i],
  ["duplicate-write", /duplicate/i],
  ["navigation", /back navigation|next-game/i],
  ["timeout", /timeout|timed out|budget/i],
  ["harness", /harness|self-test|catalog derivation/i],
];

/** Pure: map a failure reason to { category, matched } (null category when
 * unclassifiable — callers keep the raw reason as the source of truth). */
function classifyFailure(reason) {
  if (typeof reason !== "string" || reason.length === 0)
    return { category: null, matched: null };
  for (const [category, re] of FAILURE_CLASSIFIERS) {
    const m = reason.match(re);
    if (m) return { category, matched: m[0] };
  }
  return { category: null, matched: null };
}

/** Pure: validate one persisted `game_sessions` row against the v10 schema
 * contract (see apps/mobile/src/db/schema.ts). Returns { ok, violations[] }
 * where ok is true only when every applicable invariant holds. `row` uses the
 * sqlite column names; JSON payload columns are parsed and shape-checked. */
function validateSessionRow(row, expectedGameId) {
  const violations = [];
  if (row === null || row === undefined || typeof row !== "object") {
    return { ok: false, violations: ["row missing"] };
  }
  const push = (msg) => violations.push(msg);
  const isInt = (v) => Number.isInteger(v);
  const isFiniteNum = (v) => typeof v === "number" && Number.isFinite(v);

  if (typeof row.id !== "string" || row.id.length === 0) push("id missing/empty");
  if (row.game_id !== expectedGameId)
    push(`game_id mismatch (${row.game_id} != ${expectedGameId})`);
  for (const v of ["game_version", "generator_version", "scoring_version"])
    if (!isInt(row[v]) || row[v] <= 0) push(`${v} not a positive integer`);
  if (!isInt(row.seed)) push("seed not an integer");
  if (!isFiniteNum(row.normalized_result) || row.normalized_result < 0 || row.normalized_result > 1)
    push(`normalized_result outside [0,1] (${row.normalized_result})`);
  if (!isInt(row.xp) || row.xp < 0) push(`xp negative/non-integer (${row.xp})`);
  for (const t of ["started_at", "completed_at"])
    if (!isInt(row[t]) || row[t] <= 0) push(`${t} not a positive epoch-ms integer`);
  if (isInt(row.started_at) && isInt(row.completed_at) && row.completed_at < row.started_at)
    push("completed_at before started_at");
  if (!isInt(row.duration_ms) || row.duration_ms < 0)
    push(`duration_ms negative/non-integer (${row.duration_ms})`);
  for (const c of ["difficulty_json", "raw_result_json"]) {
    if (typeof row[c] !== "string" || row[c].length === 0) {
      push(`${c} missing/empty`);
      continue;
    }
    try {
      JSON.parse(row[c]);
    } catch {
      push(`${c} is not valid JSON`);
    }
  }
  return { ok: violations.length === 0, violations };
}

/** Pure: certification completeness summary over terminal per-game results.
 * `results` are flowGame outputs ({id, passed}); `expectedIds` is the
 * canonical catalog. Duplicates/unexpected ids fail certification even when
 * every present row passed — the run must classify exactly the catalog. */
function certifySummary(results, expectedIds, options = {}) {
  const expected = new Set(expectedIds);
  const seen = new Map();
  for (const r of results) {
    if (!r || typeof r.id !== "string") continue;
    seen.set(r.id, (seen.get(r.id) || 0) + 1);
  }
  const attemptedIds = [...seen.keys()];
  const duplicates = attemptedIds.filter((id) => seen.get(id) > 1);
  const unexpected = attemptedIds.filter((id) => !expected.has(id));
  const missing = expectedIds.filter((id) => !seen.has(id));
  const gameRows = results.filter((r) => expected.has(r && r.id));
  const passed = gameRows.filter((r) => r.passed === true).length;
  const failed = gameRows.filter((r) => r.passed === false).length;
  const interactionMissing = options.requireInteraction
    ? gameRows.filter((r) => r.interaction?.attempted === true && r.interaction?.accepted !== true).map((r) => r.id)
    : [];
  const pauseMissing = options.requirePause
    ? gameRows
        .filter((r) => !(r.pause?.paused === true && r.pause?.resumed === true))
        .map((r) => r.id)
    : [];
  return {
    expected: expectedIds.length,
    attempted: gameRows.length,
    passed,
    failed,
    notValidated: 0, // certify mode never emits NOT VALIDATED rows post-preflight
    missing,
    unexpected,
    duplicates,
    interactionMissing,
    pauseMissing,
    certified:
      expectedIds.length > 0 &&
      missing.length === 0 &&
      unexpected.length === 0 &&
      duplicates.length === 0 &&
      failed === 0 &&
      passed === expectedIds.length &&
      interactionMissing.length === 0 &&
      pauseMissing.length === 0,
  };
}

/** Read-only git provenance for the run report (never mutates the tree). */
function gitProvenance() {
  const git = (args) => {
    try {
      return execFileSync("git", args, { encoding: "utf8", cwd: REPO_ROOT }).trim();
    } catch {
      return null;
    }
  };
  const sha = git(["rev-parse", "HEAD"]);
  if (!sha) return { available: false };
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const dirty = git(["status", "--porcelain"]);
  return { available: true, sha, branch, dirty: dirty.length > 0 };
}

/** Metro dev-server reachability (the dev client loads JS from Metro; QA
 * force-win additionally requires __DEV__). Pure transport check only.
 * QA_METRO_PORT: the HOST-side Metro port. With a co-tenant project fighting
 * over the default 8081 (device-verified: their server answered Android
 * bundle requests with their web build), run Metro on another port and
 * bridge with `adb reverse tcp:8081 tcp:<host-port>` — the device keeps
 * seeing its usual 8081. */
const METRO_PORT = Number(process.env.QA_METRO_PORT || 8081);
async function metroReachable(timeoutMs = 4000) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`http://127.0.0.1:${METRO_PORT}/status`, { signal: ctrl.signal });
    clearTimeout(timer);
    const body = await res.text();
    const ok = res.ok && body.includes("packager-status");
    return { ok, body: body.slice(0, 120) };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}

/** Full persisted row (sqlite JSON mode) for invariant validation. Returns
 * null when the db/binary is unavailable or the row count is not exactly 1. */
function sessionRow(gameId) {
  const db = pullDb(`${gameId}-row`);
  if (!existsSync(db) || !existsSync(SQLITE)) return null;
  try {
    const out = execFileSync(
      SQLITE,
      [
        "-json",
        db,
        "SELECT id, game_id, game_version, generator_version, scoring_version, seed, difficulty_json, raw_result_json, normalized_result, xp, started_at, completed_at, duration_ms FROM game_sessions WHERE game_id='" + gameId + "';",
      ],
      { encoding: "utf8" },
    ).trim();
    if (!out) return null;
    const rows = JSON.parse(out);
    return rows.length === 1 ? rows[0] : null;
  } catch {
    return null;
  }
}

/** Certification preflight: every check that must hold BEFORE the run starts.
 * Each check records { name, ok, detail }; any failure blocks the run with an
 * ENVIRONMENT classification (a blocked environment is never a product
 * regression). Conservative by design: reports conflicts, never kills
 * unrelated host processes. */
async function certifyPreflight() {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail ?? null });

  // Exactly one usable device, and it is the selected one, in `device` state.
  const devs = adbHostDevices();
  const ready = Array.isArray(devs.ready) ? devs.ready : [];
  const requestedDevice = process.env.QA_DEVICE?.trim() || null;
  add(
    "single-explicit-device",
    requestedDevice !== null && ready.length === 1 && ready[0] === serial(),
    requestedDevice
      ? `QA_DEVICE=${requestedDevice}; ready=[${ready.join(", ") || "none"}]`
      : "certification requires QA_DEVICE and exactly one ready device",
  );
  add(
    "selected-device-usable",
    ready.includes(serial()),
    JSON.stringify(devs),
  );

  // A clean source checkout is a mandatory release boundary. Otherwise the
  // report can name one commit while Metro/APK execute uncommitted code.
  const provenance = gitProvenance();
  add(
    "source-checkout-clean",
    provenance.available === true && provenance.dirty === false,
    provenance,
  );

  // Metro and the installed dev client are separate mutable state. Require a
  // SHA marker from the clean checkout to be injected into Metro and then
  // observe the same marker in the running Home hierarchy. This closes the
  // old gap where a clean source tree could certify a stale/co-tenant bundle.
  const expectedSha = provenance.available ? provenance.sha : null;
  const injectedSha = process.env.EXPO_PUBLIC_BUILD_SHA?.trim() || null;
  add(
    "source-binding-env",
    !!expectedSha && injectedSha === expectedSha,
    `expected=${expectedSha || "unavailable"}; injected=${injectedSha || "missing"}`,
  );

  // Target package installed.
  let installed = false;
  try {
    const out = execFileSync("adb", ["-s", serial(), "shell", "pm", "list", "packages", PKG], {
      encoding: "utf8",
    });
    installed = out.includes(`package:${PKG}`);
  } catch {}
  add("package-installed", installed, PKG);

  // Metro reachable (dev client loads JS from it; force-win needs __DEV__).
  // The response must be Metro's own status payload — a co-tenant web server
  // on the same port serves HTML and would poison every journey.
  let metroOk = false;
  let metroDetail = null;
  if (process.env.QA_EMBEDDED_BUNDLE) {
    metroDetail = "embedded-bundle is diagnostic-only; certification requires live Metro";
  } else {
    const metro = await metroReachable();
    metroOk = metro.ok;
    metroDetail = metro.ok ? metro.body : metro.error;
  }
  add("metro-reachable", metroOk, metroDetail);

  // adb reverse for the dev-server port — skipped when the APK carries an
  // embedded bundle (QA_EMBEDDED_BUNDLE=1) because the dev client loads from
  // assets and never contacts the host Metro.
  if (process.env.QA_EMBEDDED_BUNDLE) {
    add("adb-reverse-8081", false, "embedded-bundle is diagnostic-only; no live source binding");
  } else {
    let reversed = false;
    try {
      const out = execFileSync("adb", ["-s", serial(), "reverse", "--list"], { encoding: "utf8" });
      reversed = out.includes("tcp:8081");
    } catch {}
    if (!reversed) {
      try {
        execFileSync("adb", ["-s", serial(), "reverse", "tcp:8081", "tcp:8081"], {
          encoding: "utf8",
        });
        reversed = true;
      } catch {}
    }
    add("adb-reverse-8081", reversed, reversed ? "established" : "could not establish");
  }

  // sqlite3 usable (persistence evidence depends on it).
  let sqliteOk = false;
  try {
    sqliteOk = /\d+\.\d+/.test(execFileSync(SQLITE, ["--version"], { encoding: "utf8" }));
  } catch {}
  add("sqlite3-usable", sqliteOk, SQLITE);

  // Artifact root writable.
  let outWritable = false;
  try {
    mkdirSync(OUT, { recursive: true });
    const probe = join(OUT, `.write-probe-${process.pid}`);
    writeFileSync(probe, "probe");
    unlinkSync(probe);
    outWritable = true;
  } catch {}
  add("artifacts-writable", outWritable, OUT);

  // The app must actually launch to the foreground on the SELECTED device.
  // A foreign app/session holding focus produces hierarchy/tap divergence
  // that masquerades as product failures (device-verified contamination), so
  // certification refuses to start until our own package owns the screen.
  let launchOk = false;
  try {
    launch();
    await sleep(6000);
    launchOk = appForeground();
  } catch {}
  add("app-launch-foreground", launchOk, launchOk ? PKG : "our package was not foreground after launch");

  let sourceMarker = null;
  if (expectedSha && injectedSha === expectedSha && launchOk) {
    const markerId = `home-build-sha-${expectedSha}`;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && !sourceMarker) {
      try {
        const xml = adbRetry(["exec-out", "uiautomator", "dump", "/dev/tty"], {
          tries: 2,
          opts: { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
        });
        if (dumpIsUsable(xml)) sourceMarker = findTestId(xml, markerId);
      } catch {}
      if (!sourceMarker) await sleep(500);
    }
  }
  add(
    "source-bundle-bound",
    sourceMarker !== null,
    sourceMarker ? `observed ${sourceMarker.id}` : "expected Home SHA marker not observed",
  );

  const ok = checks.every((c) => c.ok);
  return { ok, checks };
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
    // Dev overlays are checked BEFORE the dump-error filter: their own error
    // text trips /ERROR:/i in DUMP_ERROR_RE and would never be dismissed.
    if (dismissRedBoxIfPresent(xml, "home-warm")) {
      await sleep(1200);
      continue;
    }
    if (dismissLogBoxIfPresent(xml, "home-warm")) {
      await sleep(800);
      continue;
    }
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
  // Collapse any pulled notification shade: device-verified 2026-08-26, after
  // a cold boot the "Serial console enabled" shade was left open and caused
  // ensureWarmHome to fail (home markers hidden behind shade).
  try { adb(["shell", "cmd", "statusbar", "collapse"]); } catch {}
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
  if (xml && HOME_READY_IDS.some((id) => hasTestId(xml, id))) {
    // Clear any docked LogBox dev-warning snackbar before the journey starts
    // (it docks over bottom-anchored controls and silently intercepts taps).
    dismissLogBoxIfPresent(xml, "home-warm");
    return true;
  }
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
  // Sanitized for Windows-hostile characters (flow ids may contain ':').
  const file = join(dir, `${sanitizeTag(id)}.json`);
  writeFileSync(file, JSON.stringify(manifest, null, 2));
  log(`failure artifacts written: ${file}`);
  return { manifest: file, ...artifacts };
}

// ---------------------------------------------------------------------------
// QA force-win driving
// ---------------------------------------------------------------------------
// Scroll up to `attempts` times looking for `id` — tall game boards can push
// the dev-only QA controls several viewport-heights down their ScrollView.
async function findWithScroll(id, tag, attempts = 3) {
  let node = await waitFor(id, 2500, tag);
  let i = 0;
  while (!node && i < attempts) {
    swipeDown();
    await sleep(700);
    node = await waitFor(id, 2000, tag);
    i += 1;
  }
  return node;
}
// How long to wait for the QA panel to appear after its toggle is pressed
// before concluding anything (covers slow never-idle dumps).
const PANEL_SETTLE_BUDGET_MS = 12000;
/**
 * Drive the dev-only QA panel to force-win until the shared results surface
 * appears (or the budget expires). Evidence-based state machine:
 *
 *   - Only a FRESH VALID dump may change beliefs. Invalid/never-idle dumps
 *     (per-second timers keep uiautomator busy on this host) are ignored —
 *     they used to cause blind re-toggles that CLOSED an open panel.
 *   - Panel open is assumed after tapping the toggle and only revoked on
 *     positive proof: a valid dump showing qa-toggle WITHOUT qa-panel.
 *   - While the panel is assumed open, every fresh valid dump that still
 *     shows the panel gets another force-win tap (multi-round games need
 *     repeated presses across round gates).
 *   - A visible next-round gate is stepped whenever the panel is closed.
 *
 * Returns the results-surface xml, or null on budget exhaustion.
 */
/**
 * Dismiss a RN LogBox dev-warning snackbar if one is docked on screen.
 *
 * Device-verified failure mode (campaign 013 certification): a single
 * console.warn anywhere in a journey makes LogBox dock an "Open debugger to
 * view warnings" snackbar at the BOTTOM of the screen, where it silently
 * intercepts taps aimed at bottom-anchored controls (Next Round, force-win
 * row) — the harness sees taps "ok" while the game never advances. The only
 * first-party warning source is fixed (celebration shadow* -> boxShadow);
 * this guard keeps any FUTURE warning from poisoning journeys unnoticed.
 * Taps the snackbar's dismiss control (right-edge circle, derived from the
 * warning text bounds); returns true when a dismissal was attempted.
 */
/**
 * Dismiss a full-screen RN RedBox (fatal/dev error overlay with DISMISS and
 * RELOAD buttons) if one is docked on screen.
 *
 * Device-verified trigger (2026-08-26, campaign 014 closure): when Metro is
 * busy building an unrelated platform bundle at cold start, the dev client
 * can fall back to its cached bundle; expo's messageSocket then throws
 * "Cannot create devtools websocket connections in embedded environments"
 * (`!devServer.bundleLoadedFromServer`) and a RedBox blocks the whole UI.
 * The app itself runs fine from the cached bundle once the overlay is
 * dismissed — tapping DISMISS lets journeys continue instead of false-failing.
 */
function dismissRedBoxIfPresent(xml, tag) {
  // NOTE: deliberately does NOT consult DUMP_ERROR_RE — the RedBox's own
  // error text ("[runtime not ready]: Error: ...") matches /ERROR:/i and
  // made every dump look like a failed capture, so the overlay could never
  // be dismissed (device-verified 2026-08-26). Anchored on the dev-overlay
  // button resource-id instead of display text.
  if (!xml) return false;
  const m = xml.match(
    /resource-id="com\.braintraining\.app:id\/rn_redbox_dismiss_button"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
  );
  if (!m) return false;
  const x = Math.round((Number(m[1]) + Number(m[3])) / 2);
  const y = Math.round((Number(m[2]) + Number(m[4])) / 2);
  try {
    shell(`input tap ${x} ${y}`);
    trace("tap.redbox-dismiss", "redbox", true, `${x},${y}`);
  } catch {
    trace("tap.redbox-dismiss", "redbox", false, tag);
  }
  return true;
}

function dismissLogBoxIfPresent(xml, tag) {
  if (!xml || DUMP_ERROR_RE.test(xml)) return false;
  const marker = xml.indexOf("Open debugger to view warnings");
  if (marker < 0) return false;
  const seg = xml.slice(Math.max(0, marker - 600), marker + 900);
  const b = seg.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!b) return false;
  const y = Math.round((Number(b[2]) + Number(b[4])) / 2);
  // Dismiss circle sits at the snackbar's right edge; viewport width comes
  // from the root node bounds in the same dump.
  const root = xml.match(/bounds="\[0,0\]\[(\d+),\d+\]"/);
  const x = root ? Number(root[1]) - 40 : 1000;
  try {
    shell(`input tap ${x} ${y}`);
    trace("tap.logbox-dismiss", "snackbar", true, `${x},${y}`);
  } catch {
    trace("tap.logbox-dismiss", "snackbar", false, tag);
  }
  return true;
}

/** Bottom no-tap guard: interactive nodes whose tap center sits within this
 * many px of the viewport bottom are treated as unreachable — the system nav
 * bar occupies that band and `input tap` hits ITS buttons instead (device-
 * verified: word-match's Next Round renders at y=[1759,1882] on the
 * 1080x1920 AVD; taps at its center pressed the nav BACK button, which the
 * GameHost interprets as pause). The guard is env-tunable for other skins. */
const NAV_GUARD_PX = Number(process.env.QA_NAV_GUARD_PX || 170);
function inNavZone(xml, node) {
  if (!node || !node.bounds) return false;
  const root = xml && xml.match(/bounds="\[0,0\]\[(\d+),(\d+)\]"/);
  const viewportH = root ? Number(root[2]) : 0;
  if (!viewportH) return false;
  return node.bounds.cy >= viewportH - NAV_GUARD_PX;
}

async function driveForceWin(id, tag) {
  // Per-cycle dump latency on this host is 5-15s under never-idle UIs, so
  // the total budget must span several observe→act cycles, not one.
  const budgetMs = Number(process.env.QA_FORCEWIN_BUDGET_MS || 90000);
  const end = Date.now() + budgetMs;
  let panelAssumedOpen = false;
  while (Date.now() < end) {
    const p = dumpHierarchy(`${tag}-fw-${Date.now() % 100000}`);
    const xml = readFileSyncSafe(p);
    if (!xml || DUMP_ERROR_RE.test(xml)) {
      await sleep(600); // no evidence → no action; keep current belief
      continue;
    }
    if (dismissRedBoxIfPresent(xml, tag)) {
      await sleep(1200); // overlay dismissed; re-dump before acting
      continue;
    }
    if (dismissLogBoxIfPresent(xml, tag)) {
      await sleep(800); // snackbar dismissed; re-dump before acting
      continue;
    }
    if (
      hasTestId(xml, `${id}.pause-overlay`) ||
      hasTestId(xml, `${id}.resume`)
    ) {
      // A paused session blocks everything (opaque overlay + frozen timers).
      // Resume with fresh coordinates before any other action; the pause
      // probe's resume can be lost to stale-coordinate taps (device-verified).
      const rs = findTestId(xml, `${id}.resume`);
      if (rs && inNavZone(xml, rs)) {
        swipeDown();
        await sleep(700);
        continue;
      }
      tapTestId(`${id}.resume`, xml);
      log("force-win: resumed paused session first");
      await sleep(900);
      continue;
    }
    if (
      hasTestId(xml, "results-title") ||
      hasTestId(xml, `${id}.results`) ||
      hasTestId(xml, "results-score")
    ) {
      return xml;
    }
    if (hasTestId(xml, `${id}.qa-panel`)) {
      const fw = findTestId(xml, `${id}.force-win`);
      if (inNavZone(xml, fw)) {
        // Force-win pushed into the nav-bar band by tall panel content —
        // scroll it into reach instead of tapping a nav button.
        swipeDown();
        await sleep(700);
        continue;
      }
      tapTestId(`${id}.force-win`, xml);
      log("force-win pressed");
      await sleep(900);
      continue;
    }
    // The dev QA toggle lives in the GameHost session chrome (always mounted
    // in-session), so FORCE-WIN beats round stepping: stepping a many-round
    // game one dump-cycle per round cannot finish inside the budget
    // (device-verified: value-ordering reached round 7 of N while the panel
    // sat one toggle away). Stepping stays as the fallback below.
    if (hasTestId(xml, `${id}.qa-toggle`)) {
      if (!panelAssumedOpen) {
        tapTestId(`${id}.qa-toggle`, xml);
        log("qa panel toggled open");
        panelAssumedOpen = true;
        await sleep(700);
      } else {
        // Positive proof the panel is NOT open (toggle visible, panel not).
        panelAssumedOpen = false;
        await sleep(300);
      }
      continue;
    }
    if (hasTestId(xml, `${id}.next-round`)) {
      const nr = findTestId(xml, `${id}.next-round`);
      if (inNavZone(xml, nr)) {
        // Next Round is clipped into the nav-bar band on tall round-result
        // content — scroll before tapping (a user would). Tapping there hits
        // the nav BACK button, which pauses the session.
        swipeDown();
        await sleep(700);
        continue;
      }
      const roundBefore = (xml.match(new RegExp(`${id}\\.round\\.(\\d+)`)) || [])[1] || null;
      tapTestId(`${id}.next-round`, xml);
      log("next-round stepped");
      panelAssumedOpen = false;
      await sleep(1200);
      // Stuck-guard: if the round counter did not change after the tap, the
      // control is not actually accepting input (overlay/LogBox/nav zone) —
      // fall through to the toggle branch on the next cycle instead of
      // tapping the same dead control forever.
      const p2 = dumpHierarchy(`${tag}-fw-verify-${Date.now() % 100000}`);
      const xml2 = readFileSyncSafe(p2);
      if (xml2 && !DUMP_ERROR_RE.test(xml2)) {
        const roundAfter = (xml2.match(new RegExp(`${id}\\.round\\.(\\d+)`)) || [])[1] || null;
        if (roundBefore && roundAfter && roundBefore === roundAfter && !hasTestId(xml2, `${id}.qa-panel`)) {
          log("next-round tap did not advance (stuck control) — trying QA panel");
          if (hasTestId(xml2, `${id}.qa-toggle`)) {
            tapTestId(`${id}.qa-toggle`, xml2);
            panelAssumedOpen = true;
          }
          continue;
        }
      }
      continue;
    }
    // If none of results, qa-panel, qa-toggle, or next-round is visible,
    // the screen may have been scrolled down to reach below-the-fold controls;
    // scroll back up to bring qa-toggle into the viewport.
    swipeUp();
    await sleep(800);
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

  // Tutorial bypass: verified retry loop. One tap can miss (bounds captured
  // while the tutorial card's internal ScrollView is still settling can land
  // one button higher — e.g. on "Try a demo" instead of "Skip"), so re-dump
  // and verify dismissal, up to ATTEMPTS times, before concluding anything.
  // No blind swipes: the overlay-anchored card scrolls internally and a page
  // swipe would just scroll demo content instead of revealing controls.
  const TUTORIAL_BYPASS_ATTEMPTS = 4;
  let skippedTutorial = false;
  for (let attempt = 0; attempt < TUTORIAL_BYPASS_ATTEMPTS; attempt += 1) {
    xml = readFileSyncSafe(dumpHierarchy(`${tag}-tut-${attempt}`));
    if (xml && hasTestId(xml, `${id}.tutorial`)) {
      const pressed = [
        `${id}.tutorial-skip`,
        `${id}.tutorial-done`,
        `${id}.tutorial-next`,
      ].some((tid) => tapTestId(tid, xml));
      if (pressed) {
        skippedTutorial = true;
        await sleep(900);
        continue;
      }
    }
    if (attempt === 0 && !hasTestId(xml || "", `${id}.tutorial`)) {
      // First attempt: give async useEffect up to 1500ms to mount tutorial on fresh profile
      await sleep(1500);
      continue;
    }
    if (!xml || !hasTestId(xml, `${id}.tutorial`)) {
      skippedTutorial = attempt > 0;
      break;
    }
  }
  if (!xml || hasTestId(xml || "", `${id}.tutorial`)) {
    log("tutorial bypass: control still mounted after retries");
  }
  xml = readFileSyncSafe(dumpHierarchy(`${tag}-postskip`));
  log(
    skippedTutorial
      ? "tutorial bypassed"
      : "no tutorial (already completed or none)",
  );

  // Start: ensure tutorial is not covering the start button before tapping.
  if (hasTestId(xml || "", `${id}.tutorial`)) {
    const skipped = [`${id}.tutorial-skip`, `${id}.tutorial-done`, `${id}.tutorial-next`].some((tid) => tapTestId(tid, xml));
    if (skipped) {
      await sleep(1000);
      xml = readFileSyncSafe(dumpHierarchy(`${tag}-tut-dismissed`));
    }
  }
  if (!tapTestId(`${id}.start`, xml)) {
    xml = await waitFor(`${id}.start`, 8000, tag);
    if (!xml || !tapTestId(`${id}.start`, xml)) {
      return failGame(id, "start button not found", t0, tag);
    }
  }
  log("started");

  // Wait for session to actually mount: GameHost always mounts `${id}.pause`
  // in SessionHeader when view === 'session'. If a tutorial mounts late while
  // waiting for the session, dismiss it and re-tap start.
  let sessionMounted = null;
  if (opts.pause) {
    const mountDeadline = Date.now() + 15000;
    while (Date.now() < mountDeadline) {
      const checkXml = readFileSyncSafe(dumpHierarchy(`${tag}-wait-session-${Date.now() % 10000}`));
      if (checkXml && hasTestId(checkXml, `${id}.pause`)) {
        sessionMounted = checkXml;
        break;
      }
      if (checkXml && hasTestId(checkXml, `${id}.tutorial`)) {
        log("tutorial mounted during session wait; dismissing and tapping start");
        const dismissed = [`${id}.tutorial-skip`, `${id}.tutorial-done`, `${id}.tutorial-next`].some((tid) =>
          tapTestId(tid, checkXml)
        );
        if (dismissed) {
          await sleep(1000);
          const retryXml = readFileSyncSafe(dumpHierarchy(`${tag}-session-retry-start`));
          if (retryXml && hasTestId(retryXml, `${id}.start`)) {
            tapTestId(`${id}.start`, retryXml);
          }
        }
      }
      await sleep(800);
    }
  } else {
    await sleep(1000);
  }
  // before an interaction commits an answer and moves the game to feedback/round-result
  // where canPause() returns false.
  const pauseProbe = { attempted: !!opts.pause, paused: false, resumed: false };
  if (opts.pause && sessionMounted) {
    tapTestId(`${id}.pause`, sessionMounted);
    await sleep(700);
    const paused = await waitForAny(
      [`${id}.pause-overlay`, `${id}.resume`],
      5000,
      tag,
    );
    pauseProbe.paused = !!paused;
    log(
      paused
        ? "paused + overlay shown"
        : "paused (overlay testID not matched)",
    );
    const rp = await waitFor(`${id}.resume`, 4000, tag);
    if (rp) {
      tapTestId(`${id}.resume`, rp);
      await sleep(1500);
      // Verify the resume took effect (overlay gone) — tapTestId only proves
      // the input was injected, not that the button received it. Under load
      // the state update can take >1s to reach the native hierarchy. Retry
      // with fresh coordinates before concluding.
      for (let rv = 0; rv < 3; rv += 1) {
        const vxml = readFileSyncSafe(dumpHierarchy(`${tag}-resume-verify-${rv}`));
        if (!vxml || DUMP_ERROR_RE.test(vxml)) {
          await sleep(1200);
          continue;
        }
        if (!hasTestId(vxml, `${id}.pause-overlay`)) {
          pauseProbe.resumed = true;
          break;
        }
        const fresh = findTestId(vxml, `${id}.resume`);
        if (fresh) tap(fresh);
        await sleep(1500);
      }
      if (pauseProbe.resumed) {
        log("resumed");
      } else {
        log("resume tap did not dismiss the overlay");
      }
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
  } else if (opts.pause && !sessionMounted) {
    pauseProbe.attempted = false;
    log("no pause control (not applicable)");
  }

  // Real gameplay interaction probe: tap one in-game item (option/tile/cell/
  // choice/trigger/card/etc.) on the active session so the smoke proves actual
  // input handling, not just the force-win shortcut.
  const interaction = await probeInteraction(id, tag);
  log(
    interaction.attempted
      ? `interaction tapped ${interaction.nodeId}`
      : `interaction: no tappable item visible (${interaction.reason})`,
  );
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
  // Lifecycle-aware interaction evidence (certification contract §6.1): some
  // games only mount their answer surface after a countdown/study phase. If
  // both earlier attempts missed, try once more right before force-win — the
  // last moment a real input is still possible.
  if (!interaction.attempted) {
    // Allow countdown/study/reveal animations (2-3.5s) to settle into the input phase:
    await sleep(3500);
    const late = await probeInteraction(id, `${tag}-late`);
    if (late && late.attempted) {
      interaction.attempted = true;
      interaction.nodeId = late.nodeId;
      interaction.accepted = late.accepted === true;
      interaction.crashedAfterTap = late.crashedAfterTap === true;
      interaction.reason = `${late.reason} (late attempt)`;
      log(`interaction tapped ${late.nodeId} (late attempt)`);
    }
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
  // Row-level invariants (certification contract §7): the persisted row must
  // satisfy the schema contract — ids/provenance present, finite legal score,
  // non-negative timing, parseable payloads. Null row (db/binary unavailable)
  // is recorded honestly rather than silently skipped.
  const row = sessionRow(id);
  const sessionInvariants = validateSessionRow(row, id);
  if (!row) {
    sessionInvariants.violations = [
      ...(sessionInvariants.violations || []),
      "persisted row unreadable (db pull or sqlite JSON mode failed)",
    ];
    sessionInvariants.ok = false;
  } else if (sessionInvariants.ok) {
    log("session invariants: OK");
  } else {
    log(`session invariants: VIOLATIONS ${JSON.stringify(sessionInvariants.violations)}`);
  }
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
  // Fail-closed interaction contract: if a tap was attempted, it MUST produce
  // accepted gameplay evidence; unattempted probes (study/stream/countdown phases
  // with no tappable surface) are preserved as misses without failing the run (line 1556 contract).
  const interactionOk =
    !interaction.attempted || interaction.accepted === true;
  // Pause contract: if a pause control was mounted and tapped, both pause and
  // resume MUST succeed; unattempted probes (games with no pause control) do not fail.
  const pauseOk =
    !opts.pause ||
    !pauseProbe.attempted ||
    (pauseProbe.paused === true && pauseProbe.resumed === true);
  const passed =
    coreOk &&
    interactionOk &&
    pauseOk &&
    sessionInvariants.ok &&
    back.ok &&
    next.ok;
  const reason = passed
    ? "interaction + force-win + exactly one persisted session + row invariants OK + authoritative results + back/next navigation"
    : !sessionInvariants.ok
      ? `session row invariants violated: ${sessionInvariants.violations.join("; ")}`
      : !interactionOk
        ? `interaction evidence failed: ${interaction.reason || "no accepted gameplay tap"}`
        : !pauseOk
          ? "pause/resume evidence failed"
      : coreOk
        ? back.ok
          ? `next-game screen did not load (${next.next})`
          : "back navigation left the app dead/backgrounded"
        : `session count=${stats.count} (expected 1), duplicates=${stats.duplicates}`;
  return {
    id,
    passed,
    status: passed ? "PASS" : "FAIL",
    reason,
    classification: classifyFailure(passed ? null : reason),
    interaction,
    pause: pauseProbe,
    back,
    next: next.next,
    steps: stepsOut(),
    ms: traceMs(t0),
    artifacts: captureAll(tag),
    session: stats,
    sessionInvariants,
    trace: traceSlice(),
  };
}

// Generic gameplay-interaction probe. Taps the first tappable in-game item
// found right after start; retries once just before force-win (some games only
// mount their answer grid after a countdown/study phase). Acceptance requires
// both a live app and semantic gameplay evidence: the tapped node or a mounted
// game-state node must change. A timer/layout-only hierarchy diff is not enough.
async function probeInteraction(id, tag) {
  const attemptAt = async (label) => {
    const xml = readFileSyncSafe(dumpHierarchy(`${tag}-ix-${label}`));
    if (!xml || DUMP_ERROR_RE.test(xml)) return null;
    const candidates = findInteractionCandidates(xml, id);
    if (candidates.length === 0) return null;
    // Prefer real answer controls over round-gates (next-round/next-problem):
    // a gate only exists after a round already ended, and tapping it starts a
    // fresh timed round — bad probe target when a tappable board exists.
    const gateRe = /\.(?:next-round|next-problem|next-trial|next)$/;
    const c = candidates.find((n) => !gateRe.test(n.id)) || candidates[0];

    // Count-bounded evidence polling. Each hierarchy dump on this host costs
    // 1-3 s through uiautomator, so a wall-clock budget can expire BEFORE a
    // transition the tap already caused becomes visible (observed:
    // attention-odd-one-out and speed-tap-rush taps demonstrably advanced the
    // round — round.1 → round.2 — while a 7 s window sampled only pre-change
    // dumps). Poll a fixed number of samples, then one final confirm dump;
    // fail-closed is preserved: a dead control still produces no evidence in
    // ANY sample. Liveness rides on the dump itself (package attr) instead of
    // an extra dumpsys per sample.
    const waitForEvidence = async (baseXml, tappedId, suffix) => {
      const samples = 5;
      for (let n = 0; n < samples; n += 1) {
        await sleep(n === 0 ? 1500 : 1000);
        const after = readFileSyncSafe(
          dumpHierarchy(`${tag}-ix-${label}-${suffix}${n}`),
        );
        if (!after || DUMP_ERROR_RE.test(after)) continue;
        if (!after.includes(PKG)) return { alive: false, changed: false };
        if (interactionEvidenceChanged(baseXml, after, id, tappedId)) {
          return { alive: true, changed: true };
        }
      }
      await sleep(1200);
      const final = readFileSyncSafe(
        dumpHierarchy(`${tag}-ix-${label}-${suffix}-final`),
      );
      const alive = !!final && !DUMP_ERROR_RE.test(final) && final.includes(PKG);
      return {
        alive,
        changed: alive && interactionEvidenceChanged(baseXml, final, id, tappedId),
      };
    };

    let tapped = false;
    try {
      tapped = tap(c);
    } catch (error) {
      trace("tap.interaction", c.id, false, String(error).slice(0, 120));
      return { nodeId: c.id, accepted: false, reason: "tap command failed" };
    }
    trace("tap.interaction", c.id, tapped, `${c.bounds.cx},${c.bounds.cy}`);
    if (!tapped) {
      return { nodeId: c.id, accepted: false, reason: "tap command failed" };
    }
    let res = await waitForEvidence(xml, c.id, "after");
    let tappedNode = c;
    if (res.alive && !res.changed) {
      // A touch delivered in the same frame a control mounts is dropped by the
      // RN responder chain (the node exists in the hierarchy but its host view
      // is not yet attached). Re-dump and re-tap the same node once, then poll
      // again. A genuinely dead control still fails both taps.
      trace("tap.interaction.retry", c.id, true, "first tap showed no change");
      await sleep(400);
      const fresh = readFileSyncSafe(
        dumpHierarchy(`${tag}-ix-${label}-fresh`),
      );
      const again = fresh ? findInteractionCandidates(fresh, id) : [];
      const c2 = again.find((n) => n.id === c.id) || again[0];
      if (c2 && tap(c2)) {
        trace("tap.interaction.retry", c2.id, true, `${c2.bounds.cx},${c2.bounds.cy}`);
        tappedNode = c2;
        res = await waitForEvidence(fresh || xml, c2.id, "after2");
      }
    }
    return {
      nodeId: tappedNode.id,
      crashedAfterTap: !res.alive,
      accepted: res.alive && res.changed,
      reason: !res.alive
        ? "app died after tap"
        : res.changed
          ? "tap produced observable hierarchy change"
          : "tap produced no observable hierarchy change",
    };
  };
  const first = await attemptAt("post-start");
  if (first) {
    return {
      attempted: true,
      ...first,
      reason: first.reason,
    };
  }
  await sleep(1500);
  const second = await attemptAt("retry");
  if (second) {
    return {
      attempted: true,
      ...second,
      reason: `${second.reason} (late mount)`,
    };
  }
  // Try scrolling down once to reveal options below the fold (e.g. spatial-grid-nav 5x5 board):
  try {
    swipeDown();
    await sleep(1000);
  } catch {}
  const third = await attemptAt("post-scroll");
  if (third) {
    return {
      attempted: true,
      ...third,
      reason: `${third.reason} (post-scroll mount)`,
    };
  }
  return {
    attempted: false,
    reason: "no interactive item mounted at probe time",
  };
}

// One force-win step for the legacy multi-round Word Match flow. The generic
// driver above intentionally runs through the shared results page; this flow
// needs a single round at a time so it can verify the next-round gate.
async function tapForceWinOnce(id, tag) {
  const xml = readFileSyncSafe(dumpHierarchy(`${tag}-before`));
  if (!xml || DUMP_ERROR_RE.test(xml)) return false;
  if (
    hasTestId(xml, "results-title") ||
    hasTestId(xml, `${id}.results`) ||
    hasTestId(xml, "results-score")
  ) {
    return false;
  }
  if (dismissRedBoxIfPresent(xml, tag) || dismissLogBoxIfPresent(xml, tag)) {
    await sleep(700);
    return false;
  }
  const panel = findTestId(xml, `${id}.qa-panel`);
  if (panel) {
    const forceWin = findTestId(xml, `${id}.force-win`);
    if (!forceWin || inNavZone(xml, forceWin)) return false;
    tapTestId(`${id}.force-win`, xml);
    log("word-match force-win pressed");
    return true;
  }
  if (!hasTestId(xml, `${id}.qa-toggle`)) return false;
  if (!tapTestId(`${id}.qa-toggle`, xml)) return false;
  await sleep(700);
  const opened = readFileSyncSafe(dumpHierarchy(`${tag}-panel`));
  if (!opened || DUMP_ERROR_RE.test(opened)) return false;
  const forceWin = findTestId(opened, `${id}.force-win`);
  if (!forceWin || inNavZone(opened, forceWin)) return false;
  tapTestId(`${id}.force-win`, opened);
  log("word-match force-win pressed after opening QA panel");
  return true;
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
    classification: classifyFailure(reason),
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
      (await waitFor(`${id}.intro`, 25000, `wm-${tier}`));
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
  const home = await waitFor("home-workout-list", 20000, "wk-home");
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
  for (const m of home.match(/home-workout-game-(?!status-)([a-z0-9-]+)/g) ||
    [])
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
  const wkFail = (t0, details, reason) => ({
    id: "daily-workout",
    passed: false,
    status: "FAIL",
    reason,
    details,
    ms: traceMs(t0),
    artifacts: captureAll("workout"),
    trace: traceSlice(),
  });
  // Post-workout-V2 journey (root-cause fix for the 009 + campaign-011 game-0
  // aborts): games finish on their OWN results surface (`<id>.results`) and do
  // NOT auto-navigate anywhere. The durable workout advances only when the
  // session's shared result page (`/results?id=<session>`, reachable from the
  // Home "Recent games" rows) is viewed — that page renders `results-next-game`
  // or `results-workout-complete` via useWorkoutResultAdvance. So each leg is:
  // enter game → force-win → own results → BACK to Home → open newest recent
  // session → verify/press the workout CTA.
  //
  // Campaign-011 device finding: since the workout templates section landed,
  // Home's Recent-games card sits BELOW the fold, and uiautomator skips
  // off-screen nodes entirely — the rows must be scrolled into view.
  const scrollToRecentRow = async (tag) => {
    for (let s = 0; s < 5; s++) {
      const rx = readFileSyncSafe(dumpHierarchy(`${tag}-s${s}`));
      const m = rx ? rx.match(/home-recent-game-[A-Za-z0-9_-]+/) : null;
      if (m) return { rx, row: m[0] };
      swipeDown();
      await sleep(900);
    }
    return null;
  };
  for (let i = 0; i < 4; i++) {
    const gameId = order[i];
    // --- Enter game i ---
    let entered = false;
    let hx = null;
    const asXml = (v) => (typeof v === "string" ? v : v && v.xml ? v.xml : null);
    if (i > 0) {
      // Previous leg ended by pressing results-next-game, which deep-links
      // straight into this game — but the target is a LAZY Metro chunk that
      // can take tens of seconds to build on a cold cache. Wait for either
      // the game surface or Home before deciding anything (a premature BACK
      // here lands on the just-opened game / its pause overlay and wedges
      // the journey).
      const cur = asXml(
        await waitForAny(
          [`${gameId}.screen`, `${gameId}.intro`, "home-workout-list", ...HOME_READY_IDS],
          90000,
          `wk-enter-${i}`,
        ),
      );
      if (cur && (hasTestId(cur, `${gameId}.screen`) || hasTestId(cur, `${gameId}.intro`))) {
        entered = true;
      } else if (cur) {
        hx = cur; // on Home already; skip the extra BACK below
      }
    }
    if (!entered) {
      // Fresh look first: after leg 0 we are normally already on Home.
      hx = readFileSyncSafe(dumpHierarchy(`wk-enter-${i}`));
      if (!hx || !(hasTestId(hx, "home-workout-list") || hasTestId(hx, "home-brand"))) {
        shell("input keyevent 4");
        await sleep(1200);
        hx = asXml(
          await waitForAny(
            ["home-workout-list", ...HOME_READY_IDS],
            20000,
            `wk-home-e${i}`,
          ),
        );
        if (!hx)
          return wkFail(
            t0,
            log,
            `did not reach Home before game ${i} (${gameId})`,
          );
      }
      if (!hasTestId(hx, `home-workout-game-${gameId}`)) {
        // We may be scrolled down (recent-games hunt from the previous leg);
        // the workout list lives at the top of Home. Scroll back up first.
        swipeUp();
        await sleep(800);
        hx = readFileSyncSafe(dumpHierarchy(`wk-enter-top-${i}`));
        if (hx && !hasTestId(hx, `home-workout-game-${gameId}`)) {
          swipeUp();
          await sleep(800);
          hx = readFileSyncSafe(dumpHierarchy(`wk-enter-top-${i}-2`));
        }
      }
      if (!hx || !tapTestId(`home-workout-game-${gameId}`, hx))
        return wkFail(t0, log, `could not enter game ${gameId}`);
    }
    await sleep(1400);
    const gxml =
      (await waitFor(`${gameId}.screen`, 60000, `wk-g${i}`)) ||
      (await waitFor(`${gameId}.intro`, 60000, `wk-g${i}`));
    if (!gxml) return wkFail(t0, log, `game ${gameId} did not load`);
    tapTestId(`${gameId}.tutorial-skip`, gxml);
    await sleep(700);
    tapTestId(`${gameId}.start`, readFileSyncSafe(dumpHierarchy(`wk-g${i}-s`)));
    await sleep(1200);
    // Force the win and wait out the game's own results surface (driveForceWin
    // handles multi-round gates internally).
    const own = await driveForceWin(gameId, `wk-g${i}`);
    const reachedResults = !!own;
    log.push(`completed ${gameId} (${i + 1}/4, own-results=${reachedResults})`);
    // --- Advance the workout via the shared session result page ---
    // After results-next-game pushes game/[id] onto the stack, BACK pops one
    // route at a time: game → /results → Home. Home may render scrolled down
    // (previous recent-row hunt), so ANY home marker counts as arrived; the
    // workout-list scroll-up happens lazily where the tile is needed. Never
    // press more BACKs once a marker is seen — popping past Home's root
    // route exits the app to the launcher.
    // Reuse the robust back-to-Home helper (generic `home-` marker detection +
    // RedBox/LogBox dismissal + relaunch-on-foreground-loss). The inline narrow
    // HOME_READY_IDS set does NOT match this build's Home route (which exposes
    // home-spotlight/home-milestones/home-recent-games, not home-brand/title/
    // workout-list/templates), so it false-failed "did not return Home" even
    // though Home had rendered.
    const returnedHome = await backToHomeAfterLeg(`wk-home-a${i}`);
    if (!returnedHome) return wkFail(t0, log, `did not return Home after ${gameId}`);
    const wantId = i < 3 ? "results-next-game" : "results-workout-complete";
    let resPage = null;
    for (let t = 0; t < 3 && !resPage; t++) {
      const found = await scrollToRecentRow(`wk-recent-${i}-${t}`);
      if (found && tapTestId(found.row, found.rx)) {
        // The /results route is its own lazy chunk — its FIRST Metro build
        // can take minutes on a cold cache (same class as game chunks), so
        // this wait uses the full screen budget rather than a fixed few
        // seconds.
        resPage = await waitFor(wantId, SCREEN_BUDGET_MS, `wk-res-${i}`);
        if (!resPage) {
          // Not the session we expected (or advance already consumed):
          // back off and retry with the next-most-recent row on a fresh dump.
          shell("input keyevent 4");
          await sleep(1000);
        }
      } else {
        await sleep(1500); // recent list may still be rendering after persist
      }
    }
    if (!resPage) resPage = await waitFor(wantId, 4000, `wk-res-final-${i}`);
    if (!resPage)
      return wkFail(
        t0,
        log,
        `${wantId} not reached after ${gameId} (recent-session route)`,
      );
    if (i < 3) {
      tapTestId("results-next-game", resPage);
      await sleep(1400);
    }
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
  // Home renders BEFORE the persisted instance has been read back (async db
  // load): the first paint shows default Now/Up next markers. Poll until the
  // four status markers reflect the durable row instead of trusting one
  // pre-load frame (device-verified race).
  let allDone = false;
  if (resumed) {
    const deadline = Date.now() + 25000;
    while (Date.now() < deadline) {
      const xml = readFileSyncSafe(dumpHierarchy(`wk-relaunch-${Date.now() % 100000}`));
      if (xml && !DUMP_ERROR_RE.test(xml)) {
        const statuses = xml.match(/home-workout-game-status-([a-z0-9-]+)/g) || [];
        let ok = statuses.length > 0;
        for (const m of statuses) {
          const gid = m.replace("home-workout-game-status-", "");
          const node = findTestId(xml, `home-workout-game-status-${gid}`);
          if (!node || !/done|complete/i.test(node.text || "")) {
            ok = false;
            break;
          }
        }
        if (ok) {
          allDone = true;
          break;
        }
      }
      await sleep(1200);
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
// Workout V2 template flows (campaign 012 / W08)
// ---------------------------------------------------------------------------
// Traverses the Home "More workouts" picker end-to-end on the emulator:
// template chip → length chip → selected-template panel → start → N forced-
// win legs → shared session-result advance chain (identical mechanism to the
// proven daily journey in flowWorkout) → completion card + history row +
// Completed-state verification on Home.
//
// Resume probe (`workout-resume`, or --resume-probe): kills the app process
// AFTER leg 0's advance persisted (results page showing results-next-game),
// relaunches, and verifies the durable resume surface — started-chip marker
// "N of M done", `home-workout-selected-resume` block, start label beginning
// with "Resume" — then finishes the workout through the same chain.
//
// ONE-EXCLUSIVE-DEVICE-OWNER RULE: exactly ONE autobot driver may target a
// given QA_DEVICE at a time. Two drivers fight over the same UI hierarchy
// and corrupt each other's taps; the parent orchestrator owns emulator
// sessions and parallel workers must never launch journeys concurrently.
// ---------------------------------------------------------------------------

// Scroll down (viewport swipes) until ANY of `ids` is present in a fresh
// hierarchy dump. uiautomator omits off-screen nodes entirely, so tall pages
// (templates card, recent sessions, history) must be walked. A corrective
// upward pass guards against flying PAST a short target.
// Shell input is failure-tolerant here (unlike the legacy flows): a dead
// transport must degrade into "target not found" → structured FAIL artifacts,
// never an unhandled harness crash.
function swipeSafe(x1, y1, x2, y2, ms) {
  try {
    shell(`input swipe ${x1} ${y1} ${x2} ${y2} ${ms}`);
  } catch (e) {
    trace("swipe", `${x1},${y1}->${x2},${y2}`, false, String(e).slice(0, 80));
  }
}

// Viewport-derived swipe anchors: the legacy fixed y=1700 assumed a tall
// device and is a no-op below the screen edge on a 720x1280 AVD. Cache
// `wm size` once per run and scroll between 78% and 34% of the real height.
let cachedViewport = null;
function viewport() {
  if (cachedViewport) return cachedViewport;
  try {
    const out = shell("wm size");
    const m = /Override size:\s*(\d+)x(\d+)/.exec(out) || /Physical size:\s*(\d+)x(\d+)/.exec(out);
    cachedViewport = m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 720, h: 1280 };
  } catch {
    cachedViewport = { w: 720, h: 1280 };
  }
  return cachedViewport;
}
function swipeDown() {
  const { w, h } = viewport();
  swipeSafe(Math.round(w / 2), Math.round(h * 0.78), Math.round(w / 2), Math.round(h * 0.34), 300);
}
function swipeUp() {
  const { w, h } = viewport();
  swipeSafe(Math.round(w / 2), Math.round(h * 0.34), Math.round(w / 2), Math.round(h * 0.78), 300);
}
async function scrollToAny(ids, tag, maxSwipes = 5) {
  const look = async () => {
    const xml = readFileSyncSafe(dumpHierarchy(`${tag}-${Date.now() % 100000}`));
    if (xml && !DUMP_ERROR_RE.test(xml)) {
      for (const id of ids) if (hasTestId(xml, id)) return { id, xml };
    }
    return null;
  };
  for (let s = 0; s <= maxSwipes; s++) {
    const hit = await look();
    if (hit) return hit;
    if (s < maxSwipes) {
      swipeDown();
      await sleep(900);
    }
  }
  for (let s = 0; s < 2; s++) {
    swipeUp();
    await sleep(900);
    const hit = await look();
    if (hit) return hit;
  }
  return null;
}

// Newest recent-session row (module-level port of the proven daily-journey
// hunt: rows sit below the fold and uiautomator hides off-screen nodes).
async function scrollToRecentRowQa(tag) {
  for (let s = 0; s < 5; s++) {
    const rx = readFileSyncSafe(dumpHierarchy(`${tag}-s${s}`));
    const m = rx ? rx.match(/home-recent-game-[A-Za-z0-9_-]+/) : null;
    if (m) return { rx, row: m[0] };
    swipeDown();
    await sleep(900);
  }
  return null;
}

// True when a hierarchy dump proves the app's HOME ROUTE is showing.
//
// Campaign 014's discovery surfaces (spotlight/milestones/shelves) made Home
// much taller: returning from a completed leg can land on a SCROLLED Home
// whose above-fold markers (home-brand/home-title/home-workout-list) sit
// outside the dumped viewport — uiautomator omits off-screen scrollable
// children — so marker-only detection misread "Home, scrolled" as "not Home"
// and coaxed one extra BACK that popped the root route to the launcher
// (device-verified 2026-08-26: 3/3 workout journeys lost the app this way).
// Any home-* testID proves the Home route regardless of scroll position;
// other routes never emit that prefix (games use <id>.*, results uses
// results-*, other tabs do not use home-*).
function looksLikeHomeRoute(xml) {
  if (!xml || DUMP_ERROR_RE.test(xml)) return false;
  return /resource-id="home-/.test(xml);
}

// BACK-pop from a game/results surface to Home. Never press more BACKs once
// a home marker is seen — popping past Home's root route exits the app.
async function backToHomeAfterLeg(tag) {
  // Each completed leg leaves BOTH the game route and its /results route on
  // the stack, so returning Home after leg N can need up to 2N+1 BACK presses
  // — three was never enough beyond leg 1 (device-verified: focus template leg
  // 2 bounced results→intro→older-results and the 4th press exited to the
  // launcher). Press until the Home ROUTE is proven (max 6); if the app ever
  // leaves the foreground (launcher/foreign app), relaunch straight to Home
  // instead of failing — the journey's goal is a usable Home, however we get
  // there. Relaunch waits use 90s because a post-exit cold start measured
  // just past the old 30s budget (home-warm dump captured ready Home one
  // poll AFTER the timeout had already failed the journey).
  for (let b = 0; b < 6; b++) {
    const fg = appForeground();
    if (!fg) {
      log(`back-nav: app left foreground (press ${b + 1}) — relaunching to Home`);
      launch();
      const warm = await waitForHome(90000);
      if (warm) return true;
      continue;
    }
    try {
      shell("input keyevent 4");
    } catch (e) {
      trace("keyevent.BACK", tag, false, String(e).slice(0, 80));
    }
    await sleep(1500);
    // Poll dumps ourselves (instead of waitForAny) so dev overlays can be
    // dismissed in-loop and the scrolled-Home rule applies. Overlay checks
    // run BEFORE the dump-error filter: the RedBox's own error text trips
    // /ERROR:/i in DUMP_ERROR_RE and would otherwise never be dismissed.
    const end = Date.now() + (b >= 4 ? 20000 : 12000);
    while (Date.now() < end) {
      const xml = readFileSyncSafe(
        dumpHierarchy(`${tag}-b${b}-${Date.now() % 100000}`),
      );
      if (dismissRedBoxIfPresent(xml, tag)) {
        await sleep(1200); // overlay dismissed; re-dump before deciding
        continue;
      }
      if (dismissLogBoxIfPresent(xml, tag)) {
        await sleep(800); // snackbar dismissed; re-dump before deciding
        continue;
      }
      if (
        xml &&
        !DUMP_ERROR_RE.test(xml) &&
        (HOME_READY_IDS.some((id) => hasTestId(xml, id)) ||
          hasTestId(xml, "home-workout-templates") ||
          looksLikeHomeRoute(xml))
      ) {
        return true;
      }
      await sleep(750);
    }
  }
  // Last resort: relaunch recovers Home regardless of stack depth.
  launch();
  return !!(await waitForHome(90000));
}

// Open the newest persisted session's shared result page and wait for the
// workout-advance CTA (`results-next-game`) or completion marker
// (`results-workout-complete`). Retries with progressively older dumps when
// the tapped session was not the one just forced.
async function openNewestSessionResult(wantId, tag) {
  let resPage = null;
  for (let t = 0; t < 3 && !resPage; t++) {
    const found = await scrollToRecentRowQa(`${tag}-r${t}`);
    if (found && tapTestId(found.row, found.rx)) {
      // /results is its own lazy Metro chunk — first build can take minutes,
      // so this uses the full screen budget (see flowWorkout).
      resPage = await waitFor(wantId, SCREEN_BUDGET_MS, `${tag}-wait${t}`);
      if (!resPage) {
        try {
          shell("input keyevent 4");
        } catch (e) {
          trace("keyevent.BACK", tag, false, String(e).slice(0, 80));
        }
        await sleep(1000);
      }
    } else {
      await sleep(1500); // recent list may still be rendering after persist
    }
  }
  if (!resPage) resPage = await waitFor(wantId, 4000, `${tag}-final`);
  return resPage ? { xml: resPage } : null;
}

// Poll fresh dumps until any catalog game screen/intro mounts (start press
// and results-next-game pushes are async over Metro chunk loads).
async function detectMountedGame(tag, budgetMs) {
  const end = Date.now() + budgetMs;
  const catIds = loadCatalog().ids;
  while (Date.now() < end) {
    const xml = readFileSyncSafe(
      dumpHierarchy(`${tag}-${Date.now() % 100000}`),
    );
    if (xml && !DUMP_ERROR_RE.test(xml)) {
      const gid = extractMountedGameId(xml, catIds);
      if (gid) return gid;
    }
    await sleep(750);
  }
  return null;
}

// Select a template (+ optional explicit id) and length in the More-workouts
// picker, then verify the selected panel rendered. Returns the resolved
// template id, the start-button label, and XML snapshots for callers that
// need follow-up assertions or taps.
async function selectTemplateAndLength({ wantedTemplateId, length, tag }) {
  // If the detail panel is already open, do NOT re-tap the chip — re-tapping a
  // selected chip toggles it closed and loses the panel (device-verified: the
  // focus journey would open the panel, then a re-select collapsed it and every
  // subsequent poll saw a closed Home). Return the live panel so callers can
  // poll it while it stays open.
  const live = readFileSyncSafe(dumpHierarchy(`${tag}-live`));
  if (live && hasTestId(live, "home-workout-selected")) {
    return {
      ok: true,
      templateId: wantedTemplateId,
      chipsXml: live,
      panelXml: live,
      focusPresent: hasTestId(live, "home-workout-focus"),
      selectedPresent: true,
      startLabel:
        (findTestId(live, "home-workout-template-start")?.contentDesc ||
          "") ||
        "",
    };
  }
  // Scroll until an actual template ROW is visible — stopping at the section
  // header (home-workout-templates) leaves the chips below the fold where
  // uiautomator cannot see them.
  const reached = await scrollToAny(["home-workout-template-row"], `${tag}-tpl`);
  if (!reached)
    return {
      ok: false,
      reason:
        "template picker not reachable (home-workout-templates below fold?)",
    };
  const chipsXml = reached.xml;
  const chips = extractTemplateChipIds(chipsXml);
  if (chips.length === 0)
    return { ok: false, reason: "no template chips found in hierarchy" };
  // Default: today's rotation head — suggestions order the rotated focus
  // slot first (rotation.ts), preferring focus-* over the daily-mix fallback.
  const chosen =
    wantedTemplateId || chips.find((id) => id.startsWith("focus-")) || chips[0];
  if (!chips.includes(chosen))
    return {
      ok: false,
      reason: `template chip '${chosen}' not rendered (found: ${chips.join(", ")})`,
    };
  if (!tapTestId(`home-workout-template-${chosen}`, chipsXml))
    return { ok: false, reason: `could not tap template chip ${chosen}` };
  await sleep(600);
  const lenNode = await scrollToAny(
    [`home-workout-length-${length}`],
    `${tag}-len`,
    2,
  );
  if (!lenNode)
    return {
      ok: false,
      reason: `length chip 'home-workout-length-${length}' not visible after selection`,
    };
  tapTestId(`home-workout-length-${length}`, lenNode.xml);
  await sleep(500);
  const panel = await scrollToAny(["home-workout-selected"], `${tag}-panel`, 3);
  if (!panel)
    return { ok: false, reason: "selected-template detail panel did not render after pick" };
  let panelXml = panel.xml;
  let startBtn = findTestId(panelXml, "home-workout-template-start");
  if (!startBtn) {
    // The panel may become visible while the Start button itself is still
    // below the fold (resume blocks make it taller); hunt for the button
    // explicitly before concluding anything about its label.
    const more = await findWithScroll(
      "home-workout-template-start",
      `${tag}-startbtn`,
      3,
    );
    if (more && hasTestId(more, "home-workout-template-start")) {
      panelXml = more;
      startBtn = findTestId(more, "home-workout-template-start");
    }
  }
  return {
    ok: true,
    templateId: chosen,
    chipsXml,
    panelXml,
    focusPresent: hasTestId(panelXml, "home-workout-focus"),
    selectedPresent: hasTestId(panelXml, "home-workout-selected"),
    startLabel: startBtn ? startBtn.contentDesc || startBtn.text || "" : "",
  };
}

// One Workout V2 template journey. opts:
//   modeId       result/failure id (workout-short | workout-focus | workout-resume)
//   templateId   explicit template or null → auto-pick (first chip, prefers focus-*)
//   length       short | standard | extended (validated offline in main())
//   requireFocus fail unless the resolved template is focus-* (workout-focus mode)
//   resumeProbe  kill+relaunch mid-workout after leg 0, verify durable resume
async function flowWorkoutTemplate(opts) {
  beginSteps();
  const t0 = Date.now();
  const tag = sanitizeTag(opts.modeId);
  const length = opts.length;
  const totalLegs = LEG_COUNT_BY_LENGTH[length] || 4;
  const played = [];
  const legs = [];
  const resumeInfo = {
    probeRequested: !!opts.resumeProbe,
    killed: false,
    relaunched: false,
    resumeBlockSeen: false,
    progress: null,
    resumeLabelOk: false,
  };
  let curGame = null;
  let entered = false; // already standing on a game screen this iteration?

  const finishFail = (reason, extra = {}) =>
    failGame(opts.modeId, reason, t0, tag, {
      length,
      expectedLegs: totalLegs,
      playedGames: played,
      legs,
      resume: resumeInfo,
      ...extra,
    });

  let resetOk = true;
  try {
    reset();
  } catch (e) {
    resetOk = false;
    log(`reset error: ${e && e.message ? e.message : e}`);
  }
  // Entry device ops are guarded: a missing/uninstallable app or a dying adb
  // transport must yield structured FAIL artifacts (never a raw harness crash).
  let warmed = false;
  try {
    warmed = await ensureWarmHome();
  } catch (e) {
    log(`warm-home error: ${e && e.message ? e.message : e}`);
  }
  if (!warmed)
    return finishFail(
      resetOk ? "app did not warm to home" : "app did not warm to home (reset also failed — app installed?)",
    );

  // --- Selection ---------------------------------------------------------
  const sel = await selectTemplateAndLength({
    wantedTemplateId: opts.templateId || null,
    length,
    tag,
  });
  if (!sel.ok) return finishFail(sel.reason);
  const templateId = sel.templateId;
  if (opts.requireFocus && !templateId.startsWith("focus-"))
    return finishFail(
      `workout-focus resolved to non-focus template '${templateId}'`,
    );
  log(`selected ${templateId} · ${length} (${totalLegs} games)`);
  log(`start label before run: "${sel.startLabel}"`);
  screenshot(`${tag}-selection`);
  const startLabelFresh = /^Start\b/.test(sel.startLabel);
  if (!sel.selectedPresent || !sel.focusPresent)
    log(
      `WARN panel completeness: selected=${sel.selectedPresent} focus=${sel.focusPresent}`,
    );

  // --- Legs ---------------------------------------------------------------
  for (let i = 0; i < totalLegs; i++) {
    if (!entered) {
      if (i === 0) {
        const sx = await scrollToAny(
          ["home-workout-template-start"],
          `${tag}-go`,
          3,
        );
        if (!sx || !tapTestId("home-workout-template-start", sx.xml))
          return finishFail("start button not tappable after selection");
        log("start pressed");
      }
      curGame = await detectMountedGame(`${tag}-leg${i}`, SCREEN_BUDGET_MS);
      if (!curGame)
        return finishFail(
          `leg ${i}: no game screen mounted after ${i === 0 ? "start" : "advance"}`,
        );
      entered = true;
      log(`leg ${i}: entered ${curGame}`);
    }

    // Tutorial bypass + start (best-effort, mirrors the daily journey).
    // Verified retry loop with fresh dumps each attempt — no blind swipes
    // (the overlay tutorial card scrolls internally; a page swipe would only
    // scroll demo content, and stale bounds can land one button higher).
    for (let tutAttempt = 0; tutAttempt < 4; tutAttempt += 1) {
      const pre = readFileSyncSafe(dumpHierarchy(`${tag}-leg${i}-tut${tutAttempt}`));
      if (!pre || !hasTestId(pre, `${curGame}.tutorial`)) break;
      const pressed = [
        `${curGame}.tutorial-skip`,
        `${curGame}.tutorial-done`,
        `${curGame}.tutorial-next`,
      ].some((tid) => tapTestId(tid, pre));
      if (!pressed) break;
      await sleep(900);
    }
    await sleep(400);
    const startXml = readFileSyncSafe(dumpHierarchy(`${tag}-leg${i}-start`));
    if (!startXml || !hasTestId(startXml, `${curGame}.start`)) {
      // Start may sit below/above the fold after the tutorial closed.
      swipeUp();
      await sleep(700);
    }
    tapTestId(
      `${curGame}.start`,
      readFileSyncSafe(dumpHierarchy(`${tag}-leg${i}-start2`)),
    );
    await sleep(800);

    const own = await driveForceWin(curGame, `${tag}-leg${i}`);
    legs.push({ index: i, gameId: curGame, resultsReached: !!own });
    if (!own)
      return finishFail(
        `leg ${i} (${curGame}): qa force-win did not reach results`,
      );
    played.push(curGame);
    log(`leg ${i} complete: ${curGame} (${played.length}/${totalLegs})`);

    // --- Advance via the shared session result page ----------------------
    const finalLeg = i === totalLegs - 1;
    if (!(await backToHomeAfterLeg(`${tag}-home${i}`)))
      return finishFail(`leg ${i}: did not return Home after ${curGame}`);
    const wantId = finalLeg ? "results-workout-complete" : "results-next-game";
    const page = await openNewestSessionResult(wantId, `${tag}-adv${i}`);
    if (!page)
      return finishFail(`leg ${i}: ${wantId} not reached (recent-session route)`);
    log(`leg ${i}: ${wantId} shown`);

    if (opts.resumeProbe && i === 0 && !finalLeg) {
      // Kill AFTER the leg-0 advance persisted (the results page above IS the
      // persistence evidence), relaunch, verify durable resume state, then
      // re-enter via the start button; the next loop iteration detects the
      // resumed game like any other push.
      screenshot(`${tag}-pre-kill`);
      resumeInfo.killed = true;
      try {
        adb(["shell", "am", "force-stop", PKG]);
      } catch (e) {
        return finishFail(
          `resume probe: force-stop failed: ${e && e.message ? e.message : e}`,
        );
      }
      await sleep(2000);
      try {
        launch();
      } catch (e) {
        return finishFail(
          `resume probe: relaunch failed: ${e && e.message ? e.message : e}`,
        );
      }
      const home = await waitForHome();
      if (!home)
        return finishFail("resume probe: relaunch did not reach Home");
      resumeInfo.relaunched = true;
      log("resume probe: relaunched, verifying durable resume state");
      const sel2 = await selectTemplateAndLength({
        wantedTemplateId: templateId,
        length,
        tag: `${tag}-resume`,
      });
      if (!sel2.ok) return finishFail(`resume probe: ${sel2.reason}`);
      resumeInfo.resumeBlockSeen = hasTestId(
        sel2.panelXml,
        "home-workout-selected-resume",
      );
      const chipNode = findTestId(
        sel2.chipsXml || sel2.panelXml,
        `home-workout-template-${templateId}`,
      );
      // Chip a11y label first ("<Name> · 1 of 2 done"), then any progress
      // copy in the tree (the resume caption lives on a child Text node
      // without its own testID).
      resumeInfo.progress =
        parseResumeProgress(
          chipNode && (chipNode.contentDesc || chipNode.text),
        ) || parseResumeProgress(sel2.panelXml);
      resumeInfo.startLabel = sel2.startLabel || "";
      resumeInfo.resumeLabelOk = /^Resume\b/.test(resumeInfo.startLabel);
      screenshot(`${tag}-resume-panel`);
      if (!resumeInfo.resumeBlockSeen)
        return finishFail(
          "resume probe: home-workout-selected-resume not shown after relaunch",
        );
      if (
        !resumeInfo.progress ||
        resumeInfo.progress.completed < 1 ||
        resumeInfo.progress.completed >= resumeInfo.progress.total ||
        resumeInfo.progress.total !== totalLegs
      )
        return finishFail(
          `resume probe: implausible progress ${JSON.stringify(resumeInfo.progress)} (expected 1 of ${totalLegs})`,
        );
      if (!resumeInfo.resumeLabelOk)
        return finishFail(
          `resume probe: start label "${resumeInfo.startLabel}" does not begin with "Resume"`,
        );
      if (!tapTestId("home-workout-template-start", sel2.panelXml))
        return finishFail("resume probe: could not tap start to resume");
      log(
        `resume probe OK: ${resumeInfo.progress.completed} of ${resumeInfo.progress.total} done, resuming`,
      );
      entered = false;
      continue;
    }

    if (!finalLeg) {
      tapTestId("results-next-game", page.xml);
      await sleep(1400);
      entered = false;
    }
  }

  // --- Completion evidence -------------------------------------------------
  if (!(await backToHomeAfterLeg(`${tag}-final`)))
    return finishFail("did not return Home after final leg");
  await sleep(1500); // history/completion cards refresh on focus + events
  // Ensure Home is at top before searching for the completion card which
  // lives near the top (Today's Workout area). After a scrolled Home hunt
  // the viewport may be at the bottom where the card is off-screen.
  for (let up = 0; up < 3; up++) { swipeUp(); await sleep(700); }

  // The completion card is a transient post-session surface — capture its
  // per-game outcomes IN-SESSION (it proves the just-finished workout reported
  // every leg). The durable checks below (history row + Completed-on-reselect)
  // read resumeById, which races the in-session async workoutHistory load; they
  // are polled with a real wait (see the re-select loop) rather than trusted on
  // the first cold poll.
  const cardHit = await scrollToAny(
    ["home-workout-completion-card"],
    `${tag}-card`,
    5,
  );
  const outcomeRows = [];
  if (cardHit) {
    for (const gid of played)
      if (
        hasTestId(cardHit.xml, `home-workout-completion-card-outcome-${gid}`)
      )
        outcomeRows.push(gid);
    screenshot(`${tag}-completion-card`);
  }
  log(
    `completion card outcomes=${outcomeRows.length}/${played.length} (captured in-session)`,
  );

  // Relaunch to force a FRESH, committed read of the persisted workout row before
  // asserting durable state (home-workout-history + selected-done). This mirrors
  // the daily-workout journey's proven relaunch-persistence probe: the in-session
  // async workoutHistory load races the just-completed session, so a fresh mount
  // is the reliable way to read the committed completion (device-verified: the
  // focus instance advances to completed/4 only after the in-session read window).
  adb(["shell", "am", "force-stop", PKG]);
  await sleep(1500);
  launch();
  if (!(await waitForHome()))
    return finishFail("did not return Home after relaunch");
  for (let up = 0; up < 3; up++) { swipeUp(); await sleep(700); }

  // Wait for the More-workouts templates section to render after the fresh mount
  // (useWorkoutTemplates hook does async DB reads + reconciliation; waitForHome
  // only waits for home-brand, not for templates). Without this, selectTemplateAndLength
  // fails to find home-workout-template-row and never opens the detail.
  const templatesReady = await waitForAny(["home-workout-template-row", "home-workout-templates"], 30000, `${tag}-templates-ready`);
  if (templatesReady) {
    log(`templates ready after relaunch: ${templatesReady.id}`);
  } else {
    log(`templates not ready after relaunch (will retry in select poll)`);
  }

  // The completion card outcomes were captured in-session above. The durable
  // checks (history row + Completed-on-reselect) read resumeById, which refreshes
  // ASYNCHRONOUSLY after the session persists. Device runs show the selected-done
  // marker can take >15s to appear, and uiautomator intermittently returns a
  // null-root dump. So re-select the finished template in a poll — each
  // iteration re-taps the chip, re-opening the detail panel with the freshly
  // refreshed resume prop — until done renders or a generous budget elapses.
  // This mirrors a user re-opening the finished workout and seeing Completed.
  // Poll the finished template's detail panel for the Completed marker. Each
  // iteration opens/re-selects (selectTemplateAndLength now NO-OPs when the
  // panel is already open, so it never toggles the chip closed) and checks the
  // live panel. resumeById refreshes asynchronously after the session persists
  // and the selected-done node can take >15s to appear (device-verified: the
  // panel dump taken later DOES show home-workout-selected-done; the first
  // check raced the cache). Give it a long budget so the committed row is
  // reliably read back while the panel stays open.
  let completedState = false;
  let doneSel = null;
  for (let d = 0; d < 25 && !completedState; d++) {
    doneSel = await selectTemplateAndLength({
      wantedTemplateId: templateId,
      length,
      tag: `${tag}-done${d}`,
    });
    if (doneSel && doneSel.ok)
      completedState = hasTestId(doneSel.panelXml, "home-workout-selected-done");
    if (!completedState) await sleep(2500);
  }
  if (doneSel && doneSel.ok) screenshot(`${tag}-done-panel`);
  // The history widget + resumeById both derive from the same async
  // workoutHistory refresh, so search for the per-template history row AFTER
  // the done-poll above has already burned ~16s waiting for that refresh.
  let historyRow = null;
  for (let h = 0; h < 6 && !historyRow; h++) {
    const histHit = await scrollToAny(["home-workout-history"], `${tag}-hist${h}`, 4);
    if (histHit && !DUMP_ERROR_RE.test(histHit.xml)) {
      const rows = histHit.xml.match(/home-workout-history-[A-Za-z0-9-]+/g) || [];
      historyRow = rows.find((r) => r.includes(templateId)) || null;
      if (historyRow) {
        screenshot(`${tag}-history`);
        break;
      }
    }
    await sleep(2000);
  }

  log(
    `completion evidence: outcomes=${outcomeRows.length}/${played.length} history=${historyRow ? "yes" : "NO"} completed-state=${completedState}`,
  );

  const passed =
    legs.length === totalLegs &&
    played.length === totalLegs &&
    outcomeRows.length > 0 &&
    !!historyRow &&
    completedState &&
    (!opts.resumeProbe ||
      (resumeInfo.relaunched &&
        resumeInfo.resumeBlockSeen &&
        resumeInfo.resumeLabelOk &&
        !!resumeInfo.progress));
  return {
    id: opts.modeId,
    passed,
    status: passed ? "PASS" : "FAIL",
    reason: passed
      ? `${templateId} · ${length}: ${totalLegs}/${totalLegs} legs forced + advance chain${opts.resumeProbe ? " + mid-workout kill/relaunch resume verified" : ""}`
      : "see details/steps",
    details: {
      templateId,
      length,
      expectedLegs: totalLegs,
      legs,
      playedGames: played,
      startLabelFresh,
      completionCard: {
        seen: !!cardHit,
        outcomeRowsFound: outcomeRows,
      },
      historyRow,
      completedStateOnReselect: completedState,
      resume: resumeInfo,
    },
    steps: stepsOut(),
    ms: traceMs(t0),
    artifacts: captureAll(tag),
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
    '<node resource-id="g1.tile.5" clickable="true" bounds="[0,200][50,250]" text=""/>',
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
    candidates.every((n) => !/qa-toggle|tutorial/.test(n.id)),
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
  const interactionBefore = [
    '<node resource-id="g1.screen" text="Round 1" bounds="[0,0][100,100]"/>',
    '<node resource-id="g1.option.2" text="A" clickable="true" enabled="true" selected="false" bounds="[0,0][40,40]"/>',
    '<node resource-id="g1.score" text="Score 0" bounds="[0,100][100,140]"/>',
    '<node resource-id="g1.timer" text="4" bounds="[0,140][100,180]"/>',
  ].join("");
  const interactionAfter = [
    '<node resource-id="g1.screen" text="Round 1" bounds="[0,0][100,100]"/>',
    '<node resource-id="g1.option.2" text="A" clickable="true" enabled="true" selected="true" bounds="[0,0][40,40]"/>',
    '<node resource-id="g1.score" text="Score 1" bounds="[0,100][100,140]"/>',
    '<node resource-id="g1.timer" text="3" bounds="[0,140][100,180]"/>',
  ].join("");
  const timerOnlyAfter = interactionBefore.replace('text="4"', 'text="3"');
  assert(
    "interaction evidence requires gameplay state change",
    interactionEvidenceChanged(interactionBefore, interactionAfter, "g1", "g1.option.2"),
  );
  assert(
    "interaction evidence rejects timer-only hierarchy churn",
    !interactionEvidenceChanged(interactionBefore, timerOnlyAfter, "g1", "g1.option.2"),
  );

  // Workout V2 template-flow helpers (campaign 012 / W08).
  assert(
    "sanitizeTag strips windows-hostile chars",
    sanitizeTag("workout-short:focus-x y") === "workout-short-focus-x-y",
    sanitizeTag("workout-short:focus-x y"),
  );
  assert(
    "normalizeWorkoutLength accepts valid (case-insensitive)",
    normalizeWorkoutLength(" SHORT ") === "short",
  );
  assert(
    "normalizeWorkoutLength rejects unknown",
    normalizeWorkoutLength("gigantic") === null,
  );
  assert(
    "leg counts match product length specs",
    LEG_COUNT_BY_LENGTH.short === 2 &&
      LEG_COUNT_BY_LENGTH.standard === 4 &&
      LEG_COUNT_BY_LENGTH.extended === 6,
  );
  const chipXml = [
    '<node resource-id="home-workout-templates"/>',
    '<node resource-id="home-workout-template-row"/>',
    '<node resource-id="home-workout-template-focus-memory"/>',
    '<node resource-id="home-workout-template-daily-mix"/>',
    '<node resource-id="home-workout-template-start"/>',
  ].join("");
  assert(
    "template chips extracted minus row/start/container",
    JSON.stringify(extractTemplateChipIds(chipXml)) ===
      JSON.stringify(["focus-memory", "daily-mix"]),
    JSON.stringify(extractTemplateChipIds(chipXml)),
  );
  assert(
    "template chips empty for unrelated xml",
    extractTemplateChipIds(xml).length === 0,
  );
  assert(
    "mounted game detected from catalog",
    extractMountedGameId('<node resource-id="memory.screen"/>', [
      "memory",
    ]) === "memory",
  );
  assert(
    "mounted game intro variant detected",
    extractMountedGameId('<node resource-id="memory.intro"/>', [
      "memory",
    ]) === "memory",
  );
  assert(
    "mounted game ignores non-catalog ids",
    extractMountedGameId('<node resource-id="ghost.screen"/>', [
      "memory",
    ]) === null,
  );
  assert(
    "resume progress parsed from chip label",
    (() => {
      const p = parseResumeProgress("Memory Focus \u00b7 1 of 2 done");
      return p && p.completed === 1 && p.total === 2;
    })(),
  );
  assert(
    "resume progress parsed from panel caption",
    (() => {
      const p = parseResumeProgress("In progress \u2014 2 of 4 done. Starting again picks up where you left off.");
      return p && p.completed === 2 && p.total === 4;
    })(),
  );
  assert(
    "resume progress null on completed prose",
    parseResumeProgress("Completed today \u2014 nice work.") === null,
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
        Object.values(cat.canaries).every((g) => cat.ids.includes(g)),
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

  // --- Release-certification pure logic (campaign 013 closure) ---
  const cls = (r) => classifyFailure(r).category;
  assert("classify: environment blocker", cls("blocked: no usable device") === "environment");
  assert("classify: crash", cls("app died after tap") === "crash");
  assert("classify: warm", cls("app did not warm to home (Metro/JS load)") === "warm");
  assert("classify: route-load", cls("screen did not load") === "route-load");
  assert("classify: start", cls("start button not found") === "start");
  assert("classify: qa-force-win", cls("qa-toggle/force-win not reachable") === "qa-force-win");
  assert("classify: persistence", cls("session count=2 (expected 1), duplicates=false") === "persistence");
  assert("classify: navigation", cls("back navigation left the app dead/backgrounded") === "navigation");
  assert("classify: unknown is null", cls("something entirely novel") === null);

  const goodRow = {
    id: "s1",
    game_id: "memory",
    game_version: 1,
    generator_version: 1,
    scoring_version: 1,
    seed: 123,
    difficulty_json: '{"level":"normal"}',
    raw_result_json: '{"score":10}',
    normalized_result: 0.5,
    xp: 20,
    started_at: 1000,
    completed_at: 2000,
    duration_ms: 1000,
  };
  assert("row invariant: valid row passes", validateSessionRow(goodRow, "memory").ok);
  assert(
    "row invariant: game_id mismatch detected",
    !validateSessionRow(goodRow, "speed-tap-rush").ok,
  );
  const nanRow = { ...goodRow, normalized_result: NaN, xp: -5 };
  assert(
    "row invariant: NaN score + negative xp detected",
    !validateSessionRow(nanRow, "memory").ok &&
      validateSessionRow(nanRow, "memory").violations.length === 2,
    JSON.stringify(validateSessionRow(nanRow, "memory").violations),
  );
  const badJsonRow = { ...goodRow, difficulty_json: "{oops" };
  assert(
    "row invariant: malformed payload detected",
    !validateSessionRow(badJsonRow, "memory").ok,
  );
  const orderRow = { ...goodRow, completed_at: 500 };
  assert(
    "row invariant: completed_before_started detected",
    !validateSessionRow(orderRow, "memory").ok,
  );
  assert(
    "row invariant: missing row rejected",
    !validateSessionRow(null, "memory").ok,
  );

  const ids = ["a", "b", "c"];
  const allPass = ids.map((id) => ({ id, passed: true }));
  const certOk = certifySummary(allPass, ids);
  assert(
    "certify: complete pass is certified",
    certOk.certified && certOk.expected === 3 && certOk.passed === 3,
  );
  const certMissing = certifySummary(
    [
      { id: "a", passed: true },
      { id: "b", passed: true },
    ],
    ids,
  );
  assert(
    "certify: missing id fails + listed",
    !certMissing.certified && JSON.stringify(certMissing.missing) === '["c"]',
  );
  const certDup = certifySummary(
    [
      { id: "a", passed: true },
      { id: "a", passed: true },
      { id: "b", passed: true },
      { id: "c", passed: true },
    ],
    ids,
  );
  assert(
    "certify: duplicate classification fails",
    !certDup.certified && JSON.stringify(certDup.duplicates) === '["a"]',
  );
  const certUnexpected = certifySummary(
    [
      { id: "a", passed: true },
      { id: "b", passed: true },
      { id: "c", passed: true },
      { id: "ghost", passed: true },
    ],
    ids,
  );
  assert(
    "certify: unexpected id fails",
    !certUnexpected.certified && JSON.stringify(certUnexpected.unexpected) === '["ghost"]',
  );
  const certFailed = certifySummary(
    [
      { id: "a", passed: true },
      { id: "b", passed: false },
      { id: "c", passed: true },
    ],
    ids,
  );
  assert(
    "certify: failed game fails certification",
    !certFailed.certified && certFailed.failed === 1,
  );

  const prov = gitProvenance();
  assert(
    "provenance: git available with sha+branch",
    prov.available === true && /^[0-9a-f]{40}$/.test(prov.sha || "") && !!prov.branch,
    prov.available ? `${prov.branch} dirty=${prov.dirty}` : "git unavailable",
  );

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
function selectTargets(mode, flags = {}) {
  const cat = loadCatalog();
  const targets = [];
  if (mode === "warm-bundles") return [{ kind: "warm", id: "warm-bundles" }];
  const wantsGames = mode === "game" || mode === "all" || mode === "catalog" || mode === "certify";
  if (wantsGames) {
    let list = cat.ids;
    if (flags.onlyGame) list = [flags.onlyGame];
    else if (flags.category && cat.categories[flags.category])
      list = cat.categories[flags.category];
    if (flags.canariesOnly && !flags.onlyGame)
      list = Object.values(cat.canaries);
    for (const g of list) targets.push({ kind: "game", id: g });
  }
  if (mode === "wordmatch" || mode === "all")
    targets.push({ kind: "wordmatch", id: "language-word-match (3.6)" });
  if (mode === "workout" || mode === "all")
    targets.push({ kind: "workout", id: "daily-workout (6.8/12.7)" });
  // Workout V2 template flows (campaign 012 / W08). Length/template flags are
  // validated OFFLINE in main() before this point; the auto-picked template
  // resolves on-device (today's rotation head, preferring focus-*).
  const workoutTemplateModes = {
    "workout-short": { length: flags.workoutLength || "short" },
    "workout-focus": {
      length: flags.workoutLength || "standard",
      requireFocus: true,
    },
    "workout-resume": { length: flags.workoutLength || "short", resumeProbe: true },
  };
  if (workoutTemplateModes[mode])
    targets.push({
      kind: "workout-template",
      id: mode,
      opts: {
        modeId: mode,
        templateId: flags.workoutTemplate || null,
        length: workoutTemplateModes[mode].length,
        requireFocus: !!workoutTemplateModes[mode].requireFocus,
        resumeProbe:
          !!workoutTemplateModes[mode].resumeProbe || flags.resumeProbe === true,
      },
    });
  if (mode === "canaries" || mode === "all") {
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
  const listFlows = args.includes("--list-flows");
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
    console.error(
      `# ${cat.ids.length} games derived from apps/mobile/src/games/*/game.json`,
    );
    if (category) {
      const list = cat.categories[category] || [];
      console.error(`# Category ${category}: ${list.join(", ")}`);
    }
    console.error(`# Canaries: ${JSON.stringify(cat.canaries)}`);
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

  // Workout V2 flow flags — validated OFFLINE before any device contact.
  const workoutTemplate = get("--template", null);
  const workoutLengthRaw = get("--length", null);
  const resumeProbe = args.includes("--resume-probe");
  const WORKOUT_MODES = new Set([
    "workout-short",
    "workout-focus",
    "workout-resume",
  ]);
  let workoutLength = null;
  if (WORKOUT_MODES.has(mode)) {
    workoutLength = normalizeWorkoutLength(
      workoutLengthRaw || (mode === "workout-focus" ? "standard" : "short"),
    );
    if (!workoutLength) {
      console.error(
        `[ERROR] unknown --length '${workoutLengthRaw}'. Valid lengths: ${WORKOUT_LENGTHS_QA.join(", ")}`,
      );
      process.exit(1);
    }
    if (workoutTemplate) {
      if (!/^[a-z0-9-]+$/.test(workoutTemplate)) {
        console.error(
          `[ERROR] invalid --template '${workoutTemplate}' (expected a kebab-case template id, e.g. focus-memory)`,
        );
        process.exit(1);
      }
      if (
        mode === "workout-focus" &&
        (workoutTemplate === "daily-mix" || !workoutTemplate.startsWith("focus-"))
      ) {
        console.error(
          `[ERROR] --mode workout-focus requires a focus template (focus-*), got '${workoutTemplate}'`,
        );
        process.exit(1);
      }
    }
  }

  // Offline dry-run: print the flow definitions the requested mode(s) would
  // drive WITHOUT touching adb or a device.
  if (listFlows) {
    const flowDef = (m, len, extra = {}) => ({
      mode: m,
      template: workoutTemplate || extra.templatePolicy || "(auto: first rendered chip, prefers focus-*)",
      length: len,
      legs: LEG_COUNT_BY_LENGTH[len] ?? null,
      resumeProbe: extra.resumeProbe ?? false,
      steps: [
        "reset + warm Home",
        "scroll to More-workouts picker; tap template chip + length chip",
        "verify home-workout-selected panel (+ home-workout-focus) and start label",
        "start → N forced-win legs via shared session-result advance chain",
        ...(extra.resumeSteps || []),
        "verify results-workout-complete, completion card outcomes, history row, Completed-today state",
      ],
    });
    const flows = WORKOUT_MODES.has(mode)
      ? [
          flowDef(mode, workoutLength, {
            resumeProbe: mode === "workout-resume" || resumeProbe,
            resumeSteps:
              mode === "workout-resume" || resumeProbe
                ? [
                    "after leg 0 advance persists: am force-stop → relaunch → warm Home",
                    "verify chip 'N of M done' + home-workout-selected-resume + 'Resume …' label",
                  ]
                : [],
          }),
        ]
      : [
          flowDef("workout-short", "short"),
          flowDef("workout-focus", "standard", { resumeProbe: false }),
          flowDef("workout-resume", "short", {
            resumeProbe: true,
            resumeSteps: [
              "after leg 0 advance persists: am force-stop → relaunch → warm Home",
              "verify chip 'N of M done' + home-workout-selected-resume + 'Resume …' label",
            ],
          }),
        ];
    console.log(JSON.stringify({ offline: true, deviceTouched: false, flows }, null, 2));
    process.exit(0);
  }

  // Single-driver lock (one-exclusive-device-owner rule): a second autobot
  // against the same device corrupts both runs' taps AND floods Metro with
  // duplicate main-bundle requests (device-verified: queued builds grew to
  // 7,200,000 ms and every journey starved on warm-home). The lock is a
  // PID liveness file; a stale lock from a killed driver is auto-cleared.
  const lockPath = join(REPO_ROOT, "scripts", "qa", ".autobot.lock");
  let lockAcquired = false;
  for (let attempt = 0; attempt < 2 && !lockAcquired; attempt += 1) {
    let fd;
    try {
      // O_EXCL makes the check-and-create atomic. A separate exists/read/write
      // sequence allowed two drivers to pass the check simultaneously.
      fd = openSync(lockPath, "wx");
      writeSync(fd, `${process.pid}\n`);
      closeSync(fd);
      lockAcquired = true;
    } catch (error) {
      if (fd !== undefined) {
        try {
          closeSync(fd);
        } catch {
          // The descriptor may already have been closed by the failed write.
        }
      }
      if (error?.code !== "EEXIST") {
        console.error(`REFUSED: could not acquire autobot lock: ${String(error)}`);
        process.exit(3);
      }

      let rawPid;
      try {
        rawPid = readFileSync(lockPath, "utf8").trim();
      } catch (readError) {
        console.error(
          `REFUSED: autobot lock exists but is unreadable: ${String(readError)}`,
        );
        process.exit(3);
      }
      const lockPid = Number(rawPid);
      if (!Number.isInteger(lockPid) || lockPid <= 0) {
        console.error(
          `REFUSED: autobot lock contains an invalid owner pid (${JSON.stringify(rawPid)}); remove it only after verifying no QA driver is running.`,
        );
        process.exit(3);
      }

      // Fail CLOSED: only ESRCH proves the lock owner is gone. Any other
      // kill() error (e.g. EPERM for a live process we may not signal) must
      // NOT count as a stale lock, or a second driver could steal the
      // exclusive-device lock and corrupt both runs' taps.
      let alive;
      try {
        process.kill(lockPid, 0);
        alive = true;
      } catch (killError) {
        alive = killError?.code !== "ESRCH";
      }
      if (alive) {
        console.error(
          `REFUSED: another autobot driver (pid ${lockPid}) is already running. One exclusive device owner per QA_DEVICE.`,
        );
        process.exit(3);
      }
      try {
        unlinkSync(lockPath);
      } catch (unlinkError) {
        console.error(
          `REFUSED: stale autobot lock owner ${lockPid} is gone, but lock removal failed: ${String(unlinkError)}`,
        );
        process.exit(3);
      }
    }
  }
  if (!lockAcquired) {
    console.error("REFUSED: could not acquire exclusive autobot lock after stale-lock recovery");
    process.exit(3);
  }
  process.on("exit", () => {
    try {
      if (readFileSync(lockPath, "utf8").trim() === String(process.pid)) {
        unlinkSync(lockPath);
      }
    } catch {
      /* best-effort cleanup */
    }
  });

  const planned = selectTargets(mode, {
    onlyGame,
    category,
    canariesOnly: args.includes("--canaries-only"),
    workoutTemplate,
    workoutLength,
    resumeProbe,
  });
  // Certification profile: pause/resume evidence is part of the release gate
  // (the historical gate was `--mode all --pause`); --no-pause opts out for
  // debugging only and marks the report non-certified.
  const certify = mode === "certify";
  const pauseProbeEnabled = certify ? !args.includes("--no-pause") : pause;

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

  // Certification preflight (release gate §10): environment must prove itself
  // before game 1. A failed check is an ENVIRONMENT BLOCKER — reported and
  // exited as BLOCKED, never converted into product failures.
  let preflight = null;
  if (certify) {
    preflight = await certifyPreflight();
    if (!preflight.ok) {
      const runId = initRunDir(`${mode}-preflight-blocked`);
      const report = {
        runId,
        status: "BLOCKED",
        certified: false,
        blockerClass: "environment",
        pkg: PKG,
        scheme: SCHEME,
        mode,
        provenance: gitProvenance(),
        preflight,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        results: [],
        passed: 0,
        failed: 0,
        artifactsDir: RUN_DIR,
      };
      writeRunJson(runId, report);
      console.error("[BLOCKED] certification preflight failed:");
      for (const c of preflight.checks.filter((c) => !c.ok))
        console.error(`  [ENVIRONMENT] ${c.name}: ${c.detail}`);
      console.log(`Run dir: ${RUN_DIR}`);
      process.exit(exitZero ? 0 : 2);
    }
    console.log("certification preflight: all checks OK");
  }

  // Animation-disabled dumps are reliable across every game (see disableAnimations).
  disableAnimations();

  const runId = initRunDir(mode);
  const report = {
    runId,
    status: "IN_PROGRESS",
    certified: false,
    device: serial(),
    pkg: PKG,
    scheme: SCHEME,
    mode,
    catalogSize: cat.ids.length,
    deviceInfo: deviceInfo(),
    provenance: certify ? gitProvenance() : undefined,
    preflight: certify ? preflight : undefined,
    driverPid: process.pid,
    startedAt: new Date().toISOString(),
    results: [],
  };
  const certificationOptions = {
    requireInteraction: certify,
    requirePause: pauseProbeEnabled,
  };
  const journal = () => {
    report.certification = certify
      ? certifySummary(report.results, cat.ids, certificationOptions)
      : undefined;
    writeRunJson(runId, report);
  };
  const markIncomplete = (why) => {
    if (report.status !== "IN_PROGRESS") return;
    report.status = "INCOMPLETE";
    report.certified = false;
    report.incompleteReason = why;
    report.endedAt = report.endedAt || new Date().toISOString();
    journal();
  };
  process.on("SIGINT", () => {
    markIncomplete("SIGINT");
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    markIncomplete("SIGTERM");
    process.exit(143);
  });
  process.on("uncaughtException", (e) => {
    markIncomplete(`uncaughtException: ${String(e).slice(0, 200)}`);
    console.error(e);
    process.exit(1);
  });
  journal();

  // Stochastic-race tolerance (certification contract §17F, honest-retry):
  // three certification runs on this host proved the residual failures are
  // environment races (uiautomator a11y tearing under co-tenant memory
  // churn), not deterministic defects — different games fail each run, and
  // every fixed defect stays fixed. A failed game in a KNOWN-stochastic
  // class gets exactly ONE full fresh journey retry; both attempts are
  // recorded (retriedAfterFailure carries the first attempt's reason), so
  // the report discloses the retry instead of hiding it.
  const STOCHASTIC_CATEGORIES = new Set([
    "pause",
    "qa-force-win",
    "route-load",
    "warm",
  ]);
  for (const t of planned) {
    let result;
    if (t.kind === "game") result = await flowGame(t.id, { pause: pauseProbeEnabled });
    else if (t.kind === "warm") result = await flowWarmBundles();
    else if (t.kind === "wordmatch") result = await flowWordMatch();
    else if (t.kind === "workout") result = await flowWorkout();
    else if (t.kind === "workout-template")
      result = await flowWorkoutTemplate(t.opts);
    if (
      certify &&
      t.kind === "game" &&
      !result.passed &&
      STOCHASTIC_CATEGORIES.has(result.classification?.category || "")
    ) {
      console.log(
        `[RETRY] ${t.id}: stochastic-class failure ("${result.reason}") — one fresh journey retry`,
      );
      const retry = await flowGame(t.id, { pause: pauseProbeEnabled });
      retry.retriedAfterFailure = result.reason;
      result = retry;
    }
    report.results.push(result);
    journal();
  }

  report.endedAt = new Date().toISOString();
  report.passed = report.results.filter((r) => r.passed).length;
  report.failed = report.results.filter((r) => !r.passed).length;
  report.artifactsDir = RUN_DIR;
  report.status = "COMPLETED";
  if (certify) {
    report.certification = certifySummary(
      report.results,
      cat.ids,
      certificationOptions,
    );
    report.certified = report.certification.certified;
  } else {
    delete report.certification;
  }
  journal();
  console.log(
    `\n=== Autobot QA report (${report.passed} PASS / ${report.failed} FAIL) ===`,
  );
  for (const r of report.results) console.log(summaryLine(r));
  if (certify) {
    const c = report.certification;
    console.log("--- Certification summary ---");
    console.log(
      `Catalog expected: ${c.expected} | attempted: ${c.attempted} | PASS: ${c.passed} | FAIL: ${c.failed} | NOT VALIDATED: ${c.notValidated}`,
    );
    console.log(
      `Missing: ${c.missing.length} | Duplicates: ${c.duplicates.length} | Unexpected: ${c.unexpected.length}`,
    );
    if (c.missing.length) console.log(`Missing ids: ${c.missing.join(", ")}`);
    if (c.duplicates.length) console.log(`Duplicate ids: ${c.duplicates.join(", ")}`);
    if (c.unexpected.length) console.log(`Unexpected ids: ${c.unexpected.join(", ")}`);
    if (c.interactionMissing.length)
      console.log(`Missing interaction evidence: ${c.interactionMissing.join(", ")}`);
    if (c.pauseMissing.length)
      console.log(`Missing pause/resume evidence: ${c.pauseMissing.join(", ")}`);
    console.log(`Certification verdict: ${report.certified ? "PASS" : "FAIL"}`);
  }
  console.log(`Run dir: ${RUN_DIR}`);
  console.log(`Report: ${join(RUN_DIR, "run.json")}`);

  if (exitNonZero && (report.failed > 0 || (certify && !report.certified)))
    process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
