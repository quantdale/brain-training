#!/usr/bin/env node
/**
 * reclassify-historical.mjs — replay the ORIGINAL Campaign 080 v1 coverage
 * evidence through the corrected contract (coverage-contract 2.0) WITHOUT
 * editing history (prompt §6).
 *
 * What this does:
 *   1. Backs up the original v1 ledgers byte-for-byte under
 *      scripts/qa/historical/080/ (sha256 recorded) — the originals in place
 *      are never modified.
 *   2. Synthesizes CONSERVATIVE schema-2 run records from the v1 records:
 *        - controlLog phases -> ordered observations (states DERIVED from the
 *          actual recorded control inventories, never asserted),
 *        - phase-to-phase state changes -> synthesized wait/transition events
 *          (real observation-level evidence from the historical dumps),
 *        - v1 milestone booleans (started / inputSubmitted / roundAdvanced /
 *          safeExit) -> ATTEMPTED actions only. v1 recorded these when an adb
 *          command was issued, not when the application responded, so they are
 *          never credited as outcomes (F-080-001 / F-080-004).
 *   3. Classifies every synthesized run through the corrected classifier twice:
 *        - CERTIFIED level  — full contract incl. provenance. The v1 ledger
 *          recorded only a free-text build label (no git SHA, package version,
 *          APK hash, device serial), so provenance FAILS (F-080-005) and no
 *          historical run can be certified. That is the truthful result.
 *        - EVIDENCE DEPTH   — deriveLevelFromAxes() over the same evidence,
 *          explicitly labelled depth-only: what the recorded observations
 *          would prove if provenance were complete. Never certification.
 *   4. Emits a schema-2 run ledger for the merger plus a reclassification
 *      report naming EVERY downgraded game with its explanation.
 *
 * Usage:
 *   node scripts/qa/reclassify-historical.mjs [--out FILE] [--report FILE]
 *        [--backup-dir DIR]
 * Exit codes: 0 = reclassified, 2 = usage/missing input.
 */
'use strict';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTRACT_VERSION,
  deriveCapabilities,
  deriveLevelFromAxes,
  observeState,
  validateRunRecord,
} from './coverage-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function usage() {
  console.log('usage: reclassify-historical.mjs [--out FILE] [--report FILE] [--backup-dir DIR] [v1Ledger.json ...]');
}
const argv = process.argv.slice(2);
const inputs = [];
let outFile = path.join(REPO_ROOT, 'scripts', 'qa', 'native-coverage-historical-reclassified.json');
let reportFile = path.join(REPO_ROOT, 'docs', 'certification', '080-native-product-quality', 'coverage-reclassification.md');
let backupDir = path.join(REPO_ROOT, 'scripts', 'qa', 'historical', '080');
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outFile = path.resolve(argv[++i] || '');
  else if (argv[i] === '--report') reportFile = path.resolve(argv[++i] || '');
  else if (argv[i] === '--backup-dir') backupDir = path.resolve(argv[++i] || '');
  else if (argv[i] === '-h' || argv[i] === '--help') { usage(); process.exit(0); }
  else if (argv[i].startsWith('--')) { console.error(`unknown option '${argv[i]}'`); usage(); process.exit(2); }
  else inputs.push(path.resolve(argv[i]));
}
if (inputs.length === 0) {
  inputs.push(
    path.join(REPO_ROOT, 'scripts', 'qa', 'native-coverage-ledger.json'),
    path.join(REPO_ROOT, 'qa-artifacts', '080', 'sweep-pass2.json'),
  );
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// --- 1. byte-for-byte backup of the original evidence ----------------------
const backups = [];
fs.mkdirSync(backupDir, { recursive: true });
for (const f of inputs) {
  if (!fs.existsSync(f)) continue;
  const raw = fs.readFileSync(f);
  const dest = path.join(backupDir, `original-${path.basename(f)}`);
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, raw); // never overwrite history
  backups.push({ source: path.relative(REPO_ROOT, f).replace(/\\/g, '/'), backup: path.relative(REPO_ROOT, dest).replace(/\\/g, '/'), bytes: raw.length, sha256: sha256(raw) });
}

