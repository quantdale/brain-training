#!/usr/bin/env node
/**
 * merge-coverage.mjs — provenance-aware native-coverage merger (Campaign 080,
 * contract version 2.0). Replaces the Campaign 080 v1 merger, which had two
 * certification defects (independent review F-080-003):
 *
 *   1. "Milestone OR" was a shallow object spread
 *      (`{ ...g.milestones, ...prev.milestones }`) — object precedence, not a
 *      logical OR. Positive observations could be silently discarded.
 *   2. Blending events across runs could fabricate one "complete" lifecycle
 *      (Start from run A + Results from run B) that never happened anywhere.
 *
 * Corrected semantics:
 *   - Every execution attempt keeps its OWN record: run id, build identity
 *     (git SHA / package / version / APK hash), device profile, events,
 *     observations, artifact hashes, failures, partial results.
 *   - The CERTIFIED level of a game is the deepest fully proven level from a
 *     SINGLE sufficiently proven execution attempt (never a cross-run blend).
 *   - A capability UNION across runs is reported separately, explicitly
 *     labelled as union-of-observations. It may say "input observed in run A
 *     and completion in run B"; it never claims one continuous session.
 *   - Resilience subcapabilities are independent by contract and MAY union
 *     across runs; each keeps its own run provenance.
 *   - Genuine boolean unions use or3() (true > false > unknown), never object
 *     precedence. Conflicts are preserved with the authoritative rule stated.
 *   - Invalid runs (provenance gaps, hash mismatches, multi-attempt blends)
 *     contribute NOTHING to certification but are retained and diagnosed.
 *   - Failed attempts are never discarded because another attempt succeeded.
 *
 * Outputs (all requested by prompt §5):
 *   --out         raw per-run ledger + validated per-run ledger + consolidated
 *                 game coverage + evidence provenance + summary + diagnostics
 *   --matrix      human-readable matrix (ATTEMPTED / OBSERVED / VERIFIED /
 *                 FAILED / BLOCKED / NOT EXECUTED per axis)
 *
 * Usage:
 *   node scripts/qa/merge-coverage.mjs <runLedger.json> [more.json ...]
 *        [--out FILE] [--matrix FILE] [--strict]
 *
 * Exit codes: 0 = merged, 2 = usage/invalid input, 1 = --strict and at least
 * one run failed contract validation.
 */
'use strict';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_VERSION,
  AxisStatus,
  LEVEL_NAME,
  classifyRun,
  or3,
} from './coverage-contract.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GAMES_DIR = path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'games');

/**
 * AUTHORITATIVE game-id registry (B1). `knownGameId` is a caller-supplied flag
 * and must never be trusted on its own; ids are validated against the real
 * generated game modules instead. When the registry cannot be resolved the
 * merger says so explicitly rather than silently trusting the caller.
 */
function loadGameRegistry() {
  try {
    const ids = [];
    for (const d of fs.readdirSync(GAMES_DIR)) {
      const metaPath = path.join(GAMES_DIR, d, 'game.json');
      if (!fs.existsSync(metaPath)) continue;
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        if (meta && typeof meta.id === 'string') ids.push(meta.id);
      } catch { /* a corrupt game.json is reported by the registry gate, not here */ }
    }
    return ids.length ? new Set(ids) : null;
  } catch {
    return null;
  }
}

// --- args ------------------------------------------------------------------
function usage() {
  console.log('usage: merge-coverage.mjs <runLedger.json> [...] [--out FILE] [--matrix FILE] [--strict]');
}
const argv = process.argv.slice(2);
const inputs = [];
let outJson = 'scripts/qa/native-coverage-merged.json';
let outMatrix = null;
let strict = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outJson = path.resolve(argv[++i] || '');
  else if (argv[i] === '--matrix') outMatrix = path.resolve(argv[++i] || '');
  else if (argv[i] === '--strict') strict = true;
  else if (argv[i] === '-h' || argv[i] === '--help') { usage(); process.exit(0); }
  else if (argv[i].startsWith('--')) { console.error(`unknown option '${argv[i]}'`); usage(); process.exit(2); }
  else inputs.push(path.resolve(argv[i]));
}
if (inputs.length === 0 || !outJson) { usage(); process.exit(2); }

