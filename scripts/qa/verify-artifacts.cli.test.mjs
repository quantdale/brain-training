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
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BuildScope,
  EvidenceMode,
  VerificationVerdict,
  buildIdentityKey,
  deriveVerificationExitCode,
  partitionByBuild,
  resolveArtifactPath,
  verifyArtifactLedger,
} from './artifact-integrity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CLI = path.join(HERE, 'verify-artifacts.mjs');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'qa-artifacts', '080', 'verify-fixtures');

// A genuine 1x1 PNG. Content shape matters: the verifier sniffs screenshots, so
// a file merely NAMED `.png` must not be accepted.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);
const HIERARCHY_XML = (label) => Buffer.from(
  `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">`
  + `<node index="0" text="${label}" resource-id="${label}" class="android.widget.TextView" `
  + `package="com.braintraining.app" content-desc="" bounds="[0,0][1080,120]" /></hierarchy>`,
  'utf8',
);

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');

let fixtureCounter = 0;
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
  const png = writeArtifact('launch', PNG_1X1, 'png');
  const xml = writeArtifact('launch', HIERARCHY_XML('launch'), 'xml');
  const common = { kind: 'screenshot', executionAttemptId: attemptId };
  return {
    run: {
      executionAttemptId: attemptId,
      evidenceSource: 'runtime',
      knownGameId: true,
      gameId,
      buildIdentity: build,
      deviceProfile: DEVICE(),
      startedAt: '2026-10-22T00:00:00.000Z',
      endedAt: '2026-10-22T00:01:00.000Z',
      events: [],
      observations: [
        {
          seq: 0,
          phase: 'launch',
          timestamp: '2026-10-22T00:00:10.000Z',
          controls: ['intro', 'start'],
          screenMarkers: [],
          screenKind: 'game-screen',
          observedGameId: gameId,
          requireArtifact: true,
          evidenceArtifact: { ...common, file: png.file, bytes: png.bytes, sha256: png.sha256 },
        },
        {
          seq: 1,
          phase: 'terminal',
          timestamp: '2026-10-22T00:00:20.000Z',
          controls: ['intro', 'start'],
          screenMarkers: [],
          screenKind: 'game-screen',
          observedGameId: gameId,
          requireArtifact: true,
          evidenceArtifact: {
            kind: 'hierarchy', executionAttemptId: attemptId,
            file: xml.file, bytes: xml.bytes, sha256: xml.sha256,
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
  return abs;
}

/** Run the real CLI and capture its real exit status. */
function runCli(args) {
  const res = spawnSync(process.execPath, [CLI, ...args], {
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
  assert.match(res.stdout, /artifact-wrong-attempt/);
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
  // Each attempt must own its OWN artifact path and binding: the verifier
  // rejects a file or an attempt binding shared by two attempts (correctly), so
  // a fixture that shared them would be testing the reuse guard, not the
  // verdict matrix. A `launch` certification additionally requires BOTH a
  // screenshot and a hierarchy artifact, so both are supplied per attempt.
  const art = (attemptId, over = {}) => ({
    file: `qa-artifacts/${attemptId}.png`, kind: 'screenshot',
    sha256: sha256(PNG_1X1), bytes: PNG_1X1.length,
    executionAttemptId: attemptId, ...over,
  });
  const xmlArt = (attemptId) => ({
    file: `qa-artifacts/${attemptId}.xml`, kind: 'hierarchy',
    sha256: sha256(HIERARCHY_XML('x')), bytes: HIERARCHY_XML('x').length,
    executionAttemptId: attemptId,
  });
  const readAny = (abs) => (String(abs).endsWith('.xml') ? HIERARCHY_XML('x') : PNG_1X1);
  const run = (over = {}) => {
    const attemptId = over.executionAttemptId || 'a1';
    return {
      executionAttemptId: attemptId, gameId: 'g', buildIdentity: BUILD(), deviceProfile: DEVICE(),
      events: [],
      observations: [
        { seq: 0, phase: 'launch', timestamp: 't', controls: ['intro'], screenKind: 'game-screen', observedGameId: 'g', requireArtifact: true, evidenceArtifact: art(attemptId) },
        { seq: 1, phase: 'launch', timestamp: 't', controls: ['intro'], screenKind: 'game-screen', observedGameId: 'g', requireArtifact: true, evidenceArtifact: xmlArt(attemptId) },
      ],
      artifacts: [], ...over,
    };
  };

  const failing = () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }); };

  // PASS requires everything present and correct.
  assert.equal(verifyArtifactLedger([run()], { mode: EvidenceMode.LOCAL, readArtifactBytes: readAny }).verdict, VerificationVerdict.PASS);
  // Absent evidence in local mode -> BLOCKED (never PASS, never silently 0).
  const blocked = verifyArtifactLedger([run()], { mode: EvidenceMode.LOCAL, readArtifactBytes: failing });
  assert.equal(blocked.verdict, VerificationVerdict.BLOCKED);
  assert.equal(blocked.exitCode, 1);
  // Absent evidence in portable mode -> NOT_VERIFIABLE.
  assert.equal(verifyArtifactLedger([run()], { mode: EvidenceMode.PORTABLE, readArtifactBytes: failing }).verdict, VerificationVerdict.NOT_VERIFIABLE);
  // Source mode with absent artifacts is ALSO not native certification.
  const source = verifyArtifactLedger([run()], { mode: EvidenceMode.SOURCE, readArtifactBytes: failing });
  assert.equal(source.certifiesNativeEvidence, false);
  // A source-mode PASS never certifies native evidence.
  const sourcePass = verifyArtifactLedger([run()], { mode: EvidenceMode.SOURCE, readArtifactBytes: readAny });
  assert.equal(sourcePass.verdict, VerificationVerdict.PASS);
  assert.equal(sourcePass.certifiesNativeEvidence, false);
  // Empty input has no verdict that could be mistaken for success.
  assert.equal(verifyArtifactLedger([], { mode: EvidenceMode.LOCAL }).verdict, VerificationVerdict.NO_EVIDENCE);
  // Mixed builds fail single scope but pass archive scope.
  const mixed = [run(), run({ executionAttemptId: 'a2', buildIdentity: { ...BUILD(), versionCode: 1001 } })];
  assert.equal(verifyArtifactLedger(mixed, { mode: EvidenceMode.LOCAL, readArtifactBytes: readAny }).verdict, VerificationVerdict.FAIL);
  assert.equal(verifyArtifactLedger(mixed, { mode: EvidenceMode.LOCAL, readArtifactBytes: readAny, buildScope: BuildScope.ARCHIVE }).verdict, VerificationVerdict.PASS);
  // A capability with no verified backing artifact of the required kind FAILS
  // (only the screenshot is present here; `launch` also requires a hierarchy).
  const noHierarchy = run();
  noHierarchy.observations = [noHierarchy.observations[0]];
  noHierarchy.artifacts = [];
  const missingHier = verifyArtifactLedger([noHierarchy], { mode: EvidenceMode.LOCAL, readArtifactBytes: readAny });
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