// --- 2. conservative v1 -> schema-2 synthesis ------------------------------
function synthesizeRun(game, v1, sourceFile) {
  const gameId = game.id;
  const attemptId = `hist-${path.basename(sourceFile, '.json')}--${gameId}`;
  const phases = Array.isArray(game.controlLog) ? game.controlLog : [];

  // Observations: derived from the recorded control inventories. The '(screen)'
  // marker from v1 parseControls is normalized to 'screen'.
  const observations = phases.map((p, i) => {
    const controls = (p.controls || []).map((c) => (c === '(screen)' ? 'screen' : c));
    const obs = {
      seq: i,
      phase: p.phase || `phase-${i}`,
      controls,
      screenMarkers: [],
      observedGameId: controls.length ? gameId : null,
      score: null,
      timestamp: null,
      evidenceArtifact: null,
      synthesizedFrom: 'v1.controlLog',
    };
    obs.state = observeState({ ...obs, gameId }).state;
    return obs;
  });

  // Synthesized events:
  //  - one deeplink (launch was attempted; no pre-observation to acknowledge).
  //  - one transition event per consecutive observation pair whose DERIVED
  //    state changed (real observation-level evidence from the dumps).
  //  - v1 milestone booleans -> attempted actions with NO acknowledgment.
  const events = [];
  let seq = 0;
  const ts = v1.generatedAt || null;
  events.push({
    seq: seq++, action: 'deeplink', target: `braintraining://game/${gameId}`,
    actionRequested: true, actionExecuted: true, actionAcknowledged: null,
    timestamp: ts, executionAttemptId: attemptId, synthesizedFrom: 'v1.milestones.launched',
  });
  for (let i = 1; i < observations.length; i++) {
    const before = observations[i - 1];
    const after = observations[i];
    if (before.state === after.state) continue;
    events.push({
      seq: seq++, action: 'wait', target: '(observation transition)',
      actionRequested: true, actionExecuted: true,
      actionAcknowledged: true,
      observationBeforeSeq: before.seq, observationAfterSeq: after.seq,
      stateBefore: before.state, stateAfter: after.state,
      transitionObserved: true,
      transitionValid: true,
      timestamp: ts, executionAttemptId: attemptId,
      synthesizedFrom: 'v1.controlLog phase delta',
    });
  }
  // v1 milestone booleans were ACTION records, never outcome records. They are
  // preserved as attempted actions and deliberately carry no observation
  // binding (v1 never bound actions to before/after observations).
  const m = game.milestones || {};
  const attempted = (flag, action, target, note) => {
    if (!m[flag]) return;
    events.push({
      seq: seq++, action, target,
      actionRequested: true, actionExecuted: true, actionAcknowledged: null,
      timestamp: ts, executionAttemptId: attemptId,
      synthesizedFrom: `v1.milestones.${flag} (action attempted only — v1 never proved an application response)`,
      note,
    });
  };
  attempted('started', 'tap', `${gameId}.start`, 'Start tap issued; gameplay entry not proven by v1');
  attempted('inputSubmitted', 'tap', '(interactive control)', 'Tap issued; acceptance not proven by v1');
  attempted('roundAdvanced', 'tap', `${gameId}.next-round`, 'Next tap issued; round change not proven by v1');
  if (m.safeExit) {
    events.push({
      seq: seq++, action: 'back', target: 'KEYCODE_BACK',
      actionRequested: true, actionExecuted: true, actionAcknowledged: null,
      timestamp: ts, executionAttemptId: attemptId,
      synthesizedFrom: 'v1.milestones.safeExit (v1 set this unconditionally — F-080-002: no post-exit destination was ever observed)',
    });
  }

  return {
    executionAttemptId: attemptId,
    evidenceSource: 'historical-reclassification',
    knownGameId: true,
    gameId,
    name: game.name,
    category: game.category,
    hasTutorial: game.hasTutorial,
    // F-080-005: the v1 ledger recorded only a free-text build label. Provenance
    // fields are therefore genuinely UNKNOWN and stay null — never fabricated.
    buildIdentity: {
      gitSha: null,
      packageName: 'com.braintraining.app',
      versionName: null,
      versionCode: null,
      apkSha256: null,
      legacyLabel: v1.buildIdentity || null,
      provenanceStatus: 'INCOMPLETE — no commit/APK/installed-build binding recorded (F-080-005)',
    },
    deviceProfile: {
      serial: null,
      model: v1.device || null,
      abi: v1.abi || null,
      display: v1.display || null,
      density: v1.density || null,
      renderer: v1.renderer || null,
      provenanceStatus: 'INCOMPLETE — no device serial recorded',
    },
    startedAt: v1.generatedAt || null,
    endedAt: v1.generatedAt || null,
    events,
    observations,
    artifacts: (game.artifacts || []).map((a) => ({ file: a.file, bytes: a.bytes, sha1: a.sha1 })),
    claimedLevelLegacy: game.levelReached ?? null,
    claimedResultLegacy: game.result ?? null,
    remainingGap: game.remainingGap || '',
  };
}