// --- load run ledgers ------------------------------------------------------
const runs = [];           // every run, valid or not — never discarded
const diagnostics = [];    // coverage-validation diagnostics
const inputManifest = [];

for (const file of inputs) {
  let doc;
  let raw;
  try {
    raw = fs.readFileSync(file);
    doc = JSON.parse(raw.toString('utf8'));
  } catch (e) {
    diagnostics.push({ kind: 'unreadable-input', file, detail: String(e.message || e), fatal: true });
    console.error(`[merge] unreadable input ${file}: ${e.message}`);
    process.exit(2);
  }
  // Order matters: a REAL v1 ledger has no `runs[]` (it is a flat array of
  // game records), so the schemaVersion check must come FIRST — otherwise the
  // mandated `reclassify-historical.mjs` guidance is unreachable and the input
  // is reported as merely "malformed" (docs-vs-code inconsistency #6).
  if (doc.schemaVersion !== 2) {
    diagnostics.push({ kind: 'schema-mismatch', file, detail: `schemaVersion ${doc.schemaVersion} != 2 (v1 historical ledgers must pass through reclassify-historical.mjs first)` , fatal: true });
    console.error(`[merge] ${file} is not a schemaVersion 2 run ledger; run scripts/qa/reclassify-historical.mjs for v1 evidence`);
    process.exit(2);
  }
  const fileRuns = Array.isArray(doc) ? doc : Array.isArray(doc.runs) ? doc.runs : null;
  if (!fileRuns) {
    diagnostics.push({ kind: 'malformed-ledger', file, detail: 'no runs[] array (schemaVersion 2 ledger required)', fatal: true });
    console.error(`[merge] malformed ledger ${file}: expected { runs: [...] }`);
    process.exit(2);
  }
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  inputManifest.push({ file: path.basename(file), sha256, runCount: fileRuns.length, generatedAt: doc.generatedAt || null, evidenceSource: doc.evidenceSource || 'runtime' });
  fileRuns.forEach((r, i) => {
    // B4: a type-corrupt entry must produce a deterministic, actionable
    // validation result — never an uncontrolled crash downstream and never a
    // silent omission. Corrupt entries are retained as INVALID runs.
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      diagnostics.push({
        kind: 'corrupt-run-entry',
        file: path.basename(file),
        runId: `(entry ${i})`,
        detail: `run entry is ${r === null ? 'null' : Array.isArray(r) ? 'an array' : typeof r}, not an object`,
        effect: 'retained as an invalid run; excluded from certification',
      });
      runs.push({ executionAttemptId: `(corrupt-entry-${i})`, gameId: '(missing)', events: [], observations: [], _corrupt: true, _sourceFile: path.basename(file), _sourceSha256: sha256 });
      return;
    }
    runs.push({ ...r, _sourceFile: path.basename(file), _sourceSha256: sha256 });
  });
}

// --- authoritative registry (B1) -------------------------------------------
const knownGames = loadGameRegistry();
if (!knownGames) {
  diagnostics.push({
    kind: 'registry-unavailable',
    detail: `authoritative game registry not resolvable at ${GAMES_DIR}; knownGameId caller flags were NOT independently verified`,
    effect: 'game-id validation degraded to caller assertion — this is NOT a registry-enforced certification',
  });
}

// --- duplicate execution-attempt detection (B4) ----------------------------
const attemptIdCount = new Map();
for (const r of runs) {
  const id = r.executionAttemptId || '(missing)';
  attemptIdCount.set(id, (attemptIdCount.get(id) || 0) + 1);
}
for (const [id, n] of attemptIdCount) {
  if (n > 1) {
    diagnostics.push({
      kind: 'duplicate-execution-attempt-id',
      runId: id,
      detail: `executionAttemptId '${id}' appears ${n} times across the inputs`,
      effect: 'attempt-count inflation risk; all duplicates are retained and none is trusted as a distinct attempt without further provenance',
    });
  }
}

