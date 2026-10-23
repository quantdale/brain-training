import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { or3 } from './coverage-contract.mjs';

// Adversarial regression suite for the provenance-aware coverage merger
// (scripts/qa/merge-coverage.mjs, contract 2.0) working against the frozen
// evidence contract (scripts/qa/coverage-contract.mjs). The merger is
// exercised strictly AS A CLI: schemaVersion-2 run ledgers are written under
// os.tmpdir() and merged via
//   execFileSync(process.execPath, [MERGER, ...inputs, '--out', tmpOut, '--matrix', tmpMd])
// Nothing is ever written inside the repository. Fixture idioms follow
// scripts/qa/coverage-contract.test.mjs; the frozen modules are never edited.
//
// Every run record carries the full provenance contract schema:
// executionAttemptId; buildIdentity{gitSha,packageName,versionName,versionCode,
// apkSha256}; deviceProfile{serial,model,abi,display,density}; events[] with
// seq/action/actionRequested/actionExecuted/actionAcknowledged/
// observationBeforeSeq/observationAfterSeq/executionAttemptId/timestamp;
// observations[] with seq/controls/screenMarkers/observedGameId/score/
// boardValues; artifacts[]. States are DERIVED from the recorded controls
// (intro ['intro','start'], tutorial ['tutorial','tutorial-next'], playing
// ['stage','pause','round.1','score'], results ['results','result-facts'],
// exited = no game controls + screenMarkers ['games-title']); observations
// never self-declare a state, so no fixture can spoof one. Events always carry
// the SAME executionAttemptId as their run (except in the deliberate
// cross-attempt blend fixture), because anything else fails validation.

const MERGER = fileURLToPath(new URL('./merge-coverage.mjs', import.meta.url));
const GAME_ID = 'memory-pair-recall';

// --- temp workspace (never the repo) --------------------------------------
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-coverage-test-'));
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARTIFACT_ROOT = path.join(REPO_ROOT, 'qa-artifacts', '080', 'merge-coverage-test');
const receiptEntries = new Map();
let artifactSeq = 0;
after(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.rmSync(ARTIFACT_ROOT, { recursive: true, force: true });
});

let fileSeq = 0;
function tmpPath(label) {
  fileSeq += 1;
  return path.join(TMP_ROOT, `${label}-${fileSeq}.json`);
}

function writeLedger(label, runs) {
  const p = tmpPath(label);
  fs.writeFileSync(p, JSON.stringify({ schemaVersion: 2, runs }));
  return p;
}

// --- CLI driver ------------------------------------------------------------
let invocation = 0;
function runMerger(inputFiles, extraArgs = []) {
  invocation += 1;
  const outPath = path.join(TMP_ROOT, `merged-${invocation}.json`);
  const mdPath = path.join(TMP_ROOT, `matrix-${invocation}.md`);
  const indexPath = path.join(TMP_ROOT, `capture-receipts-${invocation}.json`);
  fs.writeFileSync(indexPath, JSON.stringify({ schemaVersion: 1, receipts: [...receiptEntries.values()] }, null, 2));
  const args = [MERGER, ...inputFiles, '--capture-receipts', indexPath, '--out', outPath, '--matrix', mdPath, ...extraArgs];
  try {
    const stdout = execFileSync(process.execPath, args, { encoding: 'utf8' });
    return { status: 0, stdout, stderr: '', outPath, mdPath };
  } catch (e) {
    return {
      status: typeof e.status === 'number' ? e.status : null,
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? ''),
      outPath,
      mdPath,
    };
  }
}

const readMerged = (r) => JSON.parse(fs.readFileSync(r.outPath, 'utf8'));
const readMatrix = (r) => fs.readFileSync(r.mdPath, 'utf8');

// --- run-record fixtures ---------------------------------------------------
function buildIdentity(overrides = {}) {
  return {
    gitSha: 'a'.repeat(40),
    packageName: 'com.braintraining.app',
    versionName: '1.4.7',
    versionCode: 1407,
    apkSha256: 'b'.repeat(64),
    ...overrides,
  };
}

function deviceProfile(overrides = {}) {
  return {
    serial: 'emulator-5554',
    model: 'sdk_gphone64_x86_64',
    abi: 'x86_64',
    display: '1080x2400',
    density: 420,
    ...overrides,
  };
}

function observation(seq, {
  controls = [], screenMarkers = [], screenKind, observedGameId, score = '0', boardValues = [],
  timestamp, phase = 'play', rawScreen, hierarchyArtifact,
} = {}) {
  // Observations carry real provenance (timestamp + phase) and an artifact
  // binding — the repaired contract rejects unbound "proof".
  const o = {
    seq,
    controls,
    screenMarkers,
    score,
    boardValues,
    phase,
    timestamp: timestamp || `2026-10-21T12:00:${String(seq).padStart(2, '0')}.000Z`,
    evidenceArtifact: {
      file: `qa-artifacts/080/fixture/obs-${seq}.png`,
      sha256: 'a'.repeat(64),
      bytes: 1024,
      kind: 'screenshot',
    },
  };
  if (screenKind) o.screenKind = screenKind;
  if (observedGameId !== undefined) o.observedGameId = observedGameId;
  if (rawScreen !== undefined) o.rawScreen = rawScreen;
  if (hierarchyArtifact !== undefined) o.hierarchyArtifact = hierarchyArtifact;
  return o;
}

const gameObs = (seq, extra = {}) => observation(seq, { observedGameId: GAME_ID, ...extra });
const introObs = (seq, extra = {}) => gameObs(seq, { controls: ['intro', 'start'], ...extra });
const playingObs = (seq, extra = {}) => gameObs(seq, { controls: ['stage', 'pause', 'round.1', 'score'], ...extra });
// The current contract requires an explicit terminal-score fact when a
// results screen's final score differs from the last gameplay observation.
const resultsObs = (seq, extra = {}) => gameObs(seq, { controls: ['results', 'result-facts', 'score-final'], ...extra });
// A PROVEN exit destination (foreground identity = app, game screen left).
const exitedObs = (seq, extra = {}) =>
  observation(seq, { screenKind: 'app-destination', screenMarkers: ['games-title'], ...extra });