// --- 3. classify -----------------------------------------------------------
const runs = [];
const rows = [];
for (const f of inputs) {
  if (!fs.existsSync(f)) {
    console.error(`[reclassify] missing input ${f}`);
    continue;
  }
  let v1;
  try {
    v1 = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    console.error(`[reclassify] unreadable/invalid v1 ledger ${f}: ${e.message}`);
    process.exit(2);
  }
  if (!v1 || !Array.isArray(v1.games)) {
    console.error(`[reclassify] malformed v1 ledger ${f}: missing games[]`);
    process.exit(2);
  }
  for (const game of v1.games || []) {
    const run = synthesizeRun(game, v1, f);
    const validation = validateRunRecord(run);
    const axes = deriveCapabilities(run);
    const depth = deriveLevelFromAxes(axes);
    runs.push({ ...run, _reclassification: { certifiedLevel: 0, certifiedStatus: 'FAILED', depthLevel: depth.level, depthStatus: depth.status, validationErrors: validation.errors, depthReasons: depth.reasons } });
    rows.push({
      source: path.basename(f),
      gameId: game.id,
      name: game.name,
      claimedLevel: game.levelReached ?? null,
      claimedResult: game.result || '',
      certifiedLevel: 0,
      depthLevel: depth.level,
      depthStatus: depth.status,
      depthReasons: depth.reasons,
      validationErrors: validation.errors,
      milestones: game.milestones || {},
      axes: {
        gameplayEntered: axes.gameplayEntered.status,
        inputAccepted: axes.inputAccepted.status,
        feedbackObserved: axes.feedbackObserved.status,
        roundAdvanced: axes.roundAdvanced.status,
        autonomousGameplayEvent: axes.autonomousGameplayEvent.status,
        sessionEnded: axes.sessionEnded.status,
        resultsCurrent: axes.resultsCurrent.status,
        safeExit: axes.safeExit.status,
      },
    });
    const flag = depth.level < (game.levelReached ?? 0) ? 'DOWNGRADE' : 'depth-equal';
    console.log(`[reclassify] ${game.id}: claimed L${game.levelReached} -> certified L0 / depth L${depth.level} (${flag})`);
  }
}

const ledger = {
  schemaVersion: 2,
  contractVersion: CONTRACT_VERSION,
  generatedAt: new Date().toISOString(),
  evidenceSource: 'historical-reclassification',
  note: 'Conservative re-synthesis of Campaign 080 v1 sweep evidence through the corrected contract. Originals preserved byte-for-byte under scripts/qa/historical/080/. Every run FAILS provenance validation (F-080-005) and therefore certifies at L0; depthLevel records what the recorded observations would prove with complete provenance.',
  backups,
  runs,
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(ledger, null, 2));

