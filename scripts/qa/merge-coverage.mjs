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
 *        [--capture-receipts INDEX] [--out FILE] [--matrix FILE] [--strict]
 *
 * Artifact attestation (Campaign 080 P1-3): certification additionally
 * requires a per-run PASS from the independent artifact verifier
 * (scripts/qa/artifact-integrity.mjs). A run whose mandatory artifacts are
 * absent, unreadable or hash-mismatched is marked NON-CERTIFYING and
 * contributes to no certified level or capability axis. The merged output
 * carries an explicit `artifactAttestation` block (verified counts + verdict).
 *
 * Exit codes: 0 = merged, 2 = usage/invalid top-level input, 1 = --strict and at least
 * one run failed contract/registry/quarantine validation OR lacks a PASS artifact attestation.
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
import { EvidenceMode, verifyArtifactLedger } from './artifact-integrity.mjs';
import { isQuarantinedLedger, isQuarantinedRun, loadEvidenceGameMetadata, validateEvidenceRun } from './artifact-policy.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
function describeRunEntry(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}

// --- args ------------------------------------------------------------------
function usage() {
  console.log('usage: merge-coverage.mjs <runLedger.json> [...] [--capture-receipts INDEX] [--out FILE] [--matrix FILE] [--strict]');
}
const argv = process.argv.slice(2);
const inputs = [];
let outJson = 'scripts/qa/native-coverage-merged.json';
let outMatrix = null;
let captureReceipts = null;
let strict = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outJson = path.resolve(argv[++i] || '');
  else if (argv[i] === '--matrix') outMatrix = path.resolve(argv[++i] || '');
  else if (argv[i] === '--capture-receipts') {
    const index = argv[++i];
    if (!index || index.startsWith('-')) { console.error('--capture-receipts requires a path'); usage(); process.exit(2); }
    captureReceipts = path.resolve(index);
  }
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
  if (doc === null || typeof doc !== 'object') {
    diagnostics.push({ kind: 'malformed-ledger', file, detail: 'top-level ledger must be an object or array', fatal: true });
    console.error(`[merge] malformed ledger ${file}: top-level value must be an object or array`);
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
  let fileRuns = null;
  if (Array.isArray(doc)) fileRuns = doc;
  else if (Array.isArray(doc.runs)) fileRuns = doc.runs;
  if (!fileRuns) {
    diagnostics.push({ kind: 'malformed-ledger', file, detail: 'no runs[] array (schemaVersion 2 ledger required)', fatal: true });
    console.error(`[merge] malformed ledger ${file}: expected { runs: [...] }`);
    process.exit(2);
  }
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  const quarantinedLedger = isQuarantinedLedger(file, doc);
  inputManifest.push({ file: path.basename(file), sha256, runCount: fileRuns.length, generatedAt: doc.generatedAt || null, evidenceSource: doc.evidenceSource || 'runtime', quarantined: quarantinedLedger });
  fileRuns.forEach((r, i) => {
    // B4: a type-corrupt entry must produce a deterministic, actionable
    // validation result — never an uncontrolled crash downstream and never a
    // silent omission. Corrupt entries are retained as INVALID runs.
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      diagnostics.push({
        kind: 'corrupt-run-entry',
        file: path.basename(file),
        runId: `(entry ${i})`,
        detail: `run entry is ${describeRunEntry(r)}, not an object`,
        effect: 'retained as an invalid run; excluded from certification',
      });
      runs.push({ executionAttemptId: `(corrupt-entry-${i})`, gameId: '(missing)', events: [], observations: [], _corrupt: true, _sourceFile: path.basename(file), _sourceSha256: sha256 });
      return;
    }
    const quarantined = quarantinedLedger || isQuarantinedRun(r);
    runs.push({ ...r, ...(quarantined ? { _quarantined: true } : {}), _sourceFile: path.basename(file), _sourceSha256: sha256 });
  });
}

// --- authoritative registry (B1) -------------------------------------------
let gameMetadata = null;
let knownGames = null;
try {
  gameMetadata = loadEvidenceGameMetadata();
  knownGames = new Set(gameMetadata.keys());
}
catch (error) {
  diagnostics.push({
    kind: 'registry-unavailable',
    detail: `authoritative game registry could not be loaded: ${error.message}`,
    effect: 'all runs are non-certifying until registry validation is available',
  });
}

