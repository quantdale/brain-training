/**
 * verify-artifacts.cli.test.mjs — MANDATORY process-exit tests for the
 * artifact-integrity verifier (Campaign 080, F-080-NEW-001 / F-080-NEW-002).
 *
 * Why this file exists in this shape
 * ----------------------------------
 * The two reported verifier defects were both about the RELATIONSHIP between a
 * verdict and the PROCESS EXIT CODE, and one of them was additionally about what
 * a counter does to a verdict. A unit test that only inspects the returned
 * verdict object cannot catch either class: the original defect lived entirely
 * in the exit expression, and a test asserting `result.verdict === 'BLOCKED'`
 * would have been green on the defective code.
 *
 * Therefore every test below spawns the real CLI as a child process and asserts
 * its actual exit status, and the historically defective expression is pinned as
 * an explicit regression case.
 *
 * Fixtures are written under `qa-artifacts/` (git-ignored) so the verifier's
 * real, unmodified path resolution is exercised — a fixture outside the
 * repository could never be tested because the verifier refuses such paths by
 * design.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isQuarantinedRun } from './artifact-policy.mjs';
import {
  BuildScope,
  EvidenceMode,
  VerificationVerdict,
  buildIdentityKey,
  deriveVerificationExitCode,
  partitionByBuild,
  resolveArtifactPath,
  sniffHierarchy,
  sniffScreenshot,
  verifyArtifactLedger,
} from './artifact-integrity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CLI = path.join(HERE, 'verify-artifacts.mjs');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'qa-artifacts', '080', 'verify-fixtures');

// Build a genuine 1x1 RGBA PNG with valid CRCs and a complete zlib scanline.
// The old fixture had a valid signature but a corrupt IDAT CRC.
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const pngChunk = (type, payload) => {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4); length.writeUInt32BE(payload.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([length, name, payload, crc]);
};
const PNG_1X1 = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  pngChunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
  pngChunk('IEND', Buffer.alloc(0)),
]);
const HIERARCHY_XML = (gameId = 'memory-pair-recall', controls = ['intro', 'start'], markers = []) => {
  const nodes = [...controls.map((control) => `<node index="0" text="${control}" resource-id="${gameId}.${control}" class="android.widget.TextView" package="com.braintraining.app" />`),
    ...markers.map((marker) => `<node index="0" text="${marker}" resource-id="${marker}" class="android.widget.TextView" package="com.braintraining.app" />`)];
  if (!nodes.length) nodes.push('<node index="0" text="Games" resource-id="games-title" class="android.widget.TextView" package="com.braintraining.app" />');
  return Buffer.from(`<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">${nodes.join('')}</hierarchy>`, 'utf8');
};

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');

let fixtureCounter = 0;
const captureIndexByLedger = new Map();
/** Write a fixture artifact under the repository (git-ignored) and return its
 * repository-relative path plus the digests the ledger should record. */
function writeArtifact(label, bytes, ext = 'png') {
  fixtureCounter += 1;
  const dir = path.join(FIXTURE_ROOT, 'artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, `f${String(fixtureCounter).padStart(3, '0')}-${label}.${ext}`);
  fs.writeFileSync(abs, bytes);
  return {
    file: path.relative(REPO_ROOT, abs).split(path.sep).join('/'),
    abs,
    bytes: bytes.length,
    sha256: sha256(bytes),
    sha1: sha1(bytes),
  };
}

function writeCaptureReceipt(artifact, attemptId, build, observation) {
  fixtureCounter += 1;
  const receipt = {
    schemaVersion: 1,
    captureId: randomUUID(),
    executionAttemptId: attemptId,
    artifactSha256: artifact.sha256,
    capturedAt: observation.timestamp,
    observationSeq: observation.seq,
    observationTimestamp: observation.timestamp,
    gitSha: build.gitSha,
    apkSha256: build.apkSha256,
    artifactFile: artifact.file,
  };
  const bytes = Buffer.from(JSON.stringify(receipt));
  const dir = path.join(FIXTURE_ROOT, 'artifacts');
  const abs = path.join(dir, `receipt-${String(fixtureCounter).padStart(3, '0')}.json`);
  fs.writeFileSync(abs, bytes);
  return {
    reference: { file: path.relative(REPO_ROOT, abs).split(path.sep).join('/'), sha256: sha256(bytes) },
    indexEntry: { file: path.relative(REPO_ROOT, abs).split(path.sep).join('/'), sha256: sha256(bytes) },
  };
}

const BUILD = () => ({
  gitSha: 'a'.repeat(40),
  apkSha256: 'b'.repeat(64),
  packageName: 'com.braintraining.app',
  versionName: '0.1.0',
  versionCode: 1000,
});
const DEVICE = () => ({
  serial: 'emulator-5554',
  model: 'Android SDK built for x86_64',
  abi: 'x86_64',
  display: '1080x1920',
  density: '420',
  renderer: 'SwiftShader',
});

/**
 * Build a run record that certifies nothing beyond `launch`+`identity`+`render`
 * — deliberately boring, so each test can perturb exactly ONE property and the
 * assertion is unambiguous about what caused the exit code.
 */
function baseRun({ attemptId = 'fixture-attempt-1', gameId = 'memory-pair-recall', build = BUILD() } = {}) {
  const observation0 = { seq: 0, timestamp: '2026-10-22T00:00:10.000Z', controls: ['intro', 'start'] };
  const observation1 = { seq: 1, timestamp: '2026-10-22T00:00:20.000Z', controls: ['intro', 'start'] };
  const png = writeArtifact('launch', PNG_1X1, 'png');
  const xml = writeArtifact('launch', HIERARCHY_XML(gameId, observation1.controls), 'xml');
  const pngReceipt = writeCaptureReceipt(png, attemptId, build, observation0);
  const xmlReceipt = writeCaptureReceipt(xml, attemptId, build, observation1);
  const common = { kind: 'screenshot', executionAttemptId: attemptId };
  return {
    run: {
      executionAttemptId: attemptId,
      evidenceSource: 'runtime',
      knownGameId: true,
      gameId,
      hasTutorial: true,
      buildIdentity: build,
      deviceProfile: DEVICE(),
      startedAt: '2026-10-22T00:00:00.000Z',
      endedAt: '2026-10-22T00:01:00.000Z',
      events: [],
      observations: [
        {
          seq: 0,
          phase: 'launch',
          timestamp: observation0.timestamp,
          controls: observation0.controls,
          screenMarkers: [],
          screenKind: 'game-screen',
          observedGameId: gameId,
          requireArtifact: true,
          evidenceArtifact: { ...common, file: png.file, bytes: png.bytes, sha256: png.sha256, captureReceipt: pngReceipt.reference },
        },
        {
          seq: 1,
          phase: 'terminal',
          timestamp: observation1.timestamp,
          controls: observation1.controls,
          screenMarkers: [],
          screenKind: 'game-screen',
          observedGameId: gameId,
          rawScreen: {
            expectedPackage: build.packageName,
            focusPackage: `${build.packageName}/${build.packageName}.MainActivity`,
            hierarchyStatus: 'ok', appAlive: true, controlCount: observation1.controls.length,
          },
          requireArtifact: true,
          evidenceArtifact: {
            kind: 'hierarchy', executionAttemptId: attemptId,
            file: xml.file, bytes: xml.bytes, sha256: xml.sha256, captureReceipt: xmlReceipt.reference,
          },
        },
      ],
      artifacts: [],
    },
    png,
    xml,
  };
}

/** Write a ledger document to disk and return its absolute path. */
function writeLedger(runs, name = 'ledger') {
  fixtureCounter += 1;
  const dir = path.join(FIXTURE_ROOT, 'ledgers');
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, `${name}-${fixtureCounter}.json`);
  fs.writeFileSync(abs, JSON.stringify({ runs }, null, 2));
  const receiptEntries = new Map();
  for (const run of runs) {
    if (!run || typeof run !== 'object') continue;
    for (const observation of Array.isArray(run.observations) ? run.observations : []) {
      const receipt = observation?.evidenceArtifact?.captureReceipt;
      if (receipt?.file && receipt?.sha256) receiptEntries.set(receipt.file.toLowerCase(), { file: receipt.file, sha256: receipt.sha256 });
    }
    for (const observation of Array.isArray(run.observations) ? run.observations : []) {
      const receipt = observation?.hierarchyArtifact?.captureReceipt;
      if (receipt?.file && receipt?.sha256) receiptEntries.set(receipt.file.toLowerCase(), { file: receipt.file, sha256: receipt.sha256 });
    }
    for (const artifact of [...(Array.isArray(run.artifacts) ? run.artifacts : []), run.tutorialStateArtifact]) {
      const receipt = artifact?.captureReceipt;
      if (receipt?.file && receipt?.sha256) receiptEntries.set(receipt.file.toLowerCase(), { file: receipt.file, sha256: receipt.sha256 });
    }
  }
  const indexPath = path.join(dir, `${name}-${fixtureCounter}-capture-index.json`);
  fs.writeFileSync(indexPath, JSON.stringify({ schemaVersion: 1, receipts: [...receiptEntries.values()] }, null, 2));
  captureIndexByLedger.set(abs, indexPath);
  return abs;
}

