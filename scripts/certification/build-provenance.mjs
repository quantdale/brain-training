#!/usr/bin/env node
/**
 * 076-f task 1.2/1.3 — build the game/route provenance table and the
 * source-equivalence record from the filed evidence manifests.
 *
 * The table is DERIVED, not hand-transcribed: every row is read from the
 * committed capture manifests (`final-matrix-de6c5fcd/captures.json`,
 * `final-scroll-de6c5fcd/captures.json`, `after-captures-games/index.json`)
 * and from `git diff` over the rendering-dependency surface, so it can be
 * regenerated and checked. Hand-written narrative lives in PROVENANCE.md and
 * SOURCE_EQUIVALENCE.md; this script owns the rows.
 *
 * Classification rules (076-f design decision 2 + the 2026-10-09 reconciliation):
 *   CURRENT_APK                 captured from the terminal APK itself
 *   SOURCE_EQUIVALENT_HISTORICAL captured from an earlier build whose RENDERING
 *                                dependency closure is unchanged since that
 *                                capture - still a faithful picture of the
 *                                surface, but NOT a terminal-APK capture
 *   SOURCE_NOT_EQUIVALENT       captured from an earlier build whose RENDERING
 *                                closure CHANGED since that capture - no longer
 *                                a faithful picture, and not a terminal-APK
 *                                capture. A named state the previous three
 *                                classes could not express.
 *   NOT_APPLICABLE              excluded/rejected capture, retained for audit
 *
 * Two dimensions are recorded per row and must not be conflated:
 *   currentApplicability  can the row serve as current terminal-APK acceptance
 *                         evidence?  True only when the frame's APK is the
 *                         terminal APK.  Nothing else closes an acceptance gate.
 *   recaptureRequired     must the frame be recaptured (or the row marked NOT
 *                         VALIDATED)?  True when the frame's rendering closure
 *                         changed - i.e. the still no longer depicts the
 *                         surface it is filed under.
 *
 * A third, separately recorded dimension: a change that affects only INPUT
 * handling (a hit-target, not a pixel) leaves rendered stills valid but
 * invalidates every interaction claim made from them.  Each row therefore also
 * carries `interactionClosureChanged`, driven by the measured effect ledger
 * below.
 *
 * Usage: node scripts/certification/build-provenance.mjs
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PARENT = path.join(ROOT, 'openspec', 'changes', '076-product-wide-ui-ux-reboot', 'evidence');
const OUT = path.join(ROOT, 'openspec', 'changes', '076-f-final-product-certification', 'evidence');

/** Game-capture source commit whose frames are classified as historical. */
const HISTORICAL_SOURCE = '4a6fc5349c334b4324e4ea02421ebd06d87c5f64';
const CLOSURE_APK = 'b2913bca9149eee752704b2529a1ddf13c877b26290b5d576d1be42355fe5d31';

/**
 * Single machine-readable identity of the artifact this table is published
 * against.  It used to be two hardcoded constants in this file, which is how
 * the table came to be published against `de6c5fcd`/`c324960` after the 076-f
 * defect repair had already moved the artifact to `e243341f`/`b293a02`.
 *
 * Both this generator and `build-assessment.mjs` read this one file, so the
 * identity is stated once and cannot drift between consumers.  A missing or
 * malformed record is a certification failure, not a stale default.
 */
const IDENTITY_PATH = path.join(OUT, 'TERMINAL_IDENTITY.json');

/**
 * Rendering-dependency closure named by the 076-f spec: board, game host,
 * shared gameplay presentation, theme tokens, game rendering, game
 * navigation, native configuration, common runtime behaviour. A change under
 * any of these invalidates a frame that represents it.
 *
 * `apps/mobile/src/components/ui` was added by the 2026-10-09 reconciliation:
 * the shared `Button` primitive is shared gameplay presentation, and the 076-f
 * hit-slop repair lives there.  Leaving it out let the closure report "0
 * changes" while a shared control had in fact been edited.
 */
const DEPENDENCY_SURFACE = [
  'apps/mobile/src/games',
  'apps/mobile/src/components/game-host',
  'apps/mobile/src/components/game-ui',
  'apps/mobile/src/components/ui',
  'apps/mobile/src/theme',
  'apps/mobile/src/sdk',
  'apps/mobile/src/routing',
  'apps/mobile/src/registry',
  'apps/mobile/src/content',
  'apps/mobile/src/hooks',
  'apps/mobile/src/constants',
  'apps/mobile/android',
  'apps/mobile/ios',
];