// --- 4. report -------------------------------------------------------------
const downgrades = rows.filter((r) => r.depthLevel < (r.claimedLevel ?? 0));
const claimedDist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
const depthDist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
for (const r of rows) {
  claimedDist[r.claimedLevel ?? 0] = (claimedDist[r.claimedLevel ?? 0] || 0) + 1;
  depthDist[r.depthLevel] = (depthDist[r.depthLevel] || 0) + 1;
}
const md = [
  '# Coverage reclassification — historical Campaign 080 evidence through contract 2.0',
  '',
  `Generated: ${ledger.generatedAt}  •  Contract: ${CONTRACT_VERSION}  •  Tool: scripts/qa/reclassify-historical.mjs`,
  '',
  'This is **historical reclassification**, not fresh runtime execution. The',
  'original Campaign 080 ledgers are preserved byte-for-byte (see table) and were',
  'NOT edited. Every figure below is derived from the evidence those ledgers',
  'actually contain.',
  '',
  '## 1. Original evidence preserved',
  '',
  '| Source | Backup | Bytes | SHA-256 |',
  '|---|---|---|---|',
  ...backups.map((b) => `| \`${b.source}\` | \`${b.backup}\` | ${b.bytes} | \`${b.sha256}\` |`),
  '',
  '## 2. Original reported coverage (v1, unchanged)',
  '',
  `- Claims: ${claimedDist[1]} at L1, ${claimedDist[2]} at L2, ${claimedDist[3]} at L3 (v1 definitions; v1 awarded L2 for attempted taps/Start presses — F-080-001).`,
  `- Runs replayed: ${rows.length} (${rows.map((r) => r.source).filter((v, i, a) => a.indexOf(v) === i).join(', ')}).`,
  '',
  '## 3. Corrected verdict for the historical runs',
  '',
  '- **Certified level: L0 for every historical run.** The v1 ledger recorded no',
  '  commit SHA, no APK hash, no package version and no device serial, and bound',
  '  no action to before/after observations. Under contract 2.0 provenance',
  '  (F-080-005) and transition proof (F-080-004) that evidence cannot certify a',
  '  level. It is retained as historical observation, not discarded.',
  '- **Evidence depth** (what the recorded control inventories would prove with',
  `  complete provenance): ${depthDist[1]} L1-depth, ${depthDist[2]} L2-depth, ${depthDist[3]} L3-depth, ${depthDist[0]} below L1-depth.`,
  '- Every v1 L2/L3 claim that does not survive as equal-or-greater depth is a',
  '  **downgrade**, itemized below.',
  '',
  '## 4. Downgraded games (claimed level -> corrected depth) with explanations',
  '',
  downgrades.length
    ? ['| Game | Claimed | Depth | Why the claim does not hold |', '|---|---|---|---|',
      ...downgrades.map((r) => `| \`${r.gameId}\` | L${r.claimedLevel} | L${r.depthLevel} | ${r.depthReasons.join('; ')} |`)].join('\n')
    : '_None._',
  '',
  '## 5. Full per-game reclassification',
  '',
  'Axis legend: V=VERIFIED, O=OBSERVED, A=ATTEMPTED, F=FAILED, NE=NOT EXECUTED.',
  'Axes are what the historical dumps actually contain; the certified level is',
  'nevertheless L0 because provenance and transition binding are missing.',
  '',
  '| Game | v1 claimed | v1 result | Depth | Play | InputOK | Feedback | RoundAdv | SessEnd | Results | SafeExit | Blocking evidence gap |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => {
    const m = r.milestones;
    const gaps = [];
    if (m.tutorialSeen && !m.tutorialCleared) gaps.push('tutorial never cleared');
    if (m.started && !m.inputSubmitted) gaps.push('Start only, no gameplay input');
    if (m.inputSubmitted && !m.feedbackObserved && !m.roundAdvanced) gaps.push('tap issued, no application response');
    if (m.safeExit) gaps.push('safe exit claimed without destination proof (F-080-002)');
    if (r.claimedResult === 'PASS' && r.depthLevel < 2) gaps.push('v1 PASS not substantiated (F-080-001)');
    const a = r.axes;
    return `| \`${r.gameId}\` | L${r.claimedLevel} | ${r.claimedResult} | L${r.depthLevel} | ${a.gameplayEntered} | ${a.inputAccepted} | ${a.feedbackObserved} | ${a.roundAdvanced} | ${a.sessionEnded} | ${a.resultsCurrent} | ${a.safeExit} | ${gaps.join('; ') || '—'} |`;
  }),
  '',
  '## 6. Contract defects this replay demonstrates',
  '',
  '- **F-080-001** — v1 `classifyLevel` awarded L2 on `inputSubmitted || started`,',
  '  so tutorial-side taps and Start presses produced L2 PASS. Under contract 2.0',
  '  those are ATTEMPTED actions with no accepted gameplay transition.',
  '- **F-080-002** — v1 set `safeExit = true` unconditionally after sending Back.',
  '  No historical run contains a post-exit observation, so no historical run can',
  '  certify L1 complete smoke.',
  '- **F-080-003** — the v1 merger spread milestone objects instead of OR-ing;',
  '  this replay never merges across runs (see merge-coverage.mjs 2.0 semantics).',
  '- **F-080-004** — v1 milestones recorded actions, not outcomes.',
  '- **F-080-005** — no build/APK/device binding exists for any historical run.',
  '',
  'Fresh runtime execution (schema-2 ledgers from the corrected sweep harness)',
  'is the authoritative coverage source; this replay exists to keep the historical',
  'record honest and to quantify exactly how far the v1 claims overreached.',
  '',
].join('\n');
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
fs.writeFileSync(reportFile, md);

console.log(`[reclassify] ${runs.length} historical run(s) -> ${outFile}`);
console.log(`[reclassify] report -> ${reportFile}`);
console.log(`[reclassify] downgrades: ${downgrades.length}`);