// --- duplicate execution-attempt detection (B4) ----------------------------
const attemptIdCount = new Map();
for (const r of runs) {
  const id = r.executionAttemptId || '(missing)';
  attemptIdCount.set(id, (attemptIdCount.get(id) || 0) + 1);
}
const duplicateAttemptIds = new Set([...attemptIdCount].filter(([, count]) => count > 1).map(([id]) => id));
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
  const shape = validateEvidenceRun(r, knownGames, gameMetadata);
  const errors = [...(shape.errors || [])];
  const attemptId = r.executionAttemptId || '(missing)';
  const quarantined = isQuarantinedRun(r);
  if (r._corrupt) errors.push('ledger entry is malformed and was retained as a non-certifying run');
  if (quarantined && !errors.some((error) => error.includes('quarantined'))) errors.push('historical v1-v7 evidence is quarantined');
  if (duplicateAttemptIds.has(attemptId)) errors.push(`duplicate executionAttemptId '${attemptId}' appears in this merge input`);
  const valid = shape.valid && !r._corrupt && !quarantined && !duplicateAttemptIds.has(attemptId);
  let c = { level: 0, status: 'FAILED', axes: {}, reasons: ['invalid, duplicate, or quarantined run is non-certifying'] };
  if (shape.safeToDerive) {
    try { c = classifyRun(r, { knownGames }); }
    catch { c = { level: 0, status: 'FAILED', axes: {}, reasons: ['run could not be safely classified'] }; }
  }
  return {
    run: r,
    executionAttemptId: attemptId,
    gameId: r.gameId || '(missing)',
    valid,
    errors,
    warnings: shape.warnings || [],
    notes: shape.notes || [],
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

// --- per-run artifact attestation (Campaign 080 P1-3) ---------------------
// INVARIANT: merge-coverage must NEVER report a certifying level for evidence
// whose artifacts were not independently verified. The second independent
// review merged the v8 ledger to 7x L3 in a checkout where every referenced
// artifact was absent (verify-artifacts: BLOCKED, unreadable=1119). That is
// now impossible: each run must PASS independent artifact verification
// (bytes re-read from disk and re-hashed against the recorded digests) before
// it may certify ANYTHING. Absent/unreadable/mismatched mandatory artifacts
// make the run NON-CERTIFYING; in --strict mode such a run also fails the CLI.
function attestRunArtifact(r, runValid) {
  try {
    const res = verifyArtifactLedger([r], {
      mode: EvidenceMode.LOCAL,
      repoRoot: REPO_ROOT,
      buildScope: 'archive',
      captureReceipts,
    });
    return {
      verdict: res.verdict,
      certifying: runValid && res.verdict === 'PASS',
      runValid,
      verifiedArtifacts: (res.counters.verified || 0) + (res.counters.verifiedLegacy || 0),
      counters: res.counters,
      findings: (res.findings || []).slice(0, 10),
      findingsTotal: (res.findings || []).length,
    };
  } catch (e) {
    // Fail closed: an attestation that cannot run is never a PASS.
    return {
      verdict: 'ATTESTATION_ERROR',
      certifying: false,
      runValid,
      verifiedArtifacts: 0,
      counters: {},
      findings: [{ kind: 'attestation-error', detail: String(e.message || e) }],
      findingsTotal: 1,
    };
  }
}

for (const v of validatedRuns) {
  v.artifactAttestation = attestRunArtifact(v.run, v.valid);
}
for (const v of validatedRuns.filter((x) => !x.artifactAttestation.certifying)) {
  const c = v.artifactAttestation.counters || {};
  diagnostics.push({
    kind: 'artifact-attestation-failed',
    runId: v.executionAttemptId,
    gameId: v.gameId,
    detail: `per-run artifact attestation ${v.artifactAttestation.verdict} (verified=${v.artifactAttestation.verifiedArtifacts}, mismatch=${c.mismatch || 0}, missing=${c.missing || 0}, unreadable=${c.unreadable || 0})`,
    effect: 'run is NON-CERTIFYING: it contributes to no certified level or capability axis',
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
    // P1-3: every run carries its own artifact attestation so a reader can
    // see exactly why a run is or is not certifying.
    artifactAttestation: v.artifactAttestation,
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
  // CERTIFYING runs are contract-valid AND artifact-attested (P1-3). A run
  // without a PASS artifact attestation is NON-CERTIFYING even when its
  // recorded events/observations would otherwise prove a level — the v8
  // regression: levels must never be reported without verified artifacts.
  const certifiable = list.filter((v) => v.valid && v.artifactAttestation.certifying);
  // CERTIFIED level: deepest FULLY proven level from ONE certifying run.
  const best = certifiable.reduce((acc, v) => (v.level > (acc ? acc.level : -1) ? v : acc), null);
  const certified = best
    ? { level: best.level, levelName: LEVEL_NAME[best.level], status: best.status, runId: best.executionAttemptId, reasons: best.reasons, artifactAttested: true }
    : {
        level: 0,
        levelName: LEVEL_NAME[0],
        status: 'FAILED',
        runId: null,
        reasons: [
          list.some((v) => v.valid)
            ? 'contract-valid run(s) present but NONE passed per-run artifact attestation — levels are suppressed (non-certifying)'
            : 'no contract-valid execution attempt',
        ],
        artifactAttested: false,
      };

  // ------------------------------------------------------------------
  // B2: CERTIFIED capability axes come from CERTIFYING runs ONLY
  // (contract-valid AND artifact-attested). Runs that are contract-invalid
  // OR lack a PASS artifact attestation remain visible for transparency (in
  // `historicalObservations`) but must never make a certified capability
  // column look verified.
  // ------------------------------------------------------------------
  const certifiedUnion = {};
  const historicalObservations = {};
  const conflicts = [];
  for (const a of AXIS_ORDER) {
    const perRun = list.map((v) => ({ runId: v.executionAttemptId, valid: v.valid, artifactAttested: v.artifactAttestation.certifying, status: v.axes[a] ? v.axes[a].status : AxisStatus.NOT_EXECUTED, note: v.axes[a] ? v.axes[a].note : '' }));
    const validPerRun = perRun.filter((p) => p.valid && p.artifactAttested);
    const invalidPerRun = perRun.filter((p) => !(p.valid && p.artifactAttested));

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

    // Uncertifiable runs (contract-invalid and/or artifact attestation
    // failed): recorded separately, explicitly non-certifying.
    const historical = topOf(invalidPerRun);
    historicalObservations[a] = {
      status: historical.status,
      runs: historical.runs,
      perRun: invalidPerRun,
      provenance: 'uncertifiable (contract-invalid and/or failed artifact attestation)',
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
        detail: 'an UNCERTIFIABLE run (contract-invalid or artifact attestation failed) reports this capability as VERIFIED',
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
  const singleRunL3 = certifiable.some((v) => v.level >= 3);
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
  for (const v of certifiable) {
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

// --- artifact attestation summary (P1-3) ---------------------------------
const attestedRuns = validatedRuns.filter((v) => v.artifactAttestation.certifying);
const attestationCounters = {};
for (const v of validatedRuns) {
  for (const [k, n] of Object.entries(v.artifactAttestation.counters || {})) {
    attestationCounters[k] = (attestationCounters[k] || 0) + (Number(n) || 0);
  }
}
const nonCertifyingRuns = validatedRuns
  .filter((v) => !v.artifactAttestation.certifying)
  .map((v) => ({ runId: v.executionAttemptId, gameId: v.gameId, verdict: v.artifactAttestation.verdict }));
const artifactAttestation = {
  mode: EvidenceMode.LOCAL,
  buildScope: 'archive',
  nativeCurrentCertification: false,
  trustBoundary: 'capture receipts and the receipt index establish independent acquisition records but are not cryptographic proof of native capture; current-source certification requires verify-artifacts --build-scope single with externally supplied expected source/APK identities',
  policy: 'every run must PASS independent per-run artifact verification (artifact bytes re-read from disk, re-hashed, checked against an indexed per-artifact capture receipt); a run without a PASS attestation is NON-CERTIFYING and contributes to no certified level or capability axis',
  runsInspected: validatedRuns.length,
  runsAttested: attestedRuns.length,
  runsNonCertifying: nonCertifyingRuns.length,
  verifiedArtifacts: (attestationCounters.verified || 0) + (attestationCounters.verifiedLegacy || 0),
  counters: attestationCounters,
  verdict: validatedRuns.length > 0 && nonCertifyingRuns.length === 0 ? 'CERTIFYING' : 'NON_CERTIFYING',
  nonCertifyingRuns,
};

const merged = {
  schemaVersion: 2,
  contractVersion: CONTRACT_VERSION,
  generatedAt: new Date().toISOString(),
  campaign: '080-native-product-quality',
  mergerSemantics: {
    certifiedLevel: 'deepest fully proven level from ONE contract-valid, artifact-attested execution attempt (never a cross-run blend)',
    capabilityUnion: 'union of observations across runs — explicitly NOT a continuous session',
    booleanUnion: 'or3 (true > false > unknown); object-precedence overwrite is forbidden',
    invalidRuns: 'retained and diagnosed, excluded from certification',
    conflicts: 'preserved with the authoritative observation rule',
    resilience: 'independent subcapabilities; may union across runs with per-run provenance',
    artifactAttestation: 'per-run independent artifact verification (P1-3); a run without a PASS attestation is non-certifying and its levels are suppressed',
    nativeCurrentCertification: 'not performed by this multi-build merger; require verify-artifacts single scope with externally supplied expected source and APK hashes',
    captureReceiptTrustBoundary: 'indexed acquisition receipts are independently read and checked but are not cryptographic proof of native capture',
  },
  inputs: inputManifest,
  artifactAttestation,
  totals: {
    runs: runs.length,
    validRuns: validatedRuns.filter((v) => v.valid).length,
    invalidRuns: validatedRuns.filter((v) => !v.valid).length,
    artifactAttestedRuns: attestedRuns.length,
    nonCertifyingRuns: nonCertifyingRuns.length,
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
    `**Totals (certified, single-run proven):** ${games.length} games — L1 ${dist[1]}, L2 ${dist[2]}, L3 ${dist[3]}, L4 ${dist[4]}, below-L1 ${dist[0]}. Runs: ${merged.totals.runs} (${merged.totals.validRuns} valid / ${merged.totals.invalidRuns} invalid / ${merged.totals.artifactAttestedRuns} artifact-attested).`,
    '',
    `**Artifact attestation (P1-3):** ${artifactAttestation.verdict} — ${artifactAttestation.runsAttested}/${artifactAttestation.runsInspected} runs passed independent artifact verification (${artifactAttestation.verifiedArtifacts} artifacts re-hashed; mismatch ${artifactAttestation.counters.mismatch || 0}, missing ${artifactAttestation.counters.missing || 0}, unreadable ${artifactAttestation.counters.unreadable || 0}). Runs without a PASS attestation are NON-CERTIFYING: their certified levels are suppressed.`,
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
      ? `| Game | Run | Claimed (v1) | Certified (v2) | Explanation |\n|---|---|---|---|---|\n${downgrades.join('\n')}`
      : '_No legacy claims in these inputs._',
    '',
    '## Coverage-validation diagnostics',
    '',
    diagnostics.length
      ? diagnostics.map((d) => `- **${d.kind}**${d.gameId ? ` (${d.gameId})` : ''}${d.runId ? ` (run ${d.runId})` : ''}: ${d.detail}${d.effect ? ` — ${d.effect}` : ''}`).join('\n')
      : '_None._',
    '',
    '## Artifact attestation per run (P1-3)',
    '',
    '| Run id | Game | Attestation | Certifying | Verified artifacts | Mismatch | Missing | Unreadable |',
    '|---|---|---|---|---|---|---|---|',
    ...validatedRuns.map((v) => {
      const a = v.artifactAttestation;
      const c = a.counters || {};
      return `| \`${v.executionAttemptId}\` | \`${v.gameId}\` | ${a.verdict} | ${a.certifying ? 'yes' : '**NO — non-certifying**'} | ${a.verifiedArtifacts} | ${c.mismatch || 0} | ${c.missing || 0} | ${c.unreadable || 0} |`;
    }),
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(outMatrix), { recursive: true });
  fs.writeFileSync(outMatrix, md);
  console.log(`[merge] matrix -> ${outMatrix}`);
}

if (strict && (runs.length === 0 || validatedRuns.some((v) => !v.valid) || validatedRuns.some((v) => !v.artifactAttestation.certifying))) {
  console.error(`[merge] --strict: ${runs.length === 0 ? 'zero runs present' : 'contract-invalid runs and/or runs without a PASS artifact attestation present'} (see diagnostics)`);
  process.exit(1);
}