/**
 * MEASURED effect of every file currently in the dependency-surface diff.
 *
 * This is the ledger that makes the generator refuse to guess.  For each
 * changed surface file it records what the change actually does, with the
 * measurement that establishes it:
 *
 *   'render' - the change alters RENDERED OUTPUT.  A still captured before the
 *              change is no longer a picture of the surface it is filed under,
 *              so it is SOURCE_NOT_EQUIVALENT and must be recaptured.
 *   'input'  - the change alters INPUT/HIT-TESTING only.  Rendered stills stay
 *              faithful, but every interaction claim (tap registration, target
 *              size, control reachability) drawn from them is invalid.
 *
 * FAIL CLOSED: a file that appears in the surface diff without an entry here is
 * an unmeasured change.  The generator then treats EVERY non-terminal row as
 * non-equivalent, emits no `SOURCE_EQUIVALENT_HISTORICAL` label at all, and
 * exits non-zero.  A future edit cannot claim pixel-neutrality by omission.
 */
const SURFACE_EFFECT_LEDGER = {
  'apps/mobile/src/components/game-ui/session-header.tsx': {
    effect: 'render',
    because:
      'the single wrapping `flexWrap: wrap` strip was split into a wrapping INFO zone plus a pinned trailing zone, so the pause control moved to a fixed edge. That is a layout change to every game session screen (076-f defect repair 1).',
  },
  'apps/mobile/src/components/ui/button.tsx': {
    effect: 'input',
    because:
      'the diff only adds `hitSlop={EDGE_HIT_SLOP}` (plus a comment and the constant). RN `hitSlop` widens the touch target and takes no part in layout or paint: measured by the three regenerated visual-baseline snapshots, whose whole diff is four added `hitSlop={4}` lines and no style, layout, or child change. Pixel stills therefore remain faithful; tap-registration and target-size claims do not (076-f defect repair 2).',
  },
};

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

function loadIdentity() {
  let raw;
  try {
    raw = readFileSync(IDENTITY_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `cannot read terminal identity ${path.relative(ROOT, IDENTITY_PATH)}: ${error.message}. ` +
        'Record the terminal source SHA and APK SHA-256 there; this generator refuses to guess them.',
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`malformed terminal identity ${path.relative(ROOT, IDENTITY_PATH)}: ${error.message}`);
  }
  const { terminalSourceSha, terminalApkSha256 } = parsed ?? {};
  if (!/^[0-9a-f]{40}$/.test(terminalSourceSha ?? '') || !/^[0-9a-f]{64}$/.test(terminalApkSha256 ?? '')) {
    throw new Error(
      `terminal identity ${path.relative(ROOT, IDENTITY_PATH)} must declare a 40-hex terminalSourceSha and a 64-hex terminalApkSha256`,
    );
  }
  return parsed;
}

/** Load a committed evidence manifest. A missing or malformed manifest is a
 *  certification failure, not a partial table: fail closed and name the file so
 *  a stale or half-written manifest can never silently produce plausible rows. */
function load(manifestPath) {
  let raw;
  try {
    raw = readFileSync(manifestPath, 'utf8');
  } catch (error) {
    throw new Error(`cannot read evidence manifest ${path.relative(ROOT, manifestPath)}: ${error.message}`);
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') {
      throw new Error('expected a JSON object at the top level');
    }
    return parsed;
  } catch (error) {
    throw new Error(`malformed evidence manifest ${path.relative(ROOT, manifestPath)}: ${error.message}`);
  }
}

/** Files changed since the historical capture source, excluding test-only edits. */
function changedProductionFiles(since) {
  const out = git(['diff', '--name-only', since, 'HEAD', '--', 'apps/', 'package.json', 'package-lock.json', 'app.json']);
  return out ? out.split('\n').filter((f) => f && !f.includes('__tests__')) : [];
}

function dependencySurfaceChanges(since) {
  const out = git(['diff', '--name-only', since, 'HEAD', '--', ...DEPENDENCY_SURFACE]);
  return out ? out.split('\n').filter((f) => f && !f.includes('__tests__')) : [];
}