/** Run the real CLI and capture its real exit status. */
function attachTutorialState(run, row, timestamp = '2026-10-22T00:00:30.000Z') {
  const observation = { seq: 2, timestamp, controls: [], screenMarkers: [], phase: 'tutorial-state' };
  run.observations.push(observation);
  const completed = row?.completed === 1;
  const replayRequested = row?.replay_requested === 1;
  const version = row?.version ?? null;
  run.tutorialState = {
    gameId: run.gameId, previouslyCompleted: completed && !replayRequested && version === '1.0.0',
    completed, replayRequested, version, source: 'tutorial_state',
  };
  const snapshot = {
    schemaVersion: 1, source: 'sqlite-query',
    query: 'SELECT completed, replay_requested, version FROM tutorial_state WHERE game_id = ?',
    parameters: [run.gameId], gameId: run.gameId, completed, row,
  };
  const artifact = writeArtifact('tutorial-state', Buffer.from(JSON.stringify(snapshot)), 'json');
  const receipt = writeCaptureReceipt(artifact, run.executionAttemptId, run.buildIdentity, observation);
  run.tutorialStateArtifact = {
    kind: 'tutorial-state', executionAttemptId: run.executionAttemptId,
    file: artifact.file, bytes: artifact.bytes, sha256: artifact.sha256,
    captureReceipt: receipt.reference,
  };
  return run.tutorialStateArtifact;
}