function event(seq, attemptId, fields = {}) {
  return {
    seq,
    action: 'tap',
    actionRequested: true,
    actionExecuted: true,
    actionAcknowledged: null,
    executionAttemptId: attemptId,
    timestamp: `2026-10-21T12:00:${String(seq).padStart(2, '0')}Z`,
    ...fields,
  };
}

function runRecord(attemptId, overrides = {}) {
  const rec = {
    executionAttemptId: attemptId,
    gameId: GAME_ID,
    knownGameId: true,
    hasTutorial: true,
    buildIdentity: buildIdentity(),
    deviceProfile: deviceProfile(),
    startedAt: '2026-10-21T12:00:00Z',
    events: [],
    observations: [],
    artifacts: [],
    ...overrides,
  };
  // Every binding uses actual, complete PNG/XML bytes and an independently
  // indexed per-artifact acquisition receipt (not the legacy signature-only
  // reviewer PNG fixture).
  const observationHierarchyArtifacts = [];
  rec.observations = (rec.observations || []).map((o) => {
    if (!o || typeof o !== 'object') return o;
    const mapped = { ...o };
    if (o.evidenceArtifact && typeof o.evidenceArtifact === 'object') {
      mapped.evidenceArtifact = realArtifact(o.evidenceArtifact.kind, attemptId, rec.buildIdentity, o);
    }
    if (o.hierarchyArtifact && typeof o.hierarchyArtifact === 'object') {
      mapped.hierarchyArtifact = realArtifact('hierarchy', attemptId, rec.buildIdentity, o);
      observationHierarchyArtifacts.push(mapped.hierarchyArtifact);
    }
    return mapped;
  });
  rec.artifacts = [
    ...(rec.artifacts || []),
    ...observationHierarchyArtifacts,
    { ...realArtifact('screenshot', attemptId, rec.buildIdentity, rec.observations?.[0]), mandatory: true },
    { ...realArtifact('hierarchy', attemptId, rec.buildIdentity, rec.observations?.[0]), mandatory: true },
  ];
  return rec;
}

// --- valid native-format test artifacts and receipts ----------------------
const artifactCrc32 = (bytes) => {
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
  const crc = Buffer.alloc(4); crc.writeUInt32BE(artifactCrc32(Buffer.concat([name, payload])));
  return Buffer.concat([length, name, payload, crc]);
};
const PNG_BYTES = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  pngChunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  pngChunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 255]))),
  pngChunk('IEND', Buffer.alloc(0)),
]);
const FIXTURE_REL = path.relative(REPO_ROOT, ARTIFACT_ROOT).split(path.sep).join('/');
function hierarchyBytes(gameId, observation) {
  const controls = observation?.controls || [];
  const markers = observation?.screenMarkers || [];
  const nodes = [...controls.map((control) => `<node index="0" resource-id="${gameId}.${control}" package="com.braintraining.app" />`),
    ...markers.map((marker) => `<node index="0" text="${marker}" resource-id="${marker}" package="com.braintraining.app" />`)];
  if (!nodes.length) nodes.push('<node index="0" text="Games" resource-id="games-title" package="com.braintraining.app" />');
  return Buffer.from(`<hierarchy rotation="0">${nodes.join('')}</hierarchy>`);
}
function realArtifact(kind, attemptId, build, observation, hierarchyGameId = GAME_ID) {
  artifactSeq++;
  const bytes = kind === 'hierarchy' ? hierarchyBytes(hierarchyGameId, observation) : PNG_BYTES;
  const extension = kind === 'hierarchy' ? 'xml' : 'png';
  const file = `${FIXTURE_REL}/capture-${artifactSeq}-${attemptId}.${extension}`;
  const abs = path.join(REPO_ROOT, ...file.split('/'));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, bytes);
  const artifactSha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const receipt = {
    schemaVersion: 1,
    captureId: crypto.randomUUID(),
    executionAttemptId: attemptId,
    artifactSha256,
    capturedAt: observation?.timestamp || '2026-10-21T12:00:00.000Z',
    observationSeq: observation?.seq ?? 0,
    observationTimestamp: observation?.timestamp || '2026-10-21T12:00:00.000Z',
    gitSha: build.gitSha,
    apkSha256: build.apkSha256,
    artifactFile: file,
  };
  const receiptBytes = Buffer.from(JSON.stringify(receipt));
  const receiptFile = `${FIXTURE_REL}/receipt-${artifactSeq}-${attemptId}.json`;
  fs.writeFileSync(path.join(REPO_ROOT, ...receiptFile.split('/')), receiptBytes);
  const receiptSha256 = crypto.createHash('sha256').update(receiptBytes).digest('hex');
  receiptEntries.set(receiptFile.toLowerCase(), { file: receiptFile, sha256: receiptSha256 });
  return {
    file, sha256: artifactSha256, bytes: bytes.length, kind,
    executionAttemptId: attemptId,
    captureReceipt: { file: receiptFile, sha256: receiptSha256 },
  };
}