// --- validate + classify every run ----------------------------------------
const validatedRuns = runs.map((r) => {
  const c = classifyRun(r, { knownGames: knownGames || undefined });
  return {
    run: r,
    executionAttemptId: r.executionAttemptId || '(missing)',
    gameId: r.gameId || '(missing)',
    valid: c.validation.valid,
    errors: c.validation.errors,
    warnings: c.validation.warnings,
    notes: c.validation.notes || [],
    level: c.level,
    status: c.status,
    axes: c.axes,
    reasons: c.reasons,
  };
});

for (const v of validatedRuns.filter((x) => !x.valid)) {
  diagnostics.push({
    kind: 'invalid-run',
    runId: v.executionAttemptId,
    gameId: v.gameId,
    detail: v.errors.join('; '),
    effect: 'excluded from certification; retained in the raw ledger',
  });
}

// --- consolidation ---------------------------------------------------------
const AXIS_ORDER = [
  'launch', 'identity', 'render',
  'tutorialObserved', 'tutorialCompleted',
  'gameplayEntered', 'inputAttempted', 'inputAccepted', 'feedbackObserved',
  'roundAdvanced', 'autonomousGameplayEvent',
  'sessionEnded', 'resultsCurrent', 'safeExit',
  'backgroundRelaunch', 'interruptionRecovery', 'offlineContinuity', 'a11yProfile', 'responsiveTransition',
];
const UNIONABLE = new Set(['backgroundRelaunch', 'interruptionRecovery', 'offlineContinuity', 'a11yProfile', 'responsiveTransition']);
const STATUS_RANK = {
  [AxisStatus.VERIFIED]: 5,
  [AxisStatus.OBSERVED]: 4,
  [AxisStatus.ATTEMPTED]: 3,
  [AxisStatus.BLOCKED]: 2,
  [AxisStatus.FAILED]: 1,
  [AxisStatus.NOT_EXECUTED]: 0,
};

function runSummary(v) {
  const r = v.run;
  return {
    executionAttemptId: v.executionAttemptId,
    sourceFile: r._sourceFile,
    sourceSha256: r._sourceSha256,
    evidenceSource: r.evidenceSource || 'runtime',
    buildIdentity: r.buildIdentity || {},
    deviceProfile: r.deviceProfile || {},
    startedAt: r.startedAt || null,
    claimedLevelLegacy: r.claimedLevelLegacy ?? null,
    level: v.level,
    status: v.status,
    valid: v.valid,
    errors: v.errors,
    reasons: v.reasons,
    axes: Object.fromEntries(AXIS_ORDER.map((a) => [a, v.axes[a] ? v.axes[a].status : AxisStatus.NOT_EXECUTED])),
    artifacts: r.artifacts || [],
    remainingGap: r.remainingGap || '',
  };
}

const byGame = new Map();
for (const v of validatedRuns) {
  const id = v.gameId;
  if (!byGame.has(id)) byGame.set(id, []);
  byGame.get(id).push(v);
}