function runCli(args, { expectedIdentity = true, captureIndex = true } = {}) {
  const ledger = args.find((arg) => !String(arg).startsWith('-'));
  const effectiveArgs = [...args];
  if (captureIndex && ledger && !effectiveArgs.includes('--capture-receipts')) {
    const indexPath = captureIndexByLedger.get(path.resolve(ledger));
    if (indexPath) effectiveArgs.push('--capture-receipts', indexPath);
  }
  if (expectedIdentity && !effectiveArgs.includes('--expected-git-sha')) effectiveArgs.push('--expected-git-sha', BUILD().gitSha);
  if (expectedIdentity && !effectiveArgs.includes('--expected-apk-sha256')) effectiveArgs.push('--expected-apk-sha256', BUILD().apkSha256);
  const res = spawnSync(process.execPath, [CLI, ...effectiveArgs], {
    cwd: REPO_ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000,
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

test.after(() => {
  // Fixtures are git-ignored, but tidy up so repeated runs cannot accumulate.
  try { fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ===========================================================================
// 1-4. LOCAL MODE EXIT SEMANTICS — the F-080-NEW-001 defect
// ===========================================================================

test('CLI 1: local PASS exits 0', () => {
  const { run } = baseRun();
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.equal(res.status, 0, `expected exit 0, got ${res.status}\n${res.stdout}${res.stderr}`);
  assert.match(res.stdout, /verdict=PASS/);
});

test('CLI 2: local FAIL (hash mismatch) exits nonzero', () => {
  const { run, png } = baseRun();
  // Corrupt the file AFTER the ledger recorded its digest: the classic
  // "evidence was edited after capture" shape.
  fs.writeFileSync(png.abs, Buffer.concat([PNG_1X1, Buffer.from('tampered')]));
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.notEqual(res.status, 0, 'a hash mismatch must not exit 0');
  assert.match(res.stdout, /verdict=FAIL/);
});

test('CLI 3: local BLOCKED (missing mandatory artifact) exits nonzero — F-080-NEW-001 regression', () => {
  const { run, png } = baseRun();
  // Delete the mandatory artifact. The ledger still claims it. Local mode cannot
  // verify it, so the verdict is BLOCKED — which the defective expression
  // turned into exit 0.
  fs.rmSync(png.abs);
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /verdict=BLOCKED/);
  assert.notEqual(res.status, 0, 'BLOCKED local verification must never exit 0');
});

test('CLI 4: local BLOCKED with --strict exits nonzero', () => {
  const { run, png } = baseRun();
  fs.rmSync(png.abs);
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local', '--strict']);
  assert.match(res.stdout, /verdict=BLOCKED/);
  assert.notEqual(res.status, 0);
});

// ===========================================================================
// 5-6. PORTABLE MODE
// ===========================================================================

test('CLI 5: portable NOT_VERIFIABLE is an explicit non-PASS with nonzero exit', () => {
  const { run, png } = baseRun();
  fs.rmSync(png.abs);
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'portable']);
  // Portable mode must not report FAIL for evidence a fresh checkout legitimately
  // does not carry — but it must not report success either.
  assert.match(res.stdout, /verdict=NOT_VERIFIABLE/);
  assert.doesNotMatch(res.stdout, /verdict=FAIL/);
  assert.notEqual(res.status, 0, 'NOT_VERIFIABLE must never exit 0');
});

test('CLI 6: portable NOT_VERIFIABLE with --strict exits nonzero', () => {
  const { run, png } = baseRun();
  fs.rmSync(png.abs);
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'portable', '--strict']);
  assert.match(res.stdout, /verdict=NOT_VERIFIABLE/);
  assert.notEqual(res.status, 0);
});

test('CLI 6b: portable PASS when all evidence is present', () => {
  const { run } = baseRun();
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'portable']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /verdict=PASS/);
});

// ===========================================================================
// 7-12. INDIVIDUAL INTEGRITY FAILURE MODES
// ===========================================================================

test('CLI 7: hash mismatch exits nonzero', () => {
  const { run } = baseRun();
  run.observations[1].evidenceArtifact.sha256 = 'f'.repeat(64);
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /artifact-hash-mismatch/);
  assert.notEqual(res.status, 0);
});

test('CLI 7b: recorded byte length mismatch exits nonzero', () => {
  const { run } = baseRun();
  run.observations[1].evidenceArtifact.bytes = 1; // real file is larger
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /byte length mismatch/);
  assert.notEqual(res.status, 0);
});

test('CLI 7c: legacy SHA-1 mismatch exits nonzero', () => {
  const { run } = baseRun();
  const art = run.observations[1].evidenceArtifact;
  delete art.sha256;
  art.sha1 = 'e'.repeat(40);
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /sha1 mismatch/);
  assert.notEqual(res.status, 0);
});

test('CLI 8: missing mandatory SCREENSHOT does not certify', () => {
  const { run } = baseRun();
  // Drop the screenshot binding but keep the hierarchy: the run still parses,
  // yet `launch` can no longer be backed by a screenshot.
  run.observations[0].evidenceArtifact = null;
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local', '--strict']);
  assert.notEqual(res.status, 0);
  assert.doesNotMatch(res.stdout, /verdict=PASS/);
});

test('CLI 9: missing mandatory HIERARCHY does not certify a certified capability', () => {
  const { run } = baseRun();
  // Keep only screenshot artifacts: `launch` is still VERIFIED by the contract
  // (controls parsed) but no verified hierarchy backs it.
  const png2 = writeArtifact('launch-2', PNG_1X1, 'png');
  run.observations[1].evidenceArtifact = {
    kind: 'screenshot', executionAttemptId: run.executionAttemptId,
    file: png2.file, bytes: png2.bytes, sha256: png2.sha256,
  };
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /capability-artifact-missing/);
  assert.notEqual(res.status, 0);
});

test('CLI 10: unreadable artifact exits nonzero', () => {
  const { run } = baseRun();
  // Point the binding at a DIRECTORY: readFileSync fails with EISDIR, which is a
  // portable stand-in for "present but unreadable" (chmod is a no-op on Windows).
  const dir = path.join(FIXTURE_ROOT, 'artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const absDir = path.join(dir, 'unreadable-as-directory');
  fs.mkdirSync(absDir, { recursive: true });
  run.observations[1].evidenceArtifact = {
    kind: 'hierarchy', executionAttemptId: run.executionAttemptId,
    file: path.relative(REPO_ROOT, absDir).split(path.sep).join('/'),
    sha256: 'd'.repeat(64), bytes: 10,
  };
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /artifact-unreadable/);
  assert.notEqual(res.status, 0);
});

test('CLI 11: missing build identity exits nonzero (cannot certify a build)', () => {
  const { run } = baseRun();
  delete run.buildIdentity.apkSha256;
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /incomplete-build-identity|missing-build-provenance/);
  assert.notEqual(res.status, 0);
});

test('CLI 11b: missing source SHA alone still cannot certify', () => {
  const { run } = baseRun();
  delete run.buildIdentity.gitSha;
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.notEqual(res.status, 0);
});

test('CLI 12: corrupt ledger is a usage/malformed-input error (exit 2)', () => {
  const dir = path.join(FIXTURE_ROOT, 'ledgers');
  fs.mkdirSync(dir, { recursive: true });
  const bad = path.join(dir, 'corrupt.json');
  fs.writeFileSync(bad, '{"runs": [ this is not json ]');
  const res = runCli([bad, '--mode', 'local']);
  assert.equal(res.status, 2, 'a corrupt ledger is malformed input, not a verdict');
});

test('CLI 12b: a ledger with no runs array is malformed input (exit 2)', () => {
  const dir = path.join(FIXTURE_ROOT, 'ledgers');
  fs.mkdirSync(dir, { recursive: true });
  const bad = path.join(dir, 'wrong-shape.json');
  fs.writeFileSync(bad, JSON.stringify({ games: [] }));
  const res = runCli([bad, '--mode', 'local']);
  assert.equal(res.status, 2);
});