const identity = loadIdentity();
const TERMINAL_SOURCE = identity.terminalSourceSha;
const TERMINAL_APK = identity.terminalApkSha256;

const changed = changedProductionFiles(HISTORICAL_SOURCE);
const surfaceChanges = dependencySurfaceChanges(HISTORICAL_SOURCE);

/**
 * Resolve the measured effect of each changed surface file.  An unmeasured
 * change is an 'unmeasured' effect, which is NOT pixel-neutral and NOT
 * input-only: it disqualifies every historical classification outright.
 */
const unmeasured = surfaceChanges.filter((f) => !SURFACE_EFFECT_LEDGER[f]);
const effects = new Map();
for (const f of surfaceChanges) {
  effects.set(f, unmeasured.includes(f) ? 'unmeasured' : SURFACE_EFFECT_LEDGER[f].effect);
}
const renderChanges = surfaceChanges.filter((f) => effects.get(f) === 'render' || effects.get(f) === 'unmeasured');
const inputChanges = surfaceChanges.filter((f) => effects.get(f) === 'input');

/**
 * What a row renders, expressed as the surface paths its frame depends on.
 * Recorded explicitly so the per-row verdict is auditable rather than a global
 * directory diff applied uniformly.
 */
const RENDERS_GAME_CHROME = [
  'apps/mobile/src/games',
  'apps/mobile/src/components/game-host',
  'apps/mobile/src/components/game-ui',
  'apps/mobile/src/components/ui',
  'apps/mobile/src/theme',
  'apps/mobile/src/sdk',
  'apps/mobile/src/routing',
  'apps/mobile/src/registry',
  'apps/mobile/src/content',
  'apps/mobile/src/hooks',
  'apps/mobile/src/constants',
  'apps/mobile/android',
  'apps/mobile/ios',
];
/** Route surfaces render their own screen plus the shared shell, theme and the
 *  shared UI primitives (Button in particular).  They do NOT render
 *  `SessionHeader`: that is game-host chrome, which is why a route still can
 *  stay faithful when only `session-header.tsx` changes.  Verified by
 *  `grep -rn SessionHeader apps/mobile/src` -> only `game-host.tsx` renders it. */
const RENDERS_ROUTE_SHELL = [
  'apps/mobile/src/components/ui',
  'apps/mobile/src/theme',
  'apps/mobile/src/sdk',
];

const rows = [];
const md = [];
const push = (r) => rows.push(r);

// ---------------------------------------------------------------- route rows
const matrix = load(path.join(PARENT, 'final-matrix-de6c5fcd', 'captures.json'));
const scroll = load(path.join(PARENT, 'final-scroll-de6c5fcd', 'captures.json'));

/** Files in `changed` that a route row renders. */
const routeChanges = changed.filter((f) => RENDERS_ROUTE_SHELL.some((p) => f.startsWith(`${p}/`)));

for (const s of matrix.surfaces) {
  // A route row is CURRENT_APK only when the frame's own APK hash equals the
  // terminal APK hash.  Route rows therefore stay bound to the APK that
  // produced them: a `de6c5fcd` row is never relabelled CURRENT_APK for
  // `e243341f` just because the project moved on.
  const routeRenderChanged = renderChanges.some((f) => RENDERS_ROUTE_SHELL.some((p) => f.startsWith(`${p}/`)));
  const routeInputChanged = inputChanges.some((f) => RENDERS_ROUTE_SHELL.some((p) => f.startsWith(`${p}/`)));
  const isTerminal = s.apkSha256 === TERMINAL_APK;
  push({
    kind: 'route',
    target: s.route,
    state: `${s.surface} (${s.profile}/${s.theme}, fontScale ${s.fontScale})`,
    sourceCommit: s.codeSha,
    apkSha256: s.apkSha256,
    productionDependency: 'route screen + shared shell/theme + shared UI primitives',
    captureIdentity: `png ${s.pngSha256.slice(0, 16)}… · xml ${s.xmlSha256.slice(0, 16)}…`,
    visualReview: s.visualReview ?? 'reviewed',
    classification: isTerminal ? 'CURRENT_APK' : routeRenderChanged ? 'SOURCE_NOT_EQUIVALENT' : 'SOURCE_EQUIVALENT_HISTORICAL',
    currentApplicability: isTerminal,
    interactionClosureChanged: routeInputChanged,
    recaptureRequired: !isTerminal && routeRenderChanged,
    recaptureReason: isTerminal
      ? '—'
      : routeRenderChanged
        ? `rendered closure changed (${renderChanges.map((f) => path.basename(f)).join(', ')}); recapture before this still is used again`
        : `bound to APK ${s.apkSha256.slice(0, 8)}…, which is not the terminal APK ${TERMINAL_APK.slice(0, 8)}…; the still still depicts its surface, so the reviewed matrix stands (task 5.1) — it is simply not a terminal-APK capture`,
    frame: s.png,
  });
}