// Minimal honest L2: an intro -> playing entry transition event PLUS one
// acknowledged gameplay input whose before/after observations have DIFFERENT
// fingerprints (score 0 -> 10 and a NEW feedback marker) = inputAccepted +
// feedbackObserved. No results.
function l2Run(attemptId, overrides = {}) {
  return runRecord(attemptId, {
    observations: [
      introObs(1),
      playingObs(2, { score: '0' }),
      gameObs(3, { controls: ['stage', 'pause', 'round.1', 'score', 'feedback.correct'], score: '10' }),
    ],
    events: [
      event(1, attemptId, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, attemptId, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
    ...overrides,
  });
}

// L2 through the ROUND-ADVANCE response axis instead of feedback: round.1 ->
// round.2 with a score change, no feedback markers. Complements l2Run.
function l2RoundAdvanceRun(attemptId, overrides = {}) {
  return runRecord(attemptId, {
    observations: [
      introObs(1),
      playingObs(2, { score: '0' }),
      gameObs(3, { controls: ['stage', 'pause', 'round.2', 'score'], score: '5' }),
    ],
    events: [
      event(1, attemptId, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, attemptId, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
    ...overrides,
  });
}

// Valid L3: l2Run's evidence plus a playing -> results transition whose
// results observation follows this session's gameplay (results attributable).
function l3Run(attemptId, overrides = {}) {
  return runRecord(attemptId, {
    observations: [
      introObs(1),
      playingObs(2, { score: '0' }),
      gameObs(3, { controls: ['stage', 'pause', 'round.1', 'score', 'feedback.correct'], score: '10' }),
      resultsObs(4, { score: '15' }),
    ],
    events: [
      event(1, attemptId, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, attemptId, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
      event(3, attemptId, { action: 'wait', observationBeforeSeq: 3, observationAfterSeq: 4 }),
    ],
    ...overrides,
  });
}

// Verified native smoke (L1): intended game launched, identity verified,
// entry controls rendered, and a Back event whose AFTER observation shows the
// game screen was left (post-exit destination confirmed).
function l1Run(attemptId, overrides = {}) {
  const hierarchyBinding = { kind: 'hierarchy', file: 'pending-hierarchy.xml', sha256: 'a'.repeat(64), executionAttemptId: attemptId };
  const packageName = buildIdentity().packageName;
  const appScreen = {
    expectedPackage: packageName,
    focusPackage: `${packageName}/${packageName}.MainActivity`,
    hierarchyStatus: 'ok',
    appAlive: true,
  };
  return runRecord(attemptId, {
    observations: [
      introObs(1, { rawScreen: { ...appScreen, controlCount: 2 }, hierarchyArtifact: hierarchyBinding }),
      exitedObs(2, { rawScreen: { ...appScreen, controlCount: 0 }, hierarchyArtifact: hierarchyBinding }),
    ],
    events: [
      event(1, attemptId, { action: 'deeplink', actionAcknowledged: null }),
      event(2, attemptId, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
    ],
    ...overrides,
  });
}

// "Results only" run: the tail of a session (playing -> results) captured with
// NO gameplay-entry evidence. It proves sessionEnded + resultsCurrent but can
// never be an L3 journey on its own — the classic cross-run-fabrication half.
function resultsTailRun(attemptId, overrides = {}) {
  return runRecord(attemptId, {
    observations: [playingObs(1, { score: '0' }), resultsObs(2, { score: '7' })],
    events: [event(1, attemptId, { action: 'wait', observationBeforeSeq: 1, observationAfterSeq: 2 })],
    ...overrides,
  });
}

// FAILED attempt: game identity is bound, but a gameplay tap leaves its
// before/after fingerprints IDENTICAL — executed, never accepted.
function unresponsiveRun(attemptId, overrides = {}) {
  return runRecord(attemptId, {
    observations: [
      observation(1, { observedGameId: GAME_ID, controls: ['intro', 'start'] }),
      observation(2, { observedGameId: GAME_ID, controls: ['stage', 'pause', 'round.1', 'score'] }),
      observation(3, { observedGameId: GAME_ID, controls: ['stage', 'pause', 'round.1', 'score'] }),
    ],
    events: [
      event(1, attemptId, { action: 'deeplink', actionAcknowledged: null }),
      event(2, attemptId, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// M1 — cross-run fabrication: entry+input in run A, results in run B must
// never certify one continuous session.
// ---------------------------------------------------------------------------
test('M1: cross-run union is NOT a journey — A(entry+input) + B(results) must not certify L3', () => {
  const runA = l2Run('attempt-entry-001');
  const runB = resultsTailRun('attempt-results-001');
  const r = runMerger([writeLedger('m1-a', [runA]), writeLedger('m1-b', [runB])]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  assert.equal(out.games.length, 1);
  const g = out.games[0];

  assert.notEqual(g.certified.level, 3, 'cross-run union must never certify a full-session lifecycle');
  assert.equal(g.certified.level, 2, 'certification comes from the deepest SINGLE run (run A)');

  // certified.runId references ONE coherent execution attempt, never a blend.
  assert.equal(g.certified.runId, 'attempt-entry-001');
  assert.ok(g.runs.some((x) => x.executionAttemptId === g.certified.runId));

  // The union IS reported — explicitly, with run provenance...
  assert.equal(g.capabilityUnion.sessionEnded.status, 'VERIFIED');
  assert.ok(g.capabilityUnion.sessionEnded.runs.includes('attempt-results-001'));
  // ...and the merger must label it as not-a-journey.
  const diag = out.diagnostics.find((d) => d.kind === 'cross-run-union-not-a-journey' && d.gameId === GAME_ID);
  assert.ok(diag, "diagnostics must contain kind 'cross-run-union-not-a-journey'");
});

// ---------------------------------------------------------------------------
// M2 — deepest single run wins: L2 + L3 for one game certifies L3 from the
// L3 run only.
// ---------------------------------------------------------------------------
test('M2: deepest single run wins — L2 + L3 runs certify level 3 from the L3 run', () => {
  const r = runMerger([
    writeLedger('m2-l2', [l2Run('attempt-l2-002')]),
    writeLedger('m2-l3', [l3Run('attempt-l3-002')]),
  ]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  const g = out.games[0];

  assert.equal(g.certified.level, 3);
  assert.equal(g.certified.levelName, 'verified full-session lifecycle');
  assert.equal(g.certified.runId, 'attempt-l3-002', 'the L3 run must be the certifying run');
  assert.equal(g.runs.length, 2, 'the L2 run is retained alongside the L3 run');
  // With a genuine single-run L3 present, no cross-run-not-a-journey warning.
  assert.ok(!out.diagnostics.some((d) => d.kind === 'cross-run-union-not-a-journey'));
});

// ---------------------------------------------------------------------------
// M3 — no silent discard: two same-level runs with complementary axis
// outcomes both survive the merge; the boolean union is real or3.
// ---------------------------------------------------------------------------
test('M3: complementary same-level runs both survive — no silent discard, real or3 union', () => {
  const withFeedback = l2Run('attempt-feedback-003');
  const withRound = l2RoundAdvanceRun('attempt-round-003');
  const r = runMerger([
    writeLedger('m3-feedback', [withFeedback]),
    writeLedger('m3-round', [withRound]),
  ]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  const g = out.games[0];

  // Both runs are listed per game.
  assert.equal(g.runs.length, 2);
  assert.deepEqual(
    g.runs.map((x) => x.executionAttemptId).sort(),
    ['attempt-feedback-003', 'attempt-round-003'],
  );

  // The complementary positive outcomes BOTH appear in the union...
  const fb = g.capabilityUnion.feedbackObserved;
  assert.equal(fb.status, 'VERIFIED');
  assert.ok(fb.runs.includes('attempt-feedback-003'));
  const ra = g.capabilityUnion.roundAdvanced;
  assert.equal(ra.status, 'VERIFIED');
  assert.ok(ra.runs.includes('attempt-round-003'));

  // ...and perRun retains BOTH run ids with their real per-run statuses.
  assert.equal(fb.perRun.length, 2);
  assert.equal(fb.perRun.find((p) => p.runId === 'attempt-feedback-003').status, 'VERIFIED');
  assert.equal(fb.perRun.find((p) => p.runId === 'attempt-round-003').status, 'NOT EXECUTED');
  assert.equal(ra.perRun.find((p) => p.runId === 'attempt-feedback-003').status, 'NOT EXECUTED');
  assert.equal(ra.perRun.find((p) => p.runId === 'attempt-round-003').status, 'VERIFIED');
  for (const axis of Object.values(g.capabilityUnion)) {
    assert.equal(axis.perRun.length, 2, `perRun for ${axis} must retain every run id`);
  }

  // Real OR semantics (true > false > unknown), never object precedence.
  assert.deepEqual(out.or3Reference, {
    'or3(true,false)': true,
    'or3(false,false)': false,
    'or3(null,true)': true,
    'or3(false,null)': null,
  });
  assert.equal(or3(true, false), true);
  assert.equal(or3(false, false), false);
  assert.equal(or3(null, true), true);
  assert.equal(or3(false, null), null);
});

// ---------------------------------------------------------------------------
// M4 — failed attempts retained: one FAILED + one VERIFIED run; same-axis
// VERIFIED/FAILED disagreement is preserved as a conflict with the rule.
// ---------------------------------------------------------------------------
test('M4: failed attempts are retained beside verified ones and conflicts state the authoritative rule', () => {
  const ok = l2Run('attempt-verified-004');
  const bad = unresponsiveRun('attempt-failed-004');
  const r = runMerger([
    writeLedger('m4-ok', [ok]),
    writeLedger('m4-bad', [bad]),
  ]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  const g = out.games[0];

  assert.equal(g.runs.length, 2, 'the failed attempt must not be discarded');
  const failed = g.runs.find((x) => x.executionAttemptId === 'attempt-failed-004');
  assert.equal(failed.status, 'PARTIAL');
  assert.equal(failed.axes.inputAccepted, 'FAILED');
  const verified = g.runs.find((x) => x.executionAttemptId === 'attempt-verified-004');
  assert.equal(verified.status, 'VERIFIED');
  assert.equal(out.rawPerRunLedger.length, 2, 'raw ledger keeps both attempts');

  // inputAccepted is VERIFIED in one run and FAILED in the other -> conflict.
  const conflict = g.conflicts.find((c) => c.axis === 'inputAccepted');
  assert.ok(conflict, 'same-axis VERIFIED/FAILED disagreement must produce a conflicts[] entry');
  assert.equal(typeof conflict.authoritativeRule, 'string');
  assert.ok(conflict.authoritativeRule.length > 0, 'conflict must state the authoritative rule');
  assert.ok(conflict.runs.some((p) => p.runId === 'attempt-verified-004' && p.status === 'VERIFIED'));
  assert.ok(conflict.runs.some((p) => p.runId === 'attempt-failed-004' && p.status === 'FAILED'));
});

// ---------------------------------------------------------------------------
// M5 — invalid runs excluded from certification but retained and diagnosed,
// even when they claim the highest level.
// ---------------------------------------------------------------------------
test('M5: invalid run is retained and diagnosed but can never be the certifying run', () => {
  const invalid = l3Run('attempt-legacy-hero-005', { claimedLevelLegacy: 3 });
  delete invalid.buildIdentity.apkSha256;
  const valid = l2Run('attempt-valid-005');
  const r = runMerger([
    writeLedger('m5-invalid', [invalid]),
    writeLedger('m5-valid', [valid]),
  ]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  const g = out.games[0];

  const diag = out.diagnostics.find((d) => d.kind === 'invalid-run' && d.runId === 'attempt-legacy-hero-005');
  assert.ok(diag, "diagnostics must contain kind 'invalid-run' for the broken-provenance run");
  assert.match(diag.detail, /missing buildIdentity\.apkSha256/);

  const ledgerEntry = out.validatedPerRunLedger.find((x) => x.executionAttemptId === 'attempt-legacy-hero-005');
  assert.equal(ledgerEntry.valid, false);
  assert.ok(ledgerEntry.errors.some((e) => e.includes('missing buildIdentity.apkSha256')));

  // Retained in the raw ledger and in the game's run list...
  assert.equal(out.rawPerRunLedger.length, 2);
  assert.equal(g.runs.length, 2);
  assert.equal(out.totals.invalidRuns, 1);

  // ...but never the certifying run, even though it claims L3 evidence/legacy.
  assert.equal(g.certified.runId, 'attempt-valid-005');
  assert.equal(g.certified.level, 2);
  assert.ok(
    g.downgrades.some((d) => d.runId === 'attempt-legacy-hero-005' && d.claimedLevelLegacy === 3 && d.certifiedLevel === 0),
    'the inflated legacy claim must be explained as a downgrade',
  );
  // Under the current contract, incomplete build provenance is rejected before
  // capability derivation. Older contract revisions retained derived axes only
  // under historical observations; in neither case may the invalid run certify.
  const invalidResultsVerified = ledgerEntry.axes.resultsCurrent === 'VERIFIED';
  assert.equal(
    out.diagnostics.some((d) => d.kind === 'cross-run-union-not-a-journey'),
    invalidResultsVerified,
    'cross-run warning must follow only the result-axis evidence actually retained for this invalid attempt',
  );
  if (!invalidResultsVerified) {
    assert.equal(ledgerEntry.level, 0);
    assert.equal(g.historicalObservations.resultsCurrent.status, 'NOT EXECUTED');
  }
});

// ---------------------------------------------------------------------------
// M6 — cross-attempt blend inside one run record is invalid and cannot certify.
// ---------------------------------------------------------------------------
test('M6: events spanning two executionAttemptIds invalidate the run — no certification', () => {
  const blend = l3Run('attempt-blend-001');
  blend.events[2].executionAttemptId = 'attempt-blend-002';
  const r = runMerger([writeLedger('m6-blend', [blend])]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  const g = out.games[0];

  const diag = out.diagnostics.find((d) => d.kind === 'invalid-run' && d.runId === 'attempt-blend-001');
  assert.ok(diag);
  assert.match(diag.detail, /multiple executionAttemptIds/);
  assert.equal(out.validatedPerRunLedger[0].valid, false);
  assert.equal(g.certified.level, 0);
  assert.equal(g.certified.runId, null);
  assert.match(g.certified.reasons.join(' '), /no contract-valid execution attempt/);
  assert.equal(out.rawPerRunLedger.length, 1, 'the blended run is retained, not silently dropped');
});

// ---------------------------------------------------------------------------
// M7 — schema-1 input is rejected at the CLI boundary.
// ---------------------------------------------------------------------------
test('M7: schema-1 ledger is rejected — exit code 2 and reclassify-historical guidance', () => {
  // Real v1 shape (cf. scripts/qa/native-coverage-ledger.json): schemaVersion 1
  // with games[]/milestones and NO runs[].
  const v1 = tmpPath('m7-v1-games');
  fs.writeFileSync(v1, JSON.stringify({ schemaVersion: 1, games: [{ id: GAME_ID, milestones: { launched: true } }] }));
  const r = runMerger([v1]);
  assert.equal(r.status, 2, 'schema-1 input must exit 2');
  assert.ok(!fs.existsSync(r.outPath), 'no merged output may be produced from schema-1 input');

  // FIXED (Campaign 080 Wave B, docs-vs-code inconsistency #6): the loader used
  // to reject the real v1 shape on the missing runs[] BEFORE the schemaVersion
  // check, which made the mandated `reclassify-historical.mjs` guidance
  // unreachable. The schemaVersion check now runs FIRST, so a genuine v1
  // ledger gets the actionable guidance rather than a bare "malformed" error.
  assert.match(r.stderr, /reclassify-historical/,
    'a real v1 ledger must receive the mandated reclassify-historical guidance');
  assert.doesNotMatch(r.stderr, /malformed ledger/,
    'a v1 ledger is NOT malformed — it is a recognised older schema');

  // The mandated guidance IS emitted on the reachable schema-mismatch path: a
  // document carrying runs[] under a non-2 schemaVersion.
  const v1WithRuns = tmpPath('m7-v1-runs');
  fs.writeFileSync(v1WithRuns, JSON.stringify({ schemaVersion: 1, runs: [] }));
  const r2 = runMerger([v1WithRuns]);
  assert.equal(r2.status, 2, 'schema-1 run ledger must exit 2');
  assert.match(r2.stderr, /reclassify-historical/);

  const nullLedger = tmpPath('m7-null-top-level');
  fs.writeFileSync(nullLedger, 'null');
  const r3 = runMerger([nullLedger]);
  assert.equal(r3.status, 2, 'null top-level collections are malformed input, not an uncaught exception');
  assert.match(r3.stderr, /top-level value must be an object or array/);
});

// ---------------------------------------------------------------------------
// M8 — downgrade explanations: legacy claim above the proven level is
// explained in the JSON and named in the matrix.
// ---------------------------------------------------------------------------
test('M8: downgrades from claimedLevelLegacy carry explanations and are named in the matrix', () => {
  const run = l1Run('attempt-downgrade-008', { claimedLevelLegacy: 2 });
  const r = runMerger([writeLedger('m8', [run])]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  const g = out.games[0];

  assert.equal(g.certified.level, 1);
  assert.equal(g.certified.artifactAttested, true, 'fresh known-app destination hierarchy must remain a positive control');
  const d = g.downgrades.find((x) => x.runId === 'attempt-downgrade-008');
  assert.ok(d, 'a legacy claim above the proven level must produce a downgrade entry');
  assert.equal(d.claimedLevelLegacy, 2);
  assert.equal(d.certifiedLevel, 1);
  assert.ok(d.explanation.length > 0);

  const md = readMatrix(r);
  assert.ok(md.includes('## Downgrade explanations'), 'matrix must contain a Downgrade explanations section');
  assert.ok(
    md.includes(`| \`${GAME_ID}\` | attempt-downgrade-008 | L2 | L1 |`),
    'the downgrade table must name the game',
  );
});

// ---------------------------------------------------------------------------
// M9 — matrix vocabulary: status legend and per-axis columns.
// ---------------------------------------------------------------------------
test('M9: matrix emits the status legend and the per-axis column vocabulary', () => {
  const r = runMerger([writeLedger('m9', [l3Run('attempt-matrix-009')])]);
  assert.equal(r.status, 0);
  const md = readMatrix(r);

  for (const token of ['V=VERIFIED', 'O=OBSERVED', 'A=ATTEMPTED', 'F=FAILED', 'B=BLOCKED', 'NE=NOT EXECUTED']) {
    assert.ok(md.includes(token), `status legend missing ${token}`);
  }
  const header = '| Game id | Certified | Status | Proven by run | Runs | Launch | Render | TutDone | Play | InputOK | Feedback | RoundAdv | Passive | SessEnd | Results | SafeExit |';
  assert.ok(md.includes(header), 'per-axis column header (Launch/Render/TutDone/Play/InputOK/Feedback/RoundAdv/Passive/SessEnd/Results/SafeExit) missing');
});

// ---------------------------------------------------------------------------
// M10 — resilience subcapabilities MAY union across runs (contract makes them
// independent), each keeping its own run provenance; certification stays
// single-run.
// ---------------------------------------------------------------------------
test('M10: resilience union across runs is allowed with per-run provenance; certification stays single-run', () => {
  const runA = l2Run('attempt-res-a-010', {
    resilience: { backgroundRelaunch: { verified: true, evidence: ['x'] } },
  });
  const runB = l1Run('attempt-res-b-010', {
    resilience: { offlineContinuity: { verified: true, evidence: ['y'] } },
  });
  const r = runMerger([
    writeLedger('m10-a', [runA]),
    writeLedger('m10-b', [runB]),
  ]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  const g = out.games[0];

  // Both subcapabilities merge to VERIFIED...
  assert.equal(g.resilience.backgroundRelaunch.status, 'VERIFIED');
  assert.ok(g.resilience.backgroundRelaunch.runs.includes('attempt-res-a-010'));
  assert.equal(g.resilience.offlineContinuity.status, 'VERIFIED');
  assert.ok(g.resilience.offlineContinuity.runs.includes('attempt-res-b-010'));

  // ...with per-run provenance retained across the union.
  assert.equal(g.resilience.backgroundRelaunch.perRun.length, 2);
  assert.equal(g.resilience.backgroundRelaunch.perRun.find((p) => p.runId === 'attempt-res-b-010').status, 'NOT EXECUTED');
  assert.equal(g.resilience.offlineContinuity.perRun.length, 2);
  assert.equal(g.resilience.offlineContinuity.perRun.find((p) => p.runId === 'attempt-res-a-010').status, 'NOT EXECUTED');

  // Certification is still ONE run: run B's resilience never merges with run
  // A's session into a fabricated L4.
  assert.equal(g.certified.level, 2);
  assert.equal(g.certified.runId, 'attempt-res-a-010');
  assert.ok(g.runs.every((x) => x.level < 4), 'no single run proves L4 here');
});

// ---------------------------------------------------------------------------
// M11 — happy path: one well-formed L3 run certifies exactly once.
// ---------------------------------------------------------------------------
test('M11: happy path — one well-formed L3 run certifies level 3 and validates clean', () => {
  const r = runMerger([writeLedger('m11', [l3Run('attempt-happy-011')])]);
  assert.equal(r.status, 0);
  const out = readMerged(r);
  const g = out.games[0];

  assert.equal(g.certified.level, 3);
  assert.equal(g.certified.levelName, 'verified full-session lifecycle');
  assert.equal(g.certified.status, 'VERIFIED');
  assert.equal(g.certified.runId, 'attempt-happy-011');
  assert.equal(out.rawPerRunLedger.length, 1);
  assert.equal(out.validatedPerRunLedger.length, 1);
  assert.equal(out.validatedPerRunLedger[0].valid, true);
  assert.equal(out.totals.validRuns, 1);
  assert.equal(out.totals.invalidRuns, 0);
  assert.equal(out.diagnostics.length, 0);
});

// ---------------------------------------------------------------------------
// M12 — strict mode: --strict exits 1 on contract-invalid runs; default exits 0.
// ---------------------------------------------------------------------------
test('M12: --strict exits 1 when an invalid run is included; default mode exits 0', () => {
  const valid = l2Run('attempt-valid-012');
  const invalid = l2Run('attempt-invalid-012');
  delete invalid.buildIdentity.versionCode;
  const ledger = writeLedger('m12', [valid, invalid]);

  const strictRun = runMerger([ledger], ['--strict']);
  assert.equal(strictRun.status, 1, '--strict must fail on contract-invalid runs');
  assert.match(strictRun.stderr, /contract-invalid runs/);

  const lenientRun = runMerger([ledger]);
  assert.equal(lenientRun.status, 0, 'without --strict the merge still succeeds and retains the invalid run');
  const out = readMerged(lenientRun);
  assert.equal(out.totals.invalidRuns, 1);
  assert.equal(out.totals.validRuns, 1);
});

// ---------------------------------------------------------------------------
// M13/M14 (Campaign 080 P1-3) — ARTIFACT ATTESTATION. The second independent
// review merged the v8 ledger to exit 0 / 7x L3 in a checkout where
// verify-artifacts reported BLOCKED with 1119 unreadable artifacts. Since
// this repair that is impossible: a run without a PASS per-run artifact
// attestation is NON-CERTIFYING and its certified levels are suppressed.
// ---------------------------------------------------------------------------
test('M13 (P1-3): certifying levels are impossible without artifact verification [reviewer v8 regression]', () => {
  // Baseline: the SAME fully proven L3 run WITH intact, hash-correct artifacts
  // certifies L3 and attests CERTIFYING.
  const goodLedger = writeLedger('m13-good', [l3Run('attempt-p13-good')]);
  const good = runMerger([goodLedger]);
  assert.equal(good.status, 0);
  const outGood = readMerged(good);
  assert.equal(outGood.artifactAttestation.verdict, 'CERTIFYING');
  assert.equal(outGood.artifactAttestation.verifiedArtifacts > 0, true);
  assert.equal(outGood.games[0].certified.level, 3);
  assert.equal(outGood.games[0].certified.artifactAttested, true);
  assert.equal(runMerger([goodLedger], ['--strict']).status, 0, 'a fully attested merge passes --strict');

  // The same run whose mandatory artifacts are ABSENT must never certify:
  // its recorded events still prove L3 in the raw ledger, but the certified
  // level is suppressed until artifact verification passes.
  const missing = l3Run('attempt-p13-missing');
  for (const o of missing.observations) {
    if (o.evidenceArtifact) o.evidenceArtifact.file = `${FIXTURE_REL}/does-not-exist-${o.seq}.png`;
  }
  for (const a of missing.artifacts) a.file = `${FIXTURE_REL}/does-not-exist-run-artifact.png`;
  const badLedger = writeLedger('m13-missing', [missing]);
  const bad = runMerger([badLedger]);
  assert.equal(bad.status, 0, 'without --strict the merge completes but reports non-certifying');
  const outBad = readMerged(bad);
  assert.equal(outBad.artifactAttestation.verdict, 'NON_CERTIFYING');
  assert.equal(outBad.validatedPerRunLedger[0].artifactAttestation.certifying, false);
  assert.equal(outBad.validatedPerRunLedger[0].level, 3, 'the raw recorded depth is retained for transparency');
  assert.equal(outBad.games[0].certified.level, 0, 'certified levels must be suppressed when attestation fails');
  assert.equal(outBad.games[0].certified.artifactAttested, false);
  assert.equal(outBad.totals.artifactAttestedRuns, 0);
  const diag = outBad.diagnostics.find((d) => d.kind === 'artifact-attestation-failed' && d.runId === 'attempt-p13-missing');
  assert.ok(diag, "diagnostics must contain kind 'artifact-attestation-failed'");

  const strictBad = runMerger([badLedger], ['--strict']);
  assert.equal(strictBad.status, 1, '--strict must exit non-zero when attestation fails');
  assert.match(strictBad.stderr, /artifact attestation/);
});

test('M14 (P1-3): exact reviewer fixtures fail closed; valid PNG/XML receipts certify; missing/mismatched fixtures do not', () => {
  const fixture = (name) => fileURLToPath(new URL(`./test-fixtures/080-review/${name}`, import.meta.url));

  // A fresh, complete PNG/XML acquisition is the positive artifact-attestation
  // control. It passes only with both bytes and its indexed receipts.
  const validLedger = writeLedger('m14-valid-real-artifacts', [l3Run('attempt-m14-valid')]);
  const valid = runMerger([validLedger]);
  assert.equal(valid.status, 0);
  const outValid = readMerged(valid);
  assert.equal(outValid.artifactAttestation.verdict, 'CERTIFYING');
  assert.equal(outValid.validatedPerRunLedger[0].artifactAttestation.certifying, true);
  assert.ok(outValid.artifactAttestation.verifiedArtifacts >= 2);
  assert.equal(outValid.games[0].certified.artifactAttested, true);
  assert.equal(runMerger([validLedger], ['--strict']).status, 0);

  // The reviewer's purported valid fixture has only a PNG signature plus an
  // invalid IDAT CRC and no capture receipts; real parsing correctly refuses it.
  const reviewerValidLedger = fixture('valid-artifact-ledger.json');
  const reviewerValid = runMerger([reviewerValidLedger]);
  const reviewerOut = readMerged(reviewerValid);
  assert.equal(reviewerOut.artifactAttestation.verdict, 'NON_CERTIFYING');
  assert.equal(reviewerOut.games[0].certified.level, 0);
  assert.ok((reviewerOut.validatedPerRunLedger[0].artifactAttestation.counters.badContent || 0) >= 1
    || (reviewerOut.validatedPerRunLedger[0].artifactAttestation.counters.invalidRun || 0) >= 1);
  assert.equal(runMerger([reviewerValidLedger], ['--strict']).status, 1);

  // Exact reviewer missing-artifact fixture stays non-certifying.
  const missingLedger = fixture('missing-artifact-ledger.json');
  const missing = runMerger([missingLedger]);
  assert.equal(missing.status, 0);
  const outMissing = readMerged(missing);
  assert.equal(outMissing.artifactAttestation.verdict, 'NON_CERTIFYING');
  assert.equal(outMissing.validatedPerRunLedger[0].artifactAttestation.certifying, false);
  assert.ok((outMissing.validatedPerRunLedger[0].artifactAttestation.counters.unreadable || 0) >= 1
    || (outMissing.validatedPerRunLedger[0].artifactAttestation.counters.invalidRun || 0) >= 1);
  assert.equal(outMissing.games[0].certified.artifactAttested, false);
  assert.equal(runMerger([missingLedger], ['--strict']).status, 1, '--strict must exit non-zero when attestation fails');

  // Mismatched digests are equally non-certifying.
  const mismatchLedger = fixture('hash-mismatch-ledger.json');
  const mismatch = runMerger([mismatchLedger]);
  const outMismatch = readMerged(mismatch);
  assert.equal(outMismatch.artifactAttestation.verdict, 'NON_CERTIFYING');
  assert.equal(outMismatch.validatedPerRunLedger[0].artifactAttestation.certifying, false);
  assert.ok((outMismatch.validatedPerRunLedger[0].artifactAttestation.counters.mismatch || 0) >= 1
    || (outMismatch.validatedPerRunLedger[0].artifactAttestation.counters.invalidRun || 0) >= 1);
});

test('M15 (P2-B4): duplicate attempts from separate ledgers are invalid and --strict exits nonzero', () => {
  const duplicateId = 'attempt-duplicate-across-ledgers';
  const first = writeLedger('m15-first', [l2Run(duplicateId)]);
  const second = writeLedger('m15-second', [l3Run(duplicateId)]);
  const merged = runMerger([first, second]);
  assert.equal(merged.status, 0, 'non-strict merge retains diagnostics without certifying duplicates');
  const out = readMerged(merged);
  assert.equal(out.totals.validRuns, 0);
  assert.equal(out.games[0].certified.level, 0);
  assert.ok(out.validatedPerRunLedger.every((run) => run.artifactAttestation.runValid === false && run.artifactAttestation.certifying === false));
  assert.equal(out.artifactAttestation.runsAttested, 0);
  assert.ok(out.diagnostics.some((item) => item.kind === 'duplicate-execution-attempt-id'));
  assert.ok(out.diagnostics.some((item) => item.kind === 'invalid-run' && /duplicate executionAttemptId/.test(item.detail)));
  const strict = runMerger([first, second], ['--strict']);
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /contract-invalid runs/);
});

test('M16 (P2-B4): corrupt collections and unknown game ids are retained, rejected, and never throw', () => {
  const corrupt = l2Run('attempt-corrupt-collection');
  corrupt.events = {};
  const unknown = l2Run('attempt-unknown-game', { gameId: 'made-up-game' });
  unknown.knownGameId = true;
  const ledger = writeLedger('m16-corrupt-and-unknown', [null, corrupt, unknown]);
  const merged = runMerger([ledger], ['--strict']);
  assert.equal(merged.status, 1);
  const out = readMerged(merged);
  assert.equal(out.rawPerRunLedger.length, 3);
  assert.equal(out.totals.validRuns, 0);
  assert.ok(out.diagnostics.some((item) => item.kind === 'corrupt-run-entry'));
  assert.ok(out.diagnostics.some((item) => item.kind === 'invalid-run' && /events must be an array/.test(item.detail)));
  assert.ok(out.diagnostics.some((item) => item.kind === 'invalid-run' && /unknown game id/.test(item.detail)));
});

test('M17: v1-v7 ledgers remain quarantined while a v8-named ledger gets ordinary checks only', () => {
  const historical = path.resolve(REPO_ROOT, 'scripts/qa/native-coverage-ledger-v2.json');
  const rejected = runMerger([historical], ['--strict']);
  assert.equal(rejected.status, 1);
  const historicalOutput = readMerged(rejected);
  assert.ok(historicalOutput.diagnostics.some((item) => item.kind === 'invalid-run' && /quarantined/.test(item.detail)));
  assert.equal(historicalOutput.games.every((game) => game.certified.level === 0), true);

  const v8Named = path.join(TMP_ROOT, 'native-coverage-ledger-v8.json');
  fs.writeFileSync(v8Named, JSON.stringify({ schemaVersion: 2, runs: [l3Run('attempt-v8-no-exemption')] }));
  const checked = runMerger([v8Named], ['--strict']);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  assert.equal(readMerged(checked).games[0].certified.level, 3);
});

test('M18: same-attempt replayed unrelated-game hierarchy cannot certify the reviewer safe-exit pipeline', () => {
  const run = l1Run('attempt-round3-replayed-safe-exit');
  const before = run.observations[0];
  const after = run.observations[1];
  const unrelated = realArtifact('hierarchy', run.executionAttemptId, run.buildIdentity, before, 'attention-symbol-tracker');
  before.hierarchyArtifact = unrelated;
  after.hierarchyArtifact = structuredClone(unrelated);
  run.artifacts.push(unrelated);

  // The ledger's rawScreen still asserts a live app destination after Back,
  // and the contract still derives that assertion. Independent byte parsing
  // must reject the same-attempt receipt replay and the unrelated game's XML.
  const ledger = writeLedger('m18-replayed-safe-exit', [run]);
  const merged = runMerger([ledger], ['--strict']);
  assert.equal(merged.status, 1, merged.stdout + merged.stderr);
  const out = readMerged(merged);
  assert.equal(out.games[0].certified.level, 0);
  assert.equal(out.games[0].certified.artifactAttested, false);
  assert.equal(out.validatedPerRunLedger[0].axes.safeExit, 'VERIFIED', 'retain the asserted contract axis transparently');
  assert.ok((out.validatedPerRunLedger[0].artifactAttestation.counters.captureReceiptInvalid || 0) > 0
    || (out.validatedPerRunLedger[0].artifactAttestation.counters.reusedEvidence || 0) > 0);
  assert.ok((out.validatedPerRunLedger[0].artifactAttestation.counters.badContent || 0) > 0);
});

test('M19: strict merger rejects zero runs while lenient diagnostics remain available', () => {
  const ledger = writeLedger('m19-empty', []);
  const strict = runMerger([ledger], ['--strict']);
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /zero runs present/);

  const lenient = runMerger([ledger]);
  assert.equal(lenient.status, 0);
  const out = readMerged(lenient);
  assert.equal(out.totals.runs, 0);
  assert.equal(out.totals.games, 0);
  assert.equal(out.artifactAttestation.verdict, 'NON_CERTIFYING');
});

test('M20: hierarchy-bound observed identity suppresses the reviewer identityless-L2 pipeline', () => {
  const run = l2Run('attempt-round3-identityless-l2');
  for (const observation of run.observations) delete observation.observedGameId;
  const ledger = writeLedger('m20-identityless-l2', [run]);
  const merged = runMerger([ledger], ['--strict']);
  assert.equal(merged.status, 1, merged.stdout + merged.stderr);
  const out = readMerged(merged);
  assert.equal(out.validatedPerRunLedger[0].axes.identity, 'FAILED');
  assert.equal(out.games[0].certified.level, 0);
  assert.equal(out.games[0].certified.artifactAttested, false);
  assert.ok((out.validatedPerRunLedger[0].artifactAttestation.counters.badContent || 0) > 0);
});