test('CLI 12c: unknown option and bad mode are usage errors (exit 2)', () => {
  const { run } = baseRun();
  const ledger = writeLedger([run]);
  assert.equal(runCli([ledger, '--nonsense']).status, 2);
  assert.equal(runCli([ledger, '--mode', 'imaginary']).status, 2);
  assert.equal(runCli([ledger, '--build-scope', 'imaginary']).status, 2);
  assert.equal(runCli([]).status, 2);
});

test('CLI 12d: an absent ledger path is malformed input (exit 2)', () => {
  const res = runCli([path.join(FIXTURE_ROOT, 'does-not-exist.json'), '--mode', 'local']);
  assert.equal(res.status, 2);
});

test('CLI 12e: null top-level JSON is malformed input, not an uncaught property access', () => {
  const dir = path.join(FIXTURE_ROOT, 'ledgers');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'null-top-level.json');
  fs.writeFileSync(file, 'null');
  const res = runCli([file]);
  assert.equal(res.status, 2);
  assert.match(res.stderr, /malformed ledger/);
});

// ===========================================================================
// 13. THE HISTORICAL DEFECT, PINNED
// ===========================================================================

test('CLI 13: the historical exit expression is pinned as a regression', () => {
  // The expression that shipped (verbatim) and produced a fail-open exit:
  //   const failNow = verdict === 'FAIL' ||
  //     (strict && mandatoryProblems === 0 && verdict !== 'PASS');
  //
  // With a missing mandatory artifact the verdict is BLOCKED but
  // mandatoryProblems is POSITIVE, so `failNow` is false for both strict and
  // non-strict — exit 0. This test states that defect explicitly and proves the
  // replacement disagrees with it in exactly the dangerous case.
  const historicalFailNow = (verdict, strict, mandatoryProblems) =>
    verdict === 'FAIL' || (strict && mandatoryProblems === 0 && verdict !== 'PASS');

  // The dangerous case: BLOCKED because mandatory evidence is MISSING (so
  // mandatoryProblems > 0).
  assert.equal(historicalFailNow('BLOCKED', true, 3), false, 'historical expression really did say "do not fail"');
  assert.equal(historicalFailNow('BLOCKED', false, 3), false);

  // The replacement must fail closed on the same state.
  assert.equal(deriveVerificationExitCode('BLOCKED', { strict: true }), 1);
  assert.equal(deriveVerificationExitCode('BLOCKED', { strict: false }), 1);
  assert.equal(deriveVerificationExitCode(VerificationVerdict.NOT_VERIFIABLE, { strict: true }), 1);
  assert.equal(deriveVerificationExitCode(VerificationVerdict.NOT_VERIFIABLE, { strict: false }), 1);
  assert.equal(deriveVerificationExitCode(VerificationVerdict.NO_EVIDENCE, {}), 1);
  // Unknown/undefined/absent verdicts fail closed rather than falling through.
  assert.equal(deriveVerificationExitCode(undefined, {}), 1);
  assert.equal(deriveVerificationExitCode('', {}), 1);
  assert.equal(deriveVerificationExitCode('SOMETHING_ELSE', {}), 1);
  // Only a genuine PASS is success.
  assert.equal(deriveVerificationExitCode('PASS', {}), 0);
  assert.equal(deriveVerificationExitCode('PASS', { strict: true }), 0);
  assert.equal(deriveVerificationExitCode(' pass ', {}), 0, 'verdict compare is case/space tolerant');
});

test('CLI 13b: an empty ledger cannot exit 0', () => {
  const ledger = writeLedger([]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /verdict=NO_EVIDENCE/);
  assert.notEqual(res.status, 0);
});

// ===========================================================================
// 14-17. MIXED-BUILD SEMANTICS (F-080-NEW-002)
// ===========================================================================

test('CLI 14: single-build certification refuses mixed builds even with perfect hashes', () => {
  const a = baseRun({ attemptId: 'attempt-build-a' }).run;
  const b = baseRun({
    attemptId: 'attempt-build-b',
    build: { ...BUILD(), apkSha256: 'c'.repeat(64) },
  }).run;
  const ledger = writeLedger([a, b]);
  const res = runCli([ledger, '--mode', 'local', '--build-scope', 'single']);
  assert.match(res.stdout, /verdict=FAIL/);
  assert.match(res.stdout, /mixed-build-single-scope/);
  assert.notEqual(res.status, 0, 'mixed-build evidence must not pass single-build certification');
});

test('CLI 14b: same build, multiple attempts certifies normally', () => {
  const a = baseRun({ attemptId: 'attempt-a1' }).run;
  const b = baseRun({ attemptId: 'attempt-a2' }).run;
  const ledger = writeLedger([a, b]);
  const res = runCli([ledger, '--mode', 'local', '--build-scope', 'single']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /builds=1/);
});

test('CLI 14c: same source SHA but a different APK hash is rejected from single-build certification', () => {
  const a = baseRun({ attemptId: 'attempt-same-sha-1' }).run;
  const b = baseRun({ attemptId: 'attempt-same-sha-2', build: { ...BUILD(), apkSha256: 'c'.repeat(64) } }).run;
  // Identical gitSha, different APK => two builds, not one.
  assert.equal(a.buildIdentity.gitSha, b.buildIdentity.gitSha);
  const ledger = writeLedger([a, b]);
  const res = runCli([ledger, '--mode', 'local', '--build-scope', 'single']);
  assert.notEqual(res.status, 0);
  assert.match(res.stdout, /mixed-build-single-scope/);
});

test('CLI 14d: different source SHAs are rejected from single-build certification', () => {
  const a = baseRun({ attemptId: 'attempt-rev-1' }).run;
  const b = baseRun({ attemptId: 'attempt-rev-2', build: { ...BUILD(), gitSha: 'd'.repeat(40) } }).run;
  const ledger = writeLedger([a, b]);
  const res = runCli([ledger, '--mode', 'local', '--build-scope', 'single']);
  assert.notEqual(res.status, 0);
});