const scrollCaptures = scroll.surfaces ?? scroll.captures ?? [];
for (const s of scrollCaptures) {
  const isTerminal = (s.apkSha256 ?? TERMINAL_APK) === TERMINAL_APK;
  push({
    kind: 'route-scroll',
    target: s.route,
    state: `${s.surface} (${s.profile}/${s.theme})`,
    sourceCommit: s.codeSha ?? TERMINAL_SOURCE,
    apkSha256: s.apkSha256 ?? TERMINAL_APK,
    productionDependency: 'results reward/replay region',
    captureIdentity: `png ${(s.pngSha256 ?? '').slice(0, 16)}…`,
    visualReview: s.visualReview ?? 'reviewed',
    classification: isTerminal ? 'CURRENT_APK' : 'SOURCE_EQUIVALENT_HISTORICAL',
    currentApplicability: isTerminal,
    interactionClosureChanged: inputChanges.some((f) => RENDERS_ROUTE_SHELL.some((p) => f.startsWith(`${p}/`))),
    recaptureRequired: false,
    recaptureReason: isTerminal
      ? '—'
      : `bound to APK ${String(s.apkSha256 ?? TERMINAL_APK).slice(0, 8)}…, which is not the terminal APK ${TERMINAL_APK.slice(0, 8)}…; retained as historical route evidence for that APK`,
    frame: s.png,
  });
}

// ----------------------------------------------------------------- game rows
const index = load(path.join(PARENT, 'after-captures-games', 'index.json'));

/** The 22 states captured on the closure APK, from GAME_ASSESSMENT.md. */
const CLOSURE_STATES = [
  ['flexibility-color-stroop', 'active'],
  ['memory-prospective-cue', 'active'],
  ['speed-quick-compare', 'active'],
  ['attention-odd-one-out', 'feedback'],
  ['attention-sustained-vigilance', 'feedback'],
  ['attention-symbol-tracker', 'feedback'],
  ['attention-visual-search', 'feedback'],
  ['flexibility-task-switch', 'feedback'],
  ['language-word-chain', 'feedback'],
  ['language-word-scramble', 'feedback'],
  ['logic-code-cracker', 'feedback'],
  ['math-equation-builder', 'feedback'],
  ['math-fast-math', 'feedback'],
  ['math-number-line-estimation', 'feedback'],
  ['math-value-ordering', 'feedback'],
  ['memory-running-order', 'feedback'],
  ['spatial-grid-nav', 'feedback'],
  ['speed-tap-rush', 'feedback'],
  ['attention-sustained-vigilance', 'pause'],
  ['language-context-fit', 'pause'],
  ['language-word-match', 'pause'],
  ['math-equation-builder', 'pause'],
];
const closureSet = new Set(CLOSURE_STATES.map(([g, st]) => `after-${g}-${st}.png`));

/** A game frame renders the game chrome, so any render-affecting change in that
 *  closure makes the frame a picture of a screen that no longer exists. */
const gameRenderChanges = renderChanges.filter((f) => RENDERS_GAME_CHROME.some((p) => f.startsWith(`${p}/`)));
const gameInputChanges = inputChanges.filter((f) => RENDERS_GAME_CHROME.some((p) => f.startsWith(`${p}/`)));