const games = [...byGame.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([id, list]) => {
  const valid = list.filter((v) => v.valid);
  // CERTIFIED level: deepest FULLY proven level from ONE valid run.
  const best = valid.reduce((acc, v) => (v.level > (acc ? acc.level : -1) ? v : acc), null);
  const certified = best
    ? { level: best.level, levelName: LEVEL_NAME[best.level], status: best.status, runId: best.executionAttemptId, reasons: best.reasons }
    : { level: 0, levelName: LEVEL_NAME[0], status: 'FAILED', runId: null, reasons: ['no contract-valid execution attempt'] };

  // ------------------------------------------------------------------
  // B2: CERTIFIED capability axes come from CONTRACT-VALID runs ONLY.
  // Historical invalid runs remain visible for transparency (in
  // `historicalObservations`) but must never make a certified capability
  // column look verified.
  // ------------------------------------------------------------------
  const certifiedUnion = {};
  const historicalObservations = {};
  const conflicts = [];
  for (const a of AXIS_ORDER) {
    const perRun = list.map((v) => ({ runId: v.executionAttemptId, valid: v.valid, status: v.axes[a] ? v.axes[a].status : AxisStatus.NOT_EXECUTED, note: v.axes[a] ? v.axes[a].note : '' }));
    const validPerRun = perRun.filter((p) => p.valid);
    const invalidPerRun = perRun.filter((p) => !p.valid);

    const topOf = (set) => {
      let top = AxisStatus.NOT_EXECUTED;
      const topRuns = [];
      for (const p of set) {
        if (STATUS_RANK[p.status] > STATUS_RANK[top]) { top = p.status; topRuns.length = 0; topRuns.push(p.runId); }
        else if (p.status === top) topRuns.push(p.runId);
      }
      return { status: top, runs: topRuns };
    };

    const certified = topOf(validPerRun);
    certifiedUnion[a] = { status: certified.status, runs: certified.runs, perRun: validPerRun, provenance: 'certified-valid-runs' };

    // Historical / invalid runs: recorded separately, explicitly non-certifying.
    const historical = topOf(invalidPerRun);
    historicalObservations[a] = {
      status: historical.status,
      runs: historical.runs,
      perRun: invalidPerRun,
      provenance: 'historical-uncertifiable',
      certifying: false,
    };

    const verifiedSome = validPerRun.some((p) => p.status === AxisStatus.VERIFIED);
    const failedSome = validPerRun.some((p) => p.status === AxisStatus.FAILED);
    if (verifiedSome && failedSome) {
      conflicts.push({
        axis: a,
        detail: 'one VALID run VERIFIED this capability while another VALID run FAILED it',
        authoritativeRule: 'both retained; certification uses the single deepest valid run only; the failed run is never discarded',
        runs: validPerRun,
      });
    }
    if (invalidPerRun.some((p) => p.status === AxisStatus.VERIFIED)) {
      conflicts.push({
        axis: a,
        detail: 'an INVALID (uncertifiable) run reports this capability as VERIFIED',
        authoritativeRule: 'excluded from the certified column entirely; shown only under historicalObservations for transparency',
        runs: invalidPerRun,
      });
    }
  }

  // Union-of-observations may cross runs; it must NEVER be presented as a
  // session. Emit an explicit warning whenever a union looks "complete" but no
  // single run proves it. This deliberately considers ALL runs (including
  // uncertifiable historical ones), because the misleading impression is
  // exactly what an auditor needs flagged.
  const unionLooksComplete =
    list.some((v) => v.axes.gameplayEntered && v.axes.gameplayEntered.status === AxisStatus.VERIFIED) &&
    list.some((v) => v.axes.sessionEnded && v.axes.sessionEnded.status === AxisStatus.VERIFIED) &&
    list.some((v) => v.axes.resultsCurrent && v.axes.resultsCurrent.status === AxisStatus.VERIFIED);
  const singleRunL3 = valid.some((v) => v.level >= 3);
  if (unionLooksComplete && !singleRunL3) {
    diagnostics.push({
      kind: 'cross-run-union-not-a-journey',
      gameId: id,
      detail: 'gameplay entry, session end and results were each observed, but never inside one coherent execution attempt — this is NOT an L3 session',
      effect: 'certified level stays below 3',
    });
  }

  // Explicit downgrade explanations (legacy claimed vs certified).
  const downgrades = [];
  for (const v of list) {
    const claimed = v.run.claimedLevelLegacy;
    if (typeof claimed === 'number' && claimed > v.level) {
      downgrades.push({
        runId: v.executionAttemptId,
        claimedLevelLegacy: claimed,
        certifiedLevel: v.level,
        explanation: v.reasons.join('; ') || 'legacy classification not supported by proven capabilities',
      });
    }
  }

  // Build-mixing detection: if this game's runs came from different APKs or
  // source revisions, say so explicitly. Certification is single-run so a
  // fabrication is already impossible, but a reader must not mistake a mixed
  // evidence set for one coherent build's behaviour.
  const builds = new Map();
  for (const v of valid) {
    const b = v.run.buildIdentity || {};
    const key = `${b.gitSha || '?'}|${b.apkSha256 || '?'}|${b.versionCode ?? '?'}`;
    if (!builds.has(key)) builds.set(key, []);
    builds.get(key).push(v.executionAttemptId);
  }
  if (builds.size > 1) {
    diagnostics.push({
      kind: 'mixed-build-identity',
      gameId: id,
      detail: `certifying runs span ${builds.size} distinct build identities: ${[...builds.entries()].map(([k, rs]) => `${k} (${rs.length} run${rs.length > 1 ? 's' : ''})`).join('; ')}`,
      effect: 'certification remains single-run (no cross-build journey is possible); the mixed evidence set is flagged so it is not read as one build\'s behaviour',
    });
  }

  const first = list[0].run;
  return {
    id,
    name: first.name || id,
    category: first.category || '',
    certified,
    runs: list.map(runSummary),
    // B2: certified axes (valid runs only) vs historical uncertifiable
    // observations (invalid runs) are NEVER blended.
    capabilityUnion: certifiedUnion,
    historicalObservations,
    conflicts,
    downgrades,
    // Independent resilience subcapabilities MAY union across runs (contract
    // explicitly defines them as independent), each with run provenance.
    resilience: Object.fromEntries([...UNIONABLE].map((k) => [k, certifiedUnion[k]])),
  };
});