test('CLI 14e: missing APK hash cannot certify at all', () => {
  const a = baseRun({ attemptId: 'attempt-no-apk' }).run;
  delete a.buildIdentity.apkSha256;
  const ledger = writeLedger([a]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.notEqual(res.status, 0);
});

test('CLI 15: archive scope partitions mixed builds and states its honest limits', () => {
  const a = baseRun({ attemptId: 'attempt-arch-a' }).run;
  const b = baseRun({ attemptId: 'attempt-arch-b', build: { ...BUILD(), apkSha256: 'c'.repeat(64) } }).run;
  const ledger = writeLedger([a, b]);
  const res = runCli([ledger, '--mode', 'local', '--build-scope', 'archive']);
  assert.match(res.stdout, /buildScope=archive/);
  assert.match(res.stdout, /builds=2/);
  assert.match(res.stdout, /build-partition/);
  // An archive result must never read as "this is the current revision".
  assert.match(res.stdout, /does NOT describe the current application revision/);
  assert.equal(res.status, 0, res.stdout + res.stderr);
});

test('CLI 15b: archive scope still fails a genuine hash mismatch', () => {
  const a = baseRun({ attemptId: 'attempt-arch-m1' }).run;
  const b = baseRun({ attemptId: 'attempt-arch-m2', build: { ...BUILD(), apkSha256: 'c'.repeat(64) } }).run;
  b.observations[1].evidenceArtifact.sha256 = 'f'.repeat(64);
  const ledger = writeLedger([a, b]);
  const res = runCli([ledger, '--mode', 'local', '--build-scope', 'archive']);
  assert.equal(res.status, 1);
});

test('CLI 15c: archive scope refuses runs whose build identity cannot be established', () => {
  const a = baseRun({ attemptId: 'attempt-arch-ok' }).run;
  const b = baseRun({ attemptId: 'attempt-arch-broken' }).run;
  delete b.buildIdentity.packageName;
  const ledger = writeLedger([a, b]);
  const res = runCli([ledger, '--mode', 'local', '--build-scope', 'archive']);
  assert.notEqual(res.status, 0, 'an unpartitionable run may not be filed under "archive verified"');
});

test('CLI 16: evidence cited by a second attempt is rejected as reuse', () => {
  const a = baseRun({ attemptId: 'attempt-reuse-source' });
  // A second attempt re-cites the FIRST attempt's screenshot file.
  const b = baseRun({ attemptId: 'attempt-reuse-thief' });
  b.run.observations[0].evidenceArtifact = {
    kind: 'screenshot', executionAttemptId: 'attempt-reuse-thief',
    file: a.png.file, bytes: a.png.bytes, sha256: a.png.sha256,
  };
  const ledger = writeLedger([a.run, b.run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /artifact-reused-across-attempts/);
  assert.notEqual(res.status, 0);
});

test('CLI 16b: an artifact bound to a different execution attempt is rejected', () => {
  const { run } = baseRun({ attemptId: 'attempt-owner' });
  run.observations[1].evidenceArtifact.executionAttemptId = 'attempt-somebody-else';
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /artifact belongs to a different execution attempt|artifact-wrong-attempt/);
  assert.notEqual(res.status, 0);
});

test('CLI 17: duplicate execution-attempt ids never certify', () => {
  const a = baseRun({ attemptId: 'attempt-duplicated' }).run;
  const b = baseRun({ attemptId: 'attempt-duplicated' }).run;
  const ledger = writeLedger([a, b]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /duplicate-attempt-id/);
  assert.notEqual(res.status, 0);
});

// ===========================================================================
// 18-20. PATH SAFETY AND CONTENT SHAPE
// ===========================================================================

test('CLI 18: a path escaping the repository is rejected, never read', () => {
  const outside = path.join(path.dirname(REPO_ROOT), 'brain-training-outside-secret.txt');
  fs.writeFileSync(outside, 'outside-evidence');
  try {
    const { run } = baseRun();
    const relEscape = path.relative(REPO_ROOT, outside).split(path.sep).join('/');
    assert.ok(relEscape.startsWith('..'), 'fixture must actually escape the repo');
    run.observations[1].evidenceArtifact.file = relEscape;
    run.observations[1].evidenceArtifact.sha256 = sha256(Buffer.from('outside-evidence'));
    const ledger = writeLedger([run]);
    const res = runCli([ledger, '--mode', 'local']);
    assert.match(res.stdout, /unsafe-artifact-path/);
    assert.notEqual(res.status, 0);
  } finally {
    fs.rmSync(outside, { force: true });
  }
});

test('CLI 18b: absolute artifact paths are rejected', () => {
  const { run, png } = baseRun();
  run.observations[1].evidenceArtifact.file = png.abs; // absolute
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /unsafe-artifact-path/);
  assert.notEqual(res.status, 0);
});

test('CLI 19: a screenshot filename is not evidence of a screenshot', () => {
  const { run } = baseRun();
  // Correct digest, correct extension, WRONG content: not a PNG.
  const fake = writeArtifact('launch-fake', Buffer.from('this is not a png at all'), 'png');
  run.observations[0].evidenceArtifact = {
    kind: 'screenshot', executionAttemptId: run.executionAttemptId,
    file: fake.file, bytes: fake.bytes, sha256: fake.sha256,
  };
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /artifact-content-invalid/);
  assert.notEqual(res.status, 0);
});

test('CLI 19b: a hierarchy artifact must actually be a hierarchy document', () => {
  const { run } = baseRun();
  const fake = writeArtifact('launch-fake-xml', Buffer.from('<html><body>nope</body></html>'), 'xml');
  run.observations[1].evidenceArtifact = {
    kind: 'hierarchy', executionAttemptId: run.executionAttemptId,
    file: fake.file, bytes: fake.bytes, sha256: fake.sha256,
  };
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.match(res.stdout, /artifact-content-invalid/);
  assert.notEqual(res.status, 0);
});

test('CLI 19c: truncated hierarchy XML and signature-only PNG fail real parsing', () => {
  assert.equal(sniffHierarchy(HIERARCHY_XML('valid')).ok, true);
  assert.equal(sniffHierarchy(Buffer.from('<hierarchy><node')).ok, false);
  assert.equal(sniffScreenshot(PNG_1X1).ok, true);
  assert.equal(sniffScreenshot(Buffer.from('89504e470d0a1a0a', 'hex')).ok, false);
});

test('CLI 20: externally expected build identity is mandatory for native-current PASS', () => {
  const { run } = baseRun();
  const ledger = writeLedger([run]);
  const missing = runCli([ledger, '--mode', 'local'], { expectedIdentity: false });
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /current-build-identity-missing/);
  const mismatch = runCli([ledger, '--mode', 'local', '--expected-git-sha', 'c'.repeat(40)]);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stdout, /unexpected-current-build/);
});