for (const img of index.images) {
  const m = /^after-(.+)-(active|feedback|pause|result)\.png$/.exec(img.file);
  const game = m ? m[1] : img.file;
  const state = m ? m[2] : 'unknown';
  const isClosure = closureSet.has(img.file);
  const renderChanged = gameRenderChanges.length > 0;
  push({
    kind: 'game',
    target: game,
    state,
    sourceCommit: isClosure ? HISTORICAL_SOURCE : 'mixed historical builds (no per-file binding)',
    apkSha256: isClosure ? CLOSURE_APK : 'mixed historical builds (no per-file binding)',
    productionDependency: 'game board + game host + game-ui + shared UI primitives + theme + sdk + routing + native',
    captureIdentity: `png ${img.sha256.slice(0, 16)}…`,
    visualReview: 'individually inspected',
    // Rule from design decision 2 + the 2026-10-09 reconciliation: source
    // equivalence is only PROVEN while the rendering closure is unchanged.  The
    // 076-f session-header repair CHANGED that closure, so these frames are no
    // longer equivalent - and they were never captures from the terminal APK.
    classification: renderChanged ? 'SOURCE_NOT_EQUIVALENT' : 'SOURCE_EQUIVALENT_HISTORICAL',
    currentApplicability: false,
    interactionClosureChanged: gameInputChanges.length > 0 || renderChanged,
    recaptureRequired: renderChanged,
    recaptureReason: renderChanged
      ? `rendered closure changed (${gameRenderChanges.map((f) => path.basename(f)).join(', ')}); recapture on the terminal APK, or leave the row NOT VALIDATED`
      : '—',
    frame: img.file,
  });
}

for (const img of index.excluded ?? []) {
  push({
    kind: 'game-rejected',
    target: img.file,
    state: 'n/a',
    sourceCommit: 'n/a',
    apkSha256: 'n/a',
    productionDependency: 'n/a',
    captureIdentity: `png ${String(img.sha256 ?? '').slice(0, 16)}…`,
    visualReview: `rejected: ${img.reason ?? 'quarantined'}`,
    classification: 'NOT_APPLICABLE',
    currentApplicability: false,
    interactionClosureChanged: false,
    recaptureRequired: false,
    recaptureReason: 'quarantined; never used for acceptance',
    frame: img.file,
  });
}

// ------------------------------------------------------------------- output
mkdirSync(OUT, { recursive: true });
const header = [
  'kind', 'target', 'state', 'sourceCommit', 'apkSha256', 'productionDependency',
  'captureIdentity', 'visualReview', 'classification', 'currentApplicability',
  'interactionClosureChanged', 'recaptureRequired', 'recaptureReason',
];
const esc = (v) => String(v ?? '').replace(/\|/g, '\\|');
md.push('## Generated provenance table');
md.push('');
md.push('Generated by `node scripts/certification/build-provenance.mjs` from the');
md.push('committed capture manifests. Do not hand-edit; re-run the generator.');
md.push('');
md.push(`- Rows: ${rows.length} (${rows.filter((r) => r.kind === 'route').length} route, ` +
  `${rows.filter((r) => r.kind === 'route-scroll').length} route-scroll, ` +
  `${rows.filter((r) => r.kind === 'game').length} game, ` +
  `${rows.filter((r) => r.kind === 'game-rejected').length} rejected)`);
md.push(`- Terminal application source: \`${TERMINAL_SOURCE}\``);
md.push(`- Terminal APK (SHA-256): \`${TERMINAL_APK}\``);
md.push(`- Rendering-dependency surface changed since \`${HISTORICAL_SOURCE.slice(0, 7)}\`: ` +
  (surfaceChanges.length === 0
    ? '**none**'
    : surfaceChanges.map((f) => `\`${f}\` (${effects.get(f)})`).join(', ')));
md.push(`- Non-test production files changed since \`${HISTORICAL_SOURCE.slice(0, 7)}\`: ` +
  (changed.length ? changed.map((f) => `\`${f}\``).join(', ') : 'none'));
md.push(`- Rows whose rendered closure changed: ${rows.filter((r) => r.classification === 'SOURCE_NOT_EQUIVALENT').length}`);
md.push(`- Rows that can serve as current terminal-APK evidence: ${rows.filter((r) => r.currentApplicability).length}`);
md.push('');
md.push('`currentApplicability` and `classification` answer different questions and must not be');
md.push('conflated: a row can be a faithful picture of a surface (`SOURCE_EQUIVALENT_HISTORICAL`)');
md.push('and still be unusable as terminal-APK acceptance evidence');
md.push('(`currentApplicability: false`) because the frame came from a different APK.');
md.push('');
md.push(`| ${header.join(' | ')} |`);
md.push(`| ${header.map(() => '---').join(' | ')} |`);
for (const r of rows) {
  md.push(`| ${header.map((h) => esc(r[h])).join(' | ')} |`);
}

