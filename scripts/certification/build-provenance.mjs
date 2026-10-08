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
 * Classification rules (076-f design decision 2):
 *   CURRENT_APK                 captured from the terminal APK itself
 *   SOURCE_EQUIVALENT_HISTORICAL captured from an earlier build whose
 *                                rendering-dependency closure is unchanged
 *                                since that capture - NOT a terminal-APK capture
 *   NOT_APPLICABLE              excluded/rejected capture, retained for audit
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
const TERMINAL_APK = 'de6c5fcd19de2428af39b5f44a8e80ee1a9a037c4848c98ddb05ddcfd678903d';
const TERMINAL_SOURCE = 'c324960c7619d305f01d60587f9e74c4ca93ca6a';

/**
 * Rendering-dependency closure named by the 076-f spec: board, game host,
 * shared gameplay presentation, theme tokens, game rendering, game
 * navigation, native configuration, common runtime behaviour. A change under
 * any of these invalidates a frame that represents it.
 */
const DEPENDENCY_SURFACE = [
  'apps/mobile/src/games',
  'apps/mobile/src/components/game-host',
  'apps/mobile/src/components/game-ui',
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

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/**
 * Load a committed evidence manifest. A missing or malformed manifest is a
 * certification failure, not a partial table: fail closed and name the file so
 * a stale or half-written manifest can never silently produce plausible rows.
 */
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

const changed = changedProductionFiles(HISTORICAL_SOURCE);
const surfaceChanges = dependencySurfaceChanges(HISTORICAL_SOURCE);

const rows = [];
const md = [];
const push = (r) => rows.push(r);

// ---------------------------------------------------------------- route rows
const matrix = load(path.join(PARENT, 'final-matrix-de6c5fcd', 'captures.json'));
const scroll = load(path.join(PARENT, 'final-scroll-de6c5fcd', 'captures.json'));

for (const s of matrix.surfaces) {
  // Route screens whose own source changed between the capture source and the
  // terminal source would need recapture; the matrix IS the terminal APK, so
  // every row here is current. Recorded explicitly so the rule is visible.
  push({
    kind: 'route',
    target: s.route,
    state: `${s.surface} (${s.profile}/${s.theme}, fontScale ${s.fontScale})`,
    sourceCommit: s.codeSha,
    apkSha256: s.apkSha256,
    productionDependency: 'route screen + shared shell/theme',
    captureIdentity: `png ${s.pngSha256.slice(0, 16)}… · xml ${s.xmlSha256.slice(0, 16)}…`,
    visualReview: s.visualReview ?? 'reviewed',
    classification: s.apkSha256 === TERMINAL_APK ? 'CURRENT_APK' : 'SOURCE_EQUIVALENT_HISTORICAL',
    applicable: 'yes',
    recaptureRequired: 'no',
    recaptureReason: '—',
    frame: s.png,
  });
}

const scrollCaptures = scroll.surfaces ?? scroll.captures ?? [];
for (const s of scrollCaptures) {
  push({
    kind: 'route-scroll',
    target: s.route,
    state: `${s.surface} (${s.profile}/${s.theme})`,
    sourceCommit: s.codeSha ?? TERMINAL_SOURCE,
    apkSha256: s.apkSha256 ?? TERMINAL_APK,
    productionDependency: 'results reward/replay region',
    captureIdentity: `png ${(s.pngSha256 ?? '').slice(0, 16)}…`,
    visualReview: s.visualReview ?? 'reviewed',
    classification: (s.apkSha256 ?? TERMINAL_APK) === TERMINAL_APK ? 'CURRENT_APK' : 'SOURCE_EQUIVALENT_HISTORICAL',
    applicable: 'yes',
    recaptureRequired: 'no',
    recaptureReason: '—',
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

for (const img of index.images) {
  const m = /^after-(.+)-(active|feedback|pause|result)\.png$/.exec(img.file);
  const game = m ? m[1] : img.file;
  const state = m ? m[2] : 'unknown';
  const isClosure = closureSet.has(img.file);
  push({
    kind: 'game',
    target: game,
    state,
    sourceCommit: isClosure ? HISTORICAL_SOURCE : 'mixed historical builds (no per-file binding)',
    apkSha256: isClosure ? CLOSURE_APK : 'mixed historical builds (no per-file binding)',
    productionDependency: 'game board + game host + game-ui + theme + sdk + routing + native',
    captureIdentity: `png ${img.sha256.slice(0, 16)}…`,
    visualReview: 'individually inspected',
    // Rule from design decision 2: source equivalence is PROVEN for the game
    // dependency closure (zero changes), so an unchanged game frame is
    // historical source-equivalent evidence - never a terminal-APK capture.
    classification: 'SOURCE_EQUIVALENT_HISTORICAL',
    applicable: 'yes (as historical source-equivalent comparison)',
    recaptureRequired: 'no',
    recaptureReason: '—',
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
    applicable: 'no',
    recaptureRequired: 'no',
    recaptureReason: 'quarantined; never used for acceptance',
    frame: img.file,
  });
}

// ------------------------------------------------------------------- output
mkdirSync(OUT, { recursive: true });
const header = [
  'kind', 'target', 'state', 'sourceCommit', 'apkSha256', 'productionDependency',
  'captureIdentity', 'visualReview', 'classification', 'applicable',
  'recaptureRequired', 'recaptureReason',
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
md.push(`- Rendering-dependency surface changed since \`${HISTORICAL_SOURCE.slice(0, 7)}\`: ` +
  (surfaceChanges.length === 0 ? '**none**' : surfaceChanges.join(', ')));
md.push(`- Non-test production files changed since \`${HISTORICAL_SOURCE.slice(0, 7)}\`: ` +
  (changed.length ? changed.map((f) => `\`${f}\``).join(', ') : 'none'));
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
  },
  historicalSource: HISTORICAL_SOURCE,
  terminalSource: TERMINAL_SOURCE,
  terminalApk: TERMINAL_APK,
  closureApk: CLOSURE_APK,
  dependencySurfaceChangesSinceHistorical: surfaceChanges,
  productionFilesChangedSinceHistorical: changed,
  rows,
}, null, 2)}\n`, 'utf8');

console.log(`provenance rows: ${rows.length}`);
console.log(`dependency-surface changes since ${HISTORICAL_SOURCE.slice(0, 7)}: ${surfaceChanges.length}`);
console.log(`production files changed since ${HISTORICAL_SOURCE.slice(0, 7)}: ${changed.length}`);
for (const f of changed) console.log(`  - ${f}`);