test('CLI 20b: external capture-receipts index is mandatory for native verification', () => {
  const { run } = baseRun();
  const ledger = writeLedger([run]);
  const res = runCli([ledger, '--mode', 'local'], { captureIndex: false });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /capture-receipt-index-missing/);
});

test('CLI 20c: case-aliased Windows paths use canonical ownership and cannot be reused', () => {
  const a = baseRun({ attemptId: 'case-owner' });
  const b = baseRun({ attemptId: 'case-alias' });
  b.run.observations[0].evidenceArtifact.file = a.png.file.toUpperCase();
  assert.equal(
    resolveArtifactPath(a.png.file, REPO_ROOT).ownershipKey,
    resolveArtifactPath(a.png.file.toUpperCase(), REPO_ROOT).ownershipKey,
  );
  const ledger = writeLedger([a.run, b.run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /artifact-reused-across-attempts/);
});

test('CLI 20d: identical independent frames pass only with unique capture receipts', () => {
  const a = baseRun({ attemptId: 'identical-frame-a' });
  const b = baseRun({ attemptId: 'identical-frame-b' });
  assert.equal(a.png.sha256, b.png.sha256);
  assert.notEqual(a.run.observations[0].evidenceArtifact.captureReceipt.file, b.run.observations[0].evidenceArtifact.captureReceipt.file);
  const ledger = writeLedger([a.run, b.run]);
  const res = runCli([ledger, '--mode', 'local']);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /verdict=PASS/);
});

test('CLI 20e: null, unknown-game, malformed, and evidence-empty runs never pass', () => {
  const missingControls = baseRun({ attemptId: 'missing-controls' }).run;
  missingControls.observations = missingControls.observations.map((observation) => {
    const copy = { ...observation };
    delete copy.controls;
    return copy;
  });
  for (const [label, record] of [
    ['null', null],
    ['unknown-game', { ...baseRun({ attemptId: 'unknown-game' }).run, gameId: 'made-up-game' }],
    ['malformed', { ...baseRun({ attemptId: 'malformed-run' }).run, events: {} }],
    ['missing-controls', missingControls],
  ]) {
    const ledger = writeLedger([record], label);
    const res = runCli([ledger, '--mode', 'local']);
    assert.equal(res.status, 1, `${label} record must fail closed\n${res.stdout}${res.stderr}`);
    assert.doesNotMatch(res.stdout, /verdict=PASS/);
  }
  const noArtifacts = baseRun({ attemptId: 'no-meaningful-artifacts' }).run;
  noArtifacts.observations = [];
  noArtifacts.artifacts = [];
  const emptyLedger = writeLedger([noArtifacts], 'no-artifact-run');
  const empty = runCli([emptyLedger, '--mode', 'local']);
  assert.equal(empty.status, 1);
  assert.match(empty.stdout, /no-meaningful-artifact/);
});

test('CLI 20f: quarantined v1-v7 ledger is non-certifying; newer ledgers receive no exemption', () => {
  const historical = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'scripts/qa/native-coverage-ledger-v6.json'), 'utf8'))
    .runs.find((entry) => typeof entry.executionAttemptId === 'string');
  assert.ok(historical, 'historical v6 ledger has a run identity for the quarantine regression');
  const editedHistoricalCopy = structuredClone(historical);
  const artifact = editedHistoricalCopy.observations?.find((observation) => observation.evidenceArtifact)?.evidenceArtifact;
  if (artifact) artifact.captureReceipt = { file: 'new-receipt.json', sha256: 'a'.repeat(64) };
  assert.equal(isQuarantinedRun(editedHistoricalCopy), true, 'adding new receipt metadata cannot unquarantine an old attempt');

  const run = baseRun({ attemptId: 'quarantine-v7' }).run;
  const sourceLedger = writeLedger([run], 'quarantine-source');
  const ledger = path.join(FIXTURE_ROOT, 'ledgers', 'native-coverage-ledger-v7.json');
  fs.writeFileSync(ledger, fs.readFileSync(sourceLedger));
  captureIndexByLedger.set(ledger, captureIndexByLedger.get(sourceLedger));
  const quarantined = runCli([ledger, '--mode', 'local']);
  assert.equal(quarantined.status, 1);
  assert.match(quarantined.stdout, /quarantined-run/);
  const newer = writeLedger([baseRun({ attemptId: 'v8-not-trusted' }).run], 'native-coverage-ledger-v8');
  const verified = runCli([newer, '--mode', 'local']);
  assert.equal(verified.status, 0, verified.stdout + verified.stderr);
});

test('CLI 20g: exact reviewer artifact fixtures cannot pass without valid bytes and indexed receipts', () => {
  const fixture = (name) => fileURLToPath(new URL(`./test-fixtures/080-review/${name}`, import.meta.url));
  for (const name of ['valid-artifact-ledger.json', 'missing-artifact-ledger.json', 'hash-mismatch-ledger.json']) {
    const res = runCli([
      fixture(name), '--mode', 'local',
      '--expected-git-sha', 'a'.repeat(40),
      '--expected-apk-sha256', 'a'.repeat(64),
    ]);
    assert.equal(res.status, 1, `${name} must not be native-certified\n${res.stdout}${res.stderr}`);
    assert.doesNotMatch(res.stdout, /verdict=PASS/);
  }
  const original = runCli([
    fixture('valid-artifact-ledger.json'), '--mode', 'local',
    '--expected-git-sha', 'a'.repeat(40), '--expected-apk-sha256', 'a'.repeat(64),
  ]);
  assert.match(original.stdout, /not cryptographic proof of native capture/);
  assert.match(original.stdout, /invalid-run|artifact-content-invalid/);
});