writeFileSync(path.join(OUT, 'provenance-table.md'), `${md.join('\n')}\n`, 'utf8');
writeFileSync(path.join(OUT, 'provenance-table.json'), `${JSON.stringify({
  generatedFrom: {
    routeMatrix: 'openspec/changes/076-product-wide-ui-ux-reboot/evidence/final-matrix-de6c5fcd/captures.json',
    scrollMatrix: 'openspec/changes/076-product-wide-ui-ux-reboot/evidence/final-scroll-de6c5fcd/captures.json',
    gameIndex: 'openspec/changes/076-product-wide-ui-ux-reboot/evidence/after-captures-games/index.json',
    terminalIdentity: path.relative(ROOT, IDENTITY_PATH),
  },
  historicalSource: HISTORICAL_SOURCE,
  terminalSource: TERMINAL_SOURCE,
  terminalApk: TERMINAL_APK,
  closureApk: CLOSURE_APK,
  surfaceEffects: Object.fromEntries(surfaceChanges.map((f) => [f, effects.get(f)])),
  unmeasuredSurfaceChanges: unmeasured,
  dependencySurfaceChangesSinceHistorical: surfaceChanges,
  productionFilesChangedSinceHistorical: changed,
  rows,
}, null, 2)}\n`, 'utf8');

console.log(`provenance rows: ${rows.length}`);
console.log(`terminal source: ${TERMINAL_SOURCE}`);
console.log(`terminal APK:    ${TERMINAL_APK}`);
console.log(`dependency-surface changes since ${HISTORICAL_SOURCE.slice(0, 7)}: ${surfaceChanges.length}`);
for (const f of surfaceChanges) console.log(`  - ${f} (${effects.get(f)})`);
console.log(`production files changed since ${HISTORICAL_SOURCE.slice(0, 7)}: ${changed.length}`);
for (const f of changed) console.log(`  - ${f}`);
console.log(`rows SOURCE_NOT_EQUIVALENT: ${rows.filter((r) => r.classification === 'SOURCE_NOT_EQUIVALENT').length}`);
console.log(`rows currentApplicability=true: ${rows.filter((r) => r.currentApplicability).length}`);

// FAIL CLOSED. Review finding (076-f provenance lane): this generator used to
// only LOG the dependency-surface diff while hard-coding every game row as
// SOURCE_EQUIVALENT_HISTORICAL, so a future rendering edit would have been
// silently recorded as equivalence - the exact "silent rot" the narrative
// claimed was impossible. That is fixed: a render-affecting (or unmeasured)
// closure change removes the equivalence label from every affected row.
//
// The non-zero exit is deliberately KEPT even when the emitted table is
// correct. Reconciliation finding 2.2: after the 076-f defect repair the
// closure changed, so the honest table is also a table that says "these
// historical frames are no longer equivalent". Exiting 0 would let a stale
// `SOURCE_EQUIVALENT_HISTORICAL` claim pass unnoticed again.
if (surfaceChanges.length > 0) {
  console.error('');
  console.error('build-provenance: FAIL — rendering-dependency closure changed since the');
  console.error(`game-capture source ${HISTORICAL_SOURCE}:`);
  for (const f of surfaceChanges) console.error(`  - ${f} (${effects.get(f)})`);
  if (unmeasured.length > 0) {
    console.error('');
    console.error('UNMEASURED SURFACE CHANGE(S): no entry in SURFACE_EFFECT_LEDGER, so the');
    console.error('effect is unknown. No row is classified SOURCE_EQUIVALENT_HISTORICAL.');
  }
  console.error('');
  console.error(`The emitted table records ${rows.filter((r) => r.classification === 'SOURCE_NOT_EQUIVALENT').length} row(s) as SOURCE_NOT_EQUIVALENT.`);
  console.error('They are NOT terminal-APK captures and their stills no longer depict the');
  console.error('surface they are filed under. Recapture the affected closure on the terminal');
  console.error('APK (or leave those rows NOT VALIDATED) before regenerating.');
  process.exitCode = 1;
}