const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
for (const g of games) dist[g.certified.level] = (dist[g.certified.level] || 0) + 1;

const merged = {
  schemaVersion: 2,
  contractVersion: CONTRACT_VERSION,
  generatedAt: new Date().toISOString(),
  campaign: '080-native-product-quality',
  mergerSemantics: {
    certifiedLevel: 'deepest fully proven level from ONE contract-valid execution attempt (never a cross-run blend)',
    capabilityUnion: 'union of observations across runs — explicitly NOT a continuous session',
    booleanUnion: 'or3 (true > false > unknown); object-precedence overwrite is forbidden',
    invalidRuns: 'retained and diagnosed, excluded from certification',
    conflicts: 'preserved with the authoritative observation rule',
    resilience: 'independent subcapabilities; may union across runs with per-run provenance',
  },
  inputs: inputManifest,
  totals: {
    runs: runs.length,
    validRuns: validatedRuns.filter((v) => v.valid).length,
    invalidRuns: validatedRuns.filter((v) => !v.valid).length,
    games: games.length,
    byLevel: dist,
  },
  rawPerRunLedger: runs,
  validatedPerRunLedger: validatedRuns.map(runSummary),
  games,
  diagnostics,
  or3Reference: { 'or3(true,false)': or3(true, false), 'or3(false,false)': or3(false, false), 'or3(null,true)': or3(null, true), 'or3(false,null)': or3(false, null) },
};

fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(merged, null, 2));
console.log(`[merge] ${runs.length} run(s) / ${games.length} game(s) -> ${outJson}`);
console.log('[merge] certified level distribution:', JSON.stringify(dist));
console.log(`[merge] diagnostics: ${diagnostics.length}`);