test('CLI 20h: duplicate captureIds cannot establish independent per-artifact acquisitions', () => {
  const a = baseRun({ attemptId: 'duplicate-capture-a' });
  const b = baseRun({ attemptId: 'duplicate-capture-b' });
  const aReceipt = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, a.run.observations[0].evidenceArtifact.captureReceipt.file), 'utf8'));
  const bReceiptPath = path.join(REPO_ROOT, b.run.observations[0].evidenceArtifact.captureReceipt.file);
  const bReceipt = JSON.parse(fs.readFileSync(bReceiptPath, 'utf8'));
  bReceipt.captureId = aReceipt.captureId;
  const receiptBytes = Buffer.from(JSON.stringify(bReceipt));
  fs.writeFileSync(bReceiptPath, receiptBytes);
  b.run.observations[0].evidenceArtifact.captureReceipt.sha256 = sha256(receiptBytes);
  const ledger = writeLedger([a.run, b.run]);
  const result = runCli([ledger, '--mode', 'local']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /capture-receipt-index-invalid/);
  assert.match(result.stdout, /captureId .* is not unique/);
});

test('CLI 20i: copied bytes at a new path cannot reuse another attempt\'s capture receipt', () => {
  const a = baseRun({ attemptId: 'copied-source-attempt' });
  const b = baseRun({ attemptId: 'copied-target-attempt' });
  const copy = writeArtifact('cross-attempt-copy', fs.readFileSync(a.png.abs), 'png');
  b.run.observations[0].evidenceArtifact.file = copy.file;
  b.run.observations[0].evidenceArtifact.bytes = copy.bytes;
  b.run.observations[0].evidenceArtifact.sha256 = copy.sha256;
  const ledger = writeLedger([a.run, b.run]);
  const result = runCli([ledger, '--mode', 'local']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /artifact-reused-across-attempts|capture-receipt-binding-mismatch/);
});

test('CLI 20j: same-attempt receipt replay across observations fails exact sequence/time binding', () => {
  const { run } = baseRun({ attemptId: 'same-attempt-observation-replay' });
  run.observations[0].hierarchyArtifact = structuredClone(run.observations[1].evidenceArtifact);
  const ledger = writeLedger([run]);
  const result = runCli([ledger, '--mode', 'local']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /capture-receipt-observation-mismatch|capture-receipt-reused-for-distinct-observation/);
});

test('CLI 20k: identical passive frames pass when each observation has a fresh acquisition receipt', () => {
  const { run, png } = baseRun({ attemptId: 'same-attempt-fresh-identical-captures' });
  const observation = run.observations[1];
  const second = writeArtifact('same-attempt-identical-frame', fs.readFileSync(png.abs), 'png');
  const receipt = writeCaptureReceipt(second, run.executionAttemptId, run.buildIdentity, observation);
  run.artifacts.push({
    kind: 'screenshot', executionAttemptId: run.executionAttemptId,
    file: second.file, bytes: second.bytes, sha256: second.sha256, captureReceipt: receipt.reference,
  });
  assert.equal(second.sha256, png.sha256);
  const ledger = writeLedger([run]);
  const result = runCli([ledger, '--mode', 'local']);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /verdict=PASS/);
});

test('CLI 20l: returning-player tutorial completion requires matching receipt-indexed SQLite query JSON', () => {
  const { run } = baseRun({ attemptId: 'returning-tutorial-player' });
  attachTutorialState(run, { completed: 1, replay_requested: 0, version: '1.0.0' });
  const ledger = writeLedger([run]);
  const result = runCli([ledger, '--mode', 'local']);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const falseApplicability = baseRun({ attemptId: 'false-tutorial-applicability' }).run;
  falseApplicability.hasTutorial = false;
  attachTutorialState(falseApplicability, { completed: 1, replay_requested: 0, version: '1.0.0' });
  const rejected = runCli([writeLedger([falseApplicability]), '--mode', 'local']);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stdout, /hasTutorial claim false does not match authoritative metadata true/);

  const missingCapture = baseRun({ attemptId: 'unbound-returning-tutorial-player' }).run;
  missingCapture.tutorialState = { previouslyCompleted: true, completed: true, replayRequested: false, version: '1.0.0', source: 'tutorial_state' };
  const missing = runCli([writeLedger([missingCapture]), '--mode', 'local']);
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /tutorialState claim requires a bound tutorial-state JSON artifact/);

  const mismatched = baseRun({ attemptId: 'mismatched-returning-tutorial-player' }).run;
  attachTutorialState(mismatched, { completed: 0, replay_requested: 0, version: '1.0.0' });
  mismatched.tutorialState.previouslyCompleted = true;
  const mismatch = runCli([writeLedger([mismatched]), '--mode', 'local']);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stdout, /tutorialState\.previouslyCompleted does not match the captured SQLite row/);
});

test('CLI 20m: coercible but non-ISO receipt/event timestamps fail closed', () => {
  const { run } = baseRun({ attemptId: 'non-iso-capture-time' });
  const reference = run.observations[0].evidenceArtifact.captureReceipt;
  const receiptFile = path.join(REPO_ROOT, ...reference.file.split('/'));
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  receipt.capturedAt = 'Fri, 23 Oct 2026 00:00:10 GMT';
  const bytes = Buffer.from(JSON.stringify(receipt));
  fs.writeFileSync(receiptFile, bytes);
  reference.sha256 = sha256(bytes);
  const ledger = writeLedger([run]);
  const result = runCli([ledger, '--mode', 'local']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /capture-receipt-index-invalid/);

  const badEvent = baseRun({ attemptId: 'non-iso-event-time' }).run;
  badEvent.events.push({ seq: 0, action: 'wait', actionRequested: true, actionExecuted: true,
    actionAcknowledged: null, executionAttemptId: badEvent.executionAttemptId,
    timestamp: 'Fri, 23 Oct 2026 00:00:10 GMT' });
  const badEventResult = runCli([writeLedger([badEvent]), '--mode', 'local']);
  assert.equal(badEventResult.status, 1);
  assert.match(badEventResult.stdout, /events\[0\]\.timestamp must be an ISO-8601\/RFC-3339 timestamp/);

  const stale = baseRun({ attemptId: 'iso-but-stale-observation-time' }).run;
  const staleReference = stale.observations[0].evidenceArtifact.captureReceipt;
  const staleReceiptPath = path.join(REPO_ROOT, ...staleReference.file.split('/'));
  const staleReceipt = JSON.parse(fs.readFileSync(staleReceiptPath, 'utf8'));
  staleReceipt.capturedAt = '2020-01-01T00:00:00.000Z';
  staleReceipt.observationTimestamp = '2020-01-01T00:00:00.000Z';
  const staleBytes = Buffer.from(JSON.stringify(staleReceipt));
  fs.writeFileSync(staleReceiptPath, staleBytes);
  staleReference.sha256 = sha256(staleBytes);
  const staleResult = runCli([writeLedger([stale]), '--mode', 'local']);
  assert.equal(staleResult.status, 1);
  assert.match(staleResult.stdout, /capture-receipt-observation-mismatch/);
});

// ===========================================================================
// 21-24. PURE UNIT CONTROLS (the module, independent of the CLI)
// ===========================================================================

test('UNIT: resolveArtifactPath refuses every escape shape', () => {
  assert.equal(resolveArtifactPath('../x', REPO_ROOT).ok, false);
  assert.equal(resolveArtifactPath('a/../../x', REPO_ROOT).ok, false);
  assert.equal(resolveArtifactPath('/etc/passwd', REPO_ROOT).ok, false);
  assert.equal(resolveArtifactPath('C:/Windows/win.ini', REPO_ROOT).ok, false);
  assert.equal(resolveArtifactPath('\\\\server\\share\\x', REPO_ROOT).ok, false);
  assert.equal(resolveArtifactPath('qa-artifacts/a.png', REPO_ROOT).ok, true);
  assert.equal(resolveArtifactPath('', REPO_ROOT).ok, false);
  assert.equal(resolveArtifactPath(null, REPO_ROOT).ok, false);
});

test('UNIT: partitionByBuild keeps unidentifiable runs out of every partition', () => {
  const runs = [
    { executionAttemptId: 'a', buildIdentity: BUILD() },
    { executionAttemptId: 'b', buildIdentity: { ...BUILD(), apkSha256: 'c'.repeat(64) } },
    { executionAttemptId: 'c', buildIdentity: { gitSha: 'x' } },
    { executionAttemptId: 'd' },
  ];
  const { partitions, unidentifiable } = partitionByBuild(runs);
  assert.equal(partitions.size, 2);
  assert.equal(unidentifiable.length, 2);
  assert.equal(buildIdentityKey({ gitSha: 'x' }), null);
});

test('UNIT: verifyArtifactLedger verdict matrix is fail-closed', () => {
  const fixture = (attemptId = `unit-${randomUUID()}`) => {
    const { run } = baseRun({ attemptId });
    const ledger = writeLedger([run], 'unit');
    return {
      run,
      captureReceipts: captureIndexByLedger.get(ledger),
      options: {
        mode: EvidenceMode.LOCAL,
        repoRoot: REPO_ROOT,
        captureReceipts: captureIndexByLedger.get(ledger),
        expectedGitSha: BUILD().gitSha,
        expectedApkSha256: BUILD().apkSha256,
      },
    };
  };
  const failingArtifacts = (abs) => {
    if (String(abs).endsWith('.json')) return fs.readFileSync(abs);
    throw Object.assign(new Error('nope'), { code: 'ENOENT' });
  };

  const good = fixture();
  assert.equal(verifyArtifactLedger([good.run], good.options).verdict, VerificationVerdict.PASS);
  const blocked = verifyArtifactLedger([good.run], { ...good.options, readArtifactBytes: failingArtifacts });
  assert.equal(blocked.verdict, VerificationVerdict.BLOCKED);
  assert.equal(blocked.exitCode, 1);
  const portable = verifyArtifactLedger([good.run], { ...good.options, mode: EvidenceMode.PORTABLE, readArtifactBytes: failingArtifacts });
  assert.equal(portable.verdict, VerificationVerdict.NOT_VERIFIABLE);
  const source = verifyArtifactLedger([good.run], { ...good.options, mode: EvidenceMode.SOURCE, readArtifactBytes: failingArtifacts });
  assert.equal(source.certifiesNativeEvidence, false);
  const sourcePass = verifyArtifactLedger([good.run], { ...good.options, mode: EvidenceMode.SOURCE });
  assert.equal(sourcePass.verdict, VerificationVerdict.PASS);
  assert.equal(sourcePass.certifiesNativeEvidence, false);
  assert.equal(verifyArtifactLedger([], { mode: EvidenceMode.LOCAL }).verdict, VerificationVerdict.NO_EVIDENCE);
  assert.equal(verifyArtifactLedger(null, { mode: EvidenceMode.LOCAL }).verdict, VerificationVerdict.FAIL);

  const a = fixture('unit-mixed-a');
  const b = fixture('unit-mixed-b');
  b.run.buildIdentity = { ...BUILD(), versionCode: 1001 };
  const ledger = writeLedger([a.run, b.run], 'unit-mixed');
  const mixedOptions = {
    mode: EvidenceMode.LOCAL,
    repoRoot: REPO_ROOT,
    captureReceipts: captureIndexByLedger.get(ledger),
    expectedGitSha: BUILD().gitSha,
    expectedApkSha256: BUILD().apkSha256,
  };
  assert.equal(verifyArtifactLedger([a.run, b.run], mixedOptions).verdict, VerificationVerdict.FAIL);
  const archive = verifyArtifactLedger([a.run, b.run], { ...mixedOptions, buildScope: BuildScope.ARCHIVE });
  assert.equal(archive.verdict, VerificationVerdict.PASS);
  assert.equal(archive.certifiesNativeEvidence, false);
  assert.match(archive.scope, /does NOT describe the current application revision/);

  const noHierarchy = fixture('unit-no-hierarchy');
  noHierarchy.run.observations = [noHierarchy.run.observations[0]];
  const noHierarchyLedger = writeLedger([noHierarchy.run], 'unit-no-hierarchy');
  const missingHier = verifyArtifactLedger([noHierarchy.run], {
    ...noHierarchy.options,
    captureReceipts: captureIndexByLedger.get(noHierarchyLedger),
  });
  assert.equal(missingHier.verdict, VerificationVerdict.FAIL);
  assert.ok(missingHier.findings.some((f) => f.kind === 'capability-artifact-missing'));
});

test('UNIT: strict cannot turn a non-PASS verdict into success', () => {
  const verdicts = Object.values(VerificationVerdict).filter((v) => v !== VerificationVerdict.PASS);
  for (const v of verdicts) {
    assert.equal(deriveVerificationExitCode(v, { strict: false }), 1, `${v} non-strict`);
    assert.equal(deriveVerificationExitCode(v, { strict: true }), 1, `${v} strict`);
  }
});