// --- human-readable matrix -------------------------------------------------
if (outMatrix) {
  const short = {
    [AxisStatus.VERIFIED]: 'V',
    [AxisStatus.OBSERVED]: 'O',
    [AxisStatus.ATTEMPTED]: 'A',
    [AxisStatus.FAILED]: 'F',
    [AxisStatus.BLOCKED]: 'B',
    [AxisStatus.NOT_EXECUTED]: 'NE',
  };
  const rows = games.map((g) => {
    const c = g.capabilityUnion;
    const cell = (a) => short[c[a] ? c[a].status : AxisStatus.NOT_EXECUTED] || 'NE';
    return `| \`${g.id}\` | L${g.certified.level} | ${g.certified.status} | ${g.certified.runId ? `\`${g.certified.runId}\`` : '—'} | ${g.runs.length} | ${cell('launch')} | ${cell('render')} | ${cell('tutorialCompleted')} | ${cell('gameplayEntered')} | ${cell('inputAccepted')} | ${cell('feedbackObserved')} | ${cell('roundAdvanced')} | ${cell('autonomousGameplayEvent')} | ${cell('sessionEnded')} | ${cell('resultsCurrent')} | ${cell('safeExit')} |`;
  });
  const downgrades = games.flatMap((g) => g.downgrades.map((d) => `| \`${g.id}\` | ${d.runId} | L${d.claimedLevelLegacy} | L${d.certifiedLevel} | ${d.explanation} |`));
  const md = [
    '# Native 42-game coverage matrix — Campaign 080 (contract 2.0)',
    '',
    `Generated: ${merged.generatedAt}  •  Contract: ${CONTRACT_VERSION}  •  Inputs: ${inputManifest.map((i) => `${i.file} (${i.runCount} runs, ${i.evidenceSource})`).join(', ')}`,
    '',
    'This matrix is produced by the corrected evidence contract. **Certified level**',
    'is the deepest level proven by ONE coherent execution attempt. The per-axis',
    'columns are a **union of observations across runs** and never imply one',
    'continuous session. Cell legend: V=VERIFIED, O=OBSERVED, A=ATTEMPTED,',
    'F=FAILED, B=BLOCKED, NE=NOT EXECUTED.',
    '',
    `**Totals (certified, single-run proven):** ${games.length} games — L1 ${dist[1]}, L2 ${dist[2]}, L3 ${dist[3]}, L4 ${dist[4]}, below-L1 ${dist[0]}. Runs: ${merged.totals.runs} (${merged.totals.validRuns} valid / ${merged.totals.invalidRuns} invalid).`,
    '',
    '## Level definitions (contract 2.0)',
    '',
    '- **L0** — no proven native smoke (or smoke INCOMPLETE: e.g. safe exit never verified).',
    '- **L1** — verified native smoke: intended game launched, identity verified, correct screen rendered, entry controls present, safe exit ATTEMPTED **and its post-exit destination confirmed**.',
    '- **L2** — verified actual gameplay interaction: game entry + tutorial completion where required + positively identified active gameplay + a real input ACCEPTED (or a defined input-independent gameplay event for passive/timed games) + observable feedback/progression. A Start press or tutorial demonstration never qualifies.',
    '- **L3** — verified full-session lifecycle: actual gameplay entered, complete session reaches a legitimate terminal state, final results rendered AND attributable to the current session. Passive timeout completion is distinguished from answer-driven play.',
    '- **L4** — verified resilience scenario (background/relaunch, interruption/recovery, offline continuity, accessibility profile, responsive transition), reported as independent subcapabilities.',
    '',
    '## Per-game matrix',
    '',
    '| Game id | Certified | Status | Proven by run | Runs | Launch | Render | TutDone | Play | InputOK | Feedback | RoundAdv | Passive | SessEnd | Results | SafeExit |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Downgrade explanations (legacy claimed level -> certified level)',
    '',
    downgrades.length
      ? '| Game | Run | Claimed (v1) | Certified (v2) | Explanation |\n|---|---|---|---|---|\n' + downgrades.join('\n')
      : '_No legacy claims in these inputs._',
    '',
    '## Coverage-validation diagnostics',
    '',
    diagnostics.length
      ? diagnostics.map((d) => `- **${d.kind}**${d.gameId ? ` (${d.gameId})` : ''}${d.runId ? ` (run ${d.runId})` : ''}: ${d.detail}${d.effect ? ` — ${d.effect}` : ''}`).join('\n')
      : '_None._',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(outMatrix), { recursive: true });
  fs.writeFileSync(outMatrix, md);
  console.log(`[merge] matrix -> ${outMatrix}`);
}

if (strict && validatedRuns.some((v) => !v.valid)) {
  console.error('[merge] --strict: contract-invalid runs present (see diagnostics)');
  process.exit(1);
}
