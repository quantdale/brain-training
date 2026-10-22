import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  AxisStatus,
  classifyRun,
  deriveCapabilities,
  deriveLevel,
  isAdvanceControl,
  observeState,
  or3,
  pickAdvanceControl,
  validateRunRecord,
  verifyArtifactBytes,
} from './coverage-contract.mjs';

// Adversarial regression suite for the pure QA evidence contract (v2.0).
// The suite exists to prove the harness CANNOT claim gameplay success without
// proving actual gameplay. Every negative fixture reproduces a historical
// false-positive shape or an attack on one evidence axis; every positive
// fixture is the minimal honest proof the contract must credit.

const GAME_ID = 'memory-pair-recall';
const ATTEMPT_ID = 'attempt-fixture-001';

const sha256Of = (label) => createHash('sha256').update(label).digest('hex');

const buildIdentity = (overrides = {}) => ({
  gitSha: 'a'.repeat(40),
  packageName: 'com.braintraining.mobile',
  versionName: '1.4.7',
  versionCode: 1407,
  apkSha256: 'b'.repeat(64),
  ...overrides,
});

const deviceProfile = (overrides = {}) => ({
  serial: 'emulator-5554',
  model: 'sdk_gphone64_x86_64',
  abi: 'x86_64',
  display: '1080x2400',
  density: 420,
  ...overrides,
});

// Observation fixture. The `state` field is derived from the same controls the
// contract derives state from, so fixtures stay self-consistent. Every
// observation carries a real artifact BINDING (file + digest + attempt id) —
// the contract no longer accepts unbound "proof".
function observation(seq, {
  controls = [], screenMarkers = [], screenKind, observedGameId, score = '0', boardValues = [],
  controlDetails, sha256, verifiedSha256, artifact = true, phase = 'play', requireArtifact, timestamp,
} = {}) {
  const derived = observeState({ controls, screenMarkers, screenKind, gameId: GAME_ID, observedGameId });
  const o = {
    seq,
    state: derived.state,
    controls,
    screenMarkers,
    score,
    boardValues,
    phase,
    timestamp: timestamp || `2026-10-21T12:00:${String(seq).padStart(2, '0')}Z`,
  };
  if (screenKind) o.screenKind = screenKind;
  if (controlDetails) o.controlDetails = controlDetails;
  if (observedGameId !== undefined) o.observedGameId = observedGameId;
  if (requireArtifact !== undefined) o.requireArtifact = requireArtifact;
  if (artifact) {
    o.evidenceArtifact = {
      file: `qa-artifacts/080/fixture/${ATTEMPT_ID}/obs-${String(seq).padStart(2, '0')}.png`,
      sha256: sha256 || sha256Of(`obs-${seq}`),
      bytes: 1024,
      kind: 'screenshot',
      executionAttemptId: ATTEMPT_ID,
    };
    if (verifiedSha256 !== undefined) o.evidenceArtifact.verifiedSha256 = verifiedSha256;
  } else {
    o.evidenceArtifact = null;
  }
  return o;
}

const gameObs = (seq, extra = {}) => observation(seq, { observedGameId: GAME_ID, ...extra });
const introObs = (seq, extra = {}) => gameObs(seq, { controls: ['intro', 'start'], ...extra });
const playingObs = (seq, extra = {}) => gameObs(seq, { controls: ['stage', 'pause', 'round.1', 'score'], ...extra });
const resultsObs = (seq, extra = {}) => gameObs(seq, { controls: ['results', 'result-facts'], ...extra });
// A PROVEN exit destination: foreground identity is the app and the game screen
// left. This is the only shape that may ever certify a safe exit.
const exitedObs = (seq, extra = {}) =>
  observation(seq, { screenKind: 'app-destination', screenMarkers: ['games-title'], ...extra });

function event(seq, fields = {}) {
  return {
    seq,
    action: 'tap',
    actionRequested: true,
    actionExecuted: true,
    actionAcknowledged: null,
    executionAttemptId: ATTEMPT_ID,
    timestamp: `2026-10-21T12:00:${String(seq).padStart(2, '0')}Z`,
    ...fields,
  };
}

function runRecord(overrides = {}) {
  const rec = {
    executionAttemptId: ATTEMPT_ID,
    gameId: GAME_ID,
    knownGameId: true,
    buildIdentity: buildIdentity(),
    deviceProfile: deviceProfile(),
    startedAt: '2026-10-21T12:00:00Z',
    events: [],
    observations: [],
    ...overrides,
  };
  // Fixture convenience: bind observation artifacts to the record's own
  // execution attempt. Tests that specifically attack wrong-attempt artifact
  // reuse overwrite this binding AFTER construction.
  for (const o of rec.observations || []) {
    if (o && o.evidenceArtifact && typeof o.evidenceArtifact === 'object' &&
        o.evidenceArtifact.executionAttemptId === ATTEMPT_ID && rec.executionAttemptId !== ATTEMPT_ID) {
      o.evidenceArtifact = { ...o.evidenceArtifact, executionAttemptId: rec.executionAttemptId };
    }
  }
  return rec;
}

// ---------------------------------------------------------------------------
// Negative cases — a level/axis the evidence does not prove must not be awarded.
// ---------------------------------------------------------------------------

test('N1: game launched but never rendered (identity verified only) earns no level', () => {
  // (a) identity marker on an unknown splash surface: the contract credits
  // neither identity nor render, and no level.
  const splash = runRecord({
    observations: [gameObs(1, { controls: ['loading'] })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  const splashLevel = deriveLevel(splash);
  assert.equal(splashLevel.level, 0);
  assert.notEqual(splashLevel.axes.render.status, AxisStatus.VERIFIED);

  // (b) strongest attacker shape: identity IS credited (observedGameId matches
  // on a non-unknown surface) but no entry control ever rendered — identity
  // alone must still not earn a level.
  const identityOnly = runRecord({
    observations: [gameObs(1, { controls: ['result-facts'] })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  const identityLevel = deriveLevel(identityOnly);
  assert.equal(identityLevel.axes.identity.status, AxisStatus.VERIFIED);
  assert.equal(identityLevel.axes.render.status, AxisStatus.ATTEMPTED);
  assert.equal(identityLevel.level, 0);
});

test('N2: tutorial opened but never cleared fails tutorialCompleted and never reaches L2', () => {
  const rec = runRecord({
    observations: [
      gameObs(1, { controls: ['tutorial', 'tutorial-next'] }),
      gameObs(2, { controls: ['tutorial', 'tutorial-done'] }),
    ],
    events: [event(1, { actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.tutorialCompleted.status, AxisStatus.FAILED);
  assert.notEqual(axes.gameplayEntered.status, AxisStatus.VERIFIED);
  const level = deriveLevel(rec);
  assert.ok(level.level < 2, `tutorial persistence must not reach L2, got ${level.level}`);
});

test('N3: tutorial option tapped but gameplay never started earns no gameplay level', () => {
  const rec = runRecord({
    observations: [
      gameObs(1, { controls: ['tutorial', 'tutorial-demo-status', 'option.0', 'option.1'] }),
      gameObs(2, { controls: ['tutorial', 'tutorial-demo-status', 'option.0', 'option.1'], boardValues: ['picked'] }),
    ],
    events: [event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  const axes = deriveCapabilities(rec);
  assert.notEqual(axes.gameplayEntered.status, AxisStatus.VERIFIED);
  assert.equal(axes.tutorialCompleted.status, AxisStatus.FAILED);
  assert.ok(deriveLevel(rec).level < 2, 'a tutorial-surface tap must not earn a gameplay level');
});

test('N4: Start tapped while state stays intro must not verify gameplay entry', () => {
  const rec = runRecord({
    observations: [
      introObs(1),
      introObs(2, { boardValues: ['pressing'] }),
    ],
    events: [event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.gameplayEntered.status, AxisStatus.ATTEMPTED);
  assert.ok(deriveLevel(rec).level < 2, 'intro that never becomes playing must not reach L2');
});

test('N5: playing state observed but no valid input or gameplay event caps at L1 (memory-pair-recall shape)', () => {
  const rec = runRecord({
    observations: [
      introObs(1),
      playingObs(2),
      playingObs(3),
      exitedObs(4),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 3, observationAfterSeq: 4 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.inputAttempted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.inputAccepted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.autonomousGameplayEvent.status, AxisStatus.NOT_EXECUTED);
  const level = deriveLevel(rec);
  assert.equal(level.level, 1, 'start-with-no-gameplay-input must cap at verified smoke');
  assert.notEqual(level.level, 2);
});

test('N6: gameplay tap with no application response (identical fingerprints) fails inputAccepted and never reaches L2', () => {
  const rec = runRecord({
    observations: [
      introObs(1),
      playingObs(2, { score: '0', boardValues: ['x', 'y'] }),
      playingObs(3, { score: '0', boardValues: ['x', 'y'] }),
      exitedObs(4),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
      event(3, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 3, observationAfterSeq: 4 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.inputAccepted.status, AxisStatus.FAILED);
  const level = deriveLevel(rec);
  assert.equal(level.level, 1);
  assert.notEqual(level.level, 2);
});

test('N7: feedback identifier present BEFORE interaction is not new feedback', () => {
  const rec = runRecord({
    observations: [
      introObs(1),
      gameObs(2, { controls: ['stage', 'pause', 'round.1', 'score', 'feedback.correct'], score: '0' }),
      gameObs(3, { controls: ['stage', 'pause', 'round.1', 'score', 'feedback.correct'], score: '10' }),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  // The input itself changed the score (accepted), but the feedback marker was
  // already on screen before the interaction, so it cannot prove "new feedback".
  assert.equal(axes.inputAccepted.status, AxisStatus.VERIFIED);
  assert.equal(axes.feedbackObserved.status, AxisStatus.NOT_EXECUTED);
  assert.ok(deriveLevel(rec).level < 2, 'pre-existing feedback must not feed an L2 claim');
});

test('N8: round number unchanged after an apparent Next action must not verify roundAdvanced', () => {
  const rec = runRecord({
    observations: [
      introObs(1),
      playingObs(2, { score: '0' }),
      playingObs(3, { score: '5' }),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'tap', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.inputAccepted.status, AxisStatus.VERIFIED);
  assert.equal(axes.roundAdvanced.status, AxisStatus.NOT_EXECUTED);
  assert.ok(deriveLevel(rec).level < 2, 'unchanged round counter must not feed an L2 claim');
});

test('N9: Back sent but post-action observation still shows the game screen fails safeExit and blocks L1 (F-080-002)', () => {
  const rec = runRecord({
    observations: [introObs(1), introObs(2, { boardValues: ['still-here'] })],
    events: [
      event(1, { action: 'deeplink', actionAcknowledged: null }),
      event(2, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.safeExit.status, AxisStatus.FAILED);
  const level = deriveLevel(rec);
  assert.equal(level.level, 0);
  assert.equal(level.status, 'PARTIAL');
  assert.match(level.reasons.join(' '), /safe exit not verified/);
});

test('N10: stale results observed before any gameplay fail resultsCurrent and block L3', () => {
  const rec = runRecord({
    observations: [resultsObs(1), introObs(2), playingObs(3), exitedObs(4)],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
      event(2, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 3, observationAfterSeq: 4 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.resultsCurrent.status, AxisStatus.FAILED);
  assert.equal(axes.sessionEnded.status, AxisStatus.NOT_EXECUTED);
  const level = deriveLevel(rec);
  assert.ok(level.level < 3, 'previous-session results must not feed an L3 claim');
});

test('N11: passive timeout completion is distinguishable from answer-driven completion', () => {
  // Timeout completion: two playing observations progress with NO gameplay
  // input; a wait event times out into results.
  const timeoutRun = runRecord({
    observations: [introObs(1), playingObs(2, { score: '0' }), playingObs(3, { score: '45' }), resultsObs(4)],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'wait', observationBeforeSeq: 3, observationAfterSeq: 4 }),
    ],
  });
  const timeoutAxes = deriveCapabilities(timeoutRun);
  assert.equal(timeoutAxes.autonomousGameplayEvent.status, AxisStatus.VERIFIED);
  assert.equal(timeoutAxes.inputAccepted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(deriveLevel(timeoutRun).level, 3, 'passive timeout completion may be L3');

  // Answer-driven completion: input accepted into results.
  const answerRun = runRecord({
    observations: [introObs(1), playingObs(2, { score: '0' }), resultsObs(3, { score: '5' })],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  const answerAxes = deriveCapabilities(answerRun);
  assert.equal(answerAxes.inputAccepted.status, AxisStatus.VERIFIED);
  assert.equal(answerAxes.autonomousGameplayEvent.status, AxisStatus.NOT_EXECUTED);
  assert.equal(deriveLevel(answerRun).level, 3);

  // The axis signatures distinguish timeout completion from answer-driven play.
  assert.notEqual(timeoutAxes.inputAccepted.status, answerAxes.inputAccepted.status);
  assert.notEqual(timeoutAxes.autonomousGameplayEvent.status, answerAxes.autonomousGameplayEvent.status);
});

test('N12: screenshot captured from the wrong game fails identity and yields level 0', () => {
  const rec = runRecord({
    observations: [gameObs(1, { controls: ['intro', 'start'], observedGameId: 'language-word-chain' })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.identity.status, AxisStatus.FAILED);
  assert.equal(deriveLevel(rec).level, 0);
});

test('N13: events from two separate attempts in one record fail validation and award no level', () => {
  const rec = runRecord({
    observations: [introObs(1), playingObs(2), resultsObs(3)],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'wait', executionAttemptId: 'attempt-fixture-002', observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  const checks = validateRunRecord(rec);
  assert.equal(checks.valid, false);
  assert.ok(checks.errors.some((e) => e.includes('multiple executionAttemptIds')));
  const level = deriveLevel(rec);
  assert.equal(level.level, 0);
  assert.match(level.reasons.join(' '), /run record invalid/);
});

test('N14: evidence from two different APK builds cannot merge into one validated journey', () => {
  const apkA = '1'.repeat(64);
  const apkB = '2'.repeat(64);
  const runA = runRecord({
    executionAttemptId: 'attempt-apk-a',
    buildIdentity: buildIdentity({ apkSha256: apkA }),
    observations: [introObs(1), playingObs(2)],
    events: [
      event(1, { executionAttemptId: 'attempt-apk-a', action: 'deeplink', actionAcknowledged: null }),
      event(2, { executionAttemptId: 'attempt-apk-a', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
    ],
  });
  const runB = runRecord({
    executionAttemptId: 'attempt-apk-b',
    buildIdentity: buildIdentity({ apkSha256: apkB }),
    observations: [playingObs(1), resultsObs(2)],
    events: [event(1, { executionAttemptId: 'attempt-apk-b', action: 'wait', observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  // Each attempt is coherent and valid on its own, under its own build.
  assert.equal(validateRunRecord(runA).valid, true);
  assert.equal(validateRunRecord(runB).valid, true);
  assert.notEqual(apkA, apkB);

  // Merging both attempts' events/observations into one record (which can only
  // declare one buildIdentity, so one APK's evidence would be misattributed)
  // must fail validation and award no level.
  const merged = runRecord({
    executionAttemptId: 'attempt-apk-a',
    buildIdentity: buildIdentity({ apkSha256: apkA }),
    events: [...runA.events, ...runB.events],
    observations: [...runA.observations, ...runB.observations],
  });
  const checks = validateRunRecord(merged);
  assert.equal(checks.valid, false);
  assert.ok(checks.errors.some((e) => e.includes('multiple executionAttemptIds')));
  assert.ok(checks.errors.some((e) => e.includes('duplicate observation seq')));
  assert.equal(deriveLevel(merged).level, 0);
});

test('N15: artifact hash mismatch is detected by INDEPENDENT byte verification, not self-assertion', () => {
  // P1-C: the old `expectedSha1 !== sha1` comparison checked two values copied
  // out of the same untrusted record and could never fire on real sweep data.
  // The repaired contract verifies against bytes read from disk.

  // (a) recorded digest disagrees with the independently computed digest.
  const badArtifact = runRecord({
    observations: [gameObs(1, { controls: ['intro', 'start'], sha256: 'a'.repeat(64), verifiedSha256: 'b'.repeat(64) })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  const checks = validateRunRecord(badArtifact, { evidenceMode: 'local' });
  assert.equal(checks.valid, false);
  assert.ok(checks.errors.some((e) => e.includes('artifact hash mismatch')));
  assert.equal(deriveLevel(badArtifact, { evidenceMode: 'local' }).level, 0);

  // (b) the verifier recomputes the digest from REAL bytes.
  const realBytes = Buffer.from('the actual screenshot bytes');
  const honest = { file: 'qa-artifacts/080/x.png', sha256: createHash('sha256').update(realBytes).digest('hex'), bytes: realBytes.length };
  assert.equal(verifyArtifactBytes(honest, realBytes).ok, true);
  assert.equal(verifyArtifactBytes({ ...honest, sha256: 'c'.repeat(64) }, realBytes).ok, false);
  assert.equal(verifyArtifactBytes(honest, Buffer.from('different bytes entirely')).ok, false);
  assert.equal(verifyArtifactBytes({ ...honest, bytes: 1 }, realBytes).ok, false);

  // (c) a self-asserted pair of equal values proves nothing on its own.
  const selfAsserted = runRecord({
    observations: [gameObs(1, { controls: ['intro', 'start'], sha256: 'a'.repeat(64) })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  // Without an independent computation the record is structurally acceptable
  // but carries NO verified evidence — and in local mode an unverified critical
  // artifact must not certify.
  assert.equal(verifyArtifactBytes(selfAsserted.observations[0].evidenceArtifact, Buffer.from('x')).ok, false);

  // (d) an artifact bound to a DIFFERENT execution attempt is rejected.
  const wrongAttempt = runRecord({
    observations: [gameObs(1, { controls: ['intro', 'start'] })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  wrongAttempt.observations[0].evidenceArtifact.executionAttemptId = 'some-other-attempt';
  const wrongChecks = validateRunRecord(wrongAttempt, { evidenceMode: 'local' });
  assert.equal(wrongChecks.valid, false);
  assert.ok(wrongChecks.errors.some((e) => e.includes('different execution attempt')));

  // (e) a missing artifact on a certification-critical observation is rejected
  // in local runtime certification and explicitly non-certifying elsewhere.
  const noArtifact = runRecord({
    observations: [gameObs(1, { controls: ['intro', 'start'], artifact: false, requireArtifact: true })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  assert.equal(validateRunRecord(noArtifact, { evidenceMode: 'local' }).valid, false);
  const portable = validateRunRecord(noArtifact, { evidenceMode: 'portable' });
  assert.equal(portable.valid, true, 'portable mode must not falsely FAIL absent gitignored evidence');
  assert.ok(portable.notes.some((n) => n.includes('not portable certified evidence')));
});

test('N16: partial or corrupt ledger records fail validation at level 0', () => {
  const good = runRecord({
    observations: [introObs(1)],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  const corruptions = [
    ['missing events[]', (r) => { delete r.events; }, 'missing events[]'],
    ['missing observations[]', (r) => { delete r.observations; }, 'missing observations[]'],
    ['missing buildIdentity.apkSha256', (r) => { delete r.buildIdentity.apkSha256; }, 'missing buildIdentity.apkSha256'],
    ['missing executionAttemptId', (r) => { delete r.executionAttemptId; }, 'missing executionAttemptId'],
  ];
  for (const [label, corrupt, expectedError] of corruptions) {
    const rec = structuredClone(good);
    corrupt(rec);
    const checks = validateRunRecord(rec);
    assert.equal(checks.valid, false, label);
    assert.ok(checks.errors.some((e) => e.includes(expectedError)), label);
    const level = deriveLevel(rec);
    assert.equal(level.level, 0, label);
    assert.match(level.reasons.join(' '), /run record invalid/, label);
  }
});

test('N17: missing device metadata fails validation and awards no level', () => {
  const noDensity = runRecord({
    deviceProfile: deviceProfile({ density: undefined }),
    observations: [introObs(1)],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  let checks = validateRunRecord(noDensity);
  assert.equal(checks.valid, false);
  assert.ok(checks.errors.some((e) => e.includes('missing deviceProfile.density')));
  assert.equal(deriveLevel(noDensity).level, 0);

  const noDevice = runRecord({
    observations: [introObs(1)],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  delete noDevice.deviceProfile;
  checks = validateRunRecord(noDevice);
  assert.equal(checks.valid, false);
  assert.equal(deriveLevel(noDevice).level, 0);
});

test('N18: interrupted execution awards no L3 and leaves safeExit NOT EXECUTED', () => {
  const rec = runRecord({
    observations: [introObs(1), playingObs(2)],
    events: [event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.safeExit.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.sessionEnded.status, AxisStatus.ATTEMPTED);
  assert.equal(axes.resultsCurrent.status, AxisStatus.NOT_EXECUTED);
  const level = deriveLevel(rec);
  assert.equal(level.level, 0);
  assert.ok(level.level < 3);
});

test('N19: unknown game id fails validation and classifies FAILED at level 0', () => {
  const rec = runRecord({
    knownGameId: false,
    observations: [introObs(1)],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  const result = classifyRun(rec);
  assert.equal(result.level, 0);
  assert.equal(result.status, 'FAILED');
  assert.match(result.reasons.join(' '), /unknown game id/);
});

test('N20: or3 preserves tri-state evidence and milestone flips instead of overwriting', () => {
  assert.equal(or3(true, false), true);
  assert.equal(or3(false, false), false);
  assert.equal(or3(null, true), true);
  assert.equal(or3(false, null), null);
  // Order independence: a milestone flip false -> true survives the merge in
  // either direction (the F-080-003 shallow overwrite destroyed it).
  const mergeMilestones = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, or3(a[k], b[k])]));
  const runA = { tutorialCleared: false, started: false, feedbackObserved: false, roundAdvanced: null };
  const runB = { tutorialCleared: true, started: false, feedbackObserved: null, roundAdvanced: true };
  const forward = mergeMilestones(runA, runB);
  const backward = mergeMilestones(runB, runA);
  for (const merged of [forward, backward]) {
    assert.equal(merged.tutorialCleared, true, 'false -> true flip must be preserved');
    assert.equal(merged.started, false, 'two false observations stay false');
    assert.equal(merged.feedbackObserved, null, 'unknown is not coerced to false');
    assert.equal(merged.roundAdvanced, true);
  }
});

// ---------------------------------------------------------------------------
// Positive controls — the minimal honest proofs must be credited.
// ---------------------------------------------------------------------------

test('P1: verified smoke — launch, identity, render and proven safe exit award L1', () => {
  const rec = runRecord({
    observations: [introObs(1), exitedObs(2)],
    events: [
      event(1, { action: 'deeplink', actionAcknowledged: null }),
      event(2, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
    ],
  });
  assert.equal(validateRunRecord(rec).valid, true);
  const level = deriveLevel(rec);
  assert.equal(level.level, 1);
  assert.equal(level.status, 'VERIFIED');
  assert.equal(level.axes.safeExit.status, AxisStatus.VERIFIED);
});

test('P2: accepted gameplay input with an observed response awards L2', () => {
  const rec = runRecord({
    observations: [
      introObs(1),
      playingObs(2, { score: '0' }),
      gameObs(3, { controls: ['stage', 'pause', 'round.1', 'score', 'feedback.correct'], score: '10' }),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  assert.equal(validateRunRecord(rec).valid, true);
  const level = deriveLevel(rec);
  assert.equal(level.level, 2);
  assert.equal(level.status, 'VERIFIED');
  assert.equal(level.axes.inputAccepted.status, AxisStatus.VERIFIED);
  assert.equal(level.axes.feedbackObserved.status, AxisStatus.VERIFIED);
});

test('P3: passive timed gameplay — playing progression without any input awards L2', () => {
  // Two playing observations progress with changed fingerprints and zero
  // tap/type/key input; a timeout transition terminates the session. The
  // interstitial transition frame between gameplay and results keeps the
  // results from being certified current, pinning this fixture at exactly L2
  // through the autonomousGameplayEvent path.
  const rec = runRecord({
    observations: [
      introObs(1),
      playingObs(2, { score: '0' }),
      playingObs(3, { score: '45' }),
      observation(4, { screenMarkers: ['transition-fade'] }),
      resultsObs(5),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'wait', observationBeforeSeq: 3, observationAfterSeq: 5 }),
    ],
  });
  assert.equal(validateRunRecord(rec).valid, true);
  const level = deriveLevel(rec);
  assert.equal(level.axes.autonomousGameplayEvent.status, AxisStatus.VERIFIED);
  assert.equal(level.axes.inputAccepted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(level.axes.sessionEnded.status, AxisStatus.VERIFIED);
  assert.equal(level.level, 2, 'passive progression with session response earns exactly L2');
  assert.equal(level.status, 'VERIFIED');
});

test('P4: L3 completion — gameplay entered, playing -> results transition, results after playing', () => {
  const rec = runRecord({
    observations: [introObs(1), playingObs(2, { score: '0' }), resultsObs(3, { score: '5' })],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  assert.equal(validateRunRecord(rec).valid, true);
  const level = deriveLevel(rec);
  assert.equal(level.level, 3);
  assert.equal(level.status, 'VERIFIED');
  assert.equal(level.axes.sessionEnded.status, AxisStatus.VERIFIED);
  assert.equal(level.axes.resultsCurrent.status, AxisStatus.VERIFIED);
});

test('P5: legitimate terminal failure session is still a verified L3 lifecycle', () => {
  const failureResults = gameObs(3, { controls: ['results', 'result-facts', 'round-failed'], score: '5' });
  const rec = runRecord({
    note: 'terminal failure: ran out of lives',
    observations: [introObs(1), playingObs(2, { score: '0' }), failureResults],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  // The failure semantics are visible in the derived evidence...
  const derived = observeState({ ...failureResults, gameId: GAME_ID });
  assert.equal(derived.state, 'results');
  assert.ok(derived.feedbackMarkers.includes('round-failed'));
  // ...and a run that honestly ends in failure is still a completed lifecycle.
  const level = deriveLevel(rec);
  assert.equal(level.level, 3);
  assert.equal(level.status, 'VERIFIED');
});

test('P6: resilience subcapabilities are independent axes that never fabricate a session', () => {
  // Resilience credited on its own, without any gameplay session.
  const resilienceOnly = runRecord({
    observations: [introObs(1)],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
    resilience: {
      backgroundRelaunch: { verified: true, evidence: ['obs#2'], note: 'relaunched from background with state restored' },
      interruptionRecovery: { verified: false, evidence: ['obs#1'], note: 'attempted, recovery not proven' },
      offlineContinuity: { verified: true, evidence: [], note: 'claimed without evidence' },
    },
  });
  const axes = deriveCapabilities(resilienceOnly);
  assert.equal(axes.backgroundRelaunch.status, AxisStatus.VERIFIED);
  assert.equal(axes.interruptionRecovery.status, AxisStatus.ATTEMPTED);
  assert.equal(axes.offlineContinuity.status, AxisStatus.ATTEMPTED, 'verified without evidence must not be credited');
  assert.equal(deriveLevel(resilienceOnly).level, 0, 'resilience axes must not fabricate a session');

  // Verified resilience unions with a proven session into L4.
  const fullSession = runRecord({
    observations: [introObs(1), playingObs(2, { score: '0' }), resultsObs(3, { score: '5' })],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
    resilience: {
      backgroundRelaunch: { verified: true, evidence: ['evt#3'] },
      offlineContinuity: { verified: true, evidence: ['obs#4'] },
    },
  });
  const level = deriveLevel(fullSession);
  assert.equal(level.level, 4);
  assert.equal(level.axes.backgroundRelaunch.status, AxisStatus.VERIFIED);
  assert.equal(level.axes.offlineContinuity.status, AxisStatus.VERIFIED);
});

// ---------------------------------------------------------------------------
// Regression fixtures — faithful reproductions of historical false positives.
// ---------------------------------------------------------------------------

test('R1: language-word-chain v1 milestones must not classify L2 nor complete L1', () => {
  // Recorded v1 milestones: tutorialSeen true, tutorialCleared FALSE, started
  // FALSE, inputSubmitted TRUE (a tap on the tutorial surface), feedbackObserved
  // false, roundAdvanced false, safeExit claimed without destination proof.
  // The control log shows the tutorial surface persisted through every phase
  // (tutorial-next -> tutorial-chain/options -> tutorial-done).
  const rec = runRecord({
    gameId: 'language-word-chain',
    executionAttemptId: 'attempt-lwc-v1',
    observations: [
      gameObs(1, { observedGameId: 'language-word-chain', controls: ['tutorial', 'tutorial-next'] }),
      gameObs(2, { observedGameId: 'language-word-chain', controls: ['tutorial', 'tutorial-demo-status', 'tutorial-chain', 'option.0', 'option.1', 'option.2'] }),
      gameObs(3, { observedGameId: 'language-word-chain', controls: ['tutorial', 'tutorial-done', 'tutorial-done-lip'] }),
    ],
    events: [
      // The v1 "input submitted" claim: a tap executed on the tutorial surface.
      // Events must bind the run's own executionAttemptId (cross-attempt data is
      // rejected by contract — negative case N13).
      event(1, { executionAttemptId: 'attempt-lwc-v1', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      // The v1 "safeExit" claim: Back sent, but no post-action observation ever
      // showed a destination outside the game screen.
      event(2, { executionAttemptId: 'attempt-lwc-v1', action: 'back', actionAcknowledged: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  assert.equal(validateRunRecord(rec).valid, true);
  const level = deriveLevel(rec);
  const axes = level.axes;
  assert.notEqual(level.level, 2, 'the v1 L2 claim must not survive the corrected contract');
  assert.ok(level.level < 2);
  assert.notEqual(level.level, 1, 'safeExit was claimed without destination proof, so not even complete L1');
  assert.equal(level.status, 'PARTIAL');
  assert.match(level.reasons.join(' '), /safe exit not verified/);
  assert.equal(axes.tutorialCompleted.status, AxisStatus.FAILED);
  assert.equal(axes.gameplayEntered.status, AxisStatus.ATTEMPTED);
  assert.equal(axes.inputAttempted.status, AxisStatus.NOT_EXECUTED, 'a tutorial-surface tap is not gameplay input');
  assert.equal(axes.inputAccepted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.feedbackObserved.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.roundAdvanced.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.safeExit.status, AxisStatus.FAILED);
});

test('R2: memory-pair-recall v1 milestones must not classify L2', () => {
  // Recorded v1 milestones: tutorialSeen true, tutorialCleared TRUE, started
  // TRUE, inputSubmitted FALSE, roundSignals fixed at round.1, feedbackObserved
  // false, roundAdvanced false, safeExit claimed without destination proof.
  const rec = runRecord({
    gameId: 'memory-pair-recall',
    executionAttemptId: 'attempt-mpr-v1',
    observations: [
      gameObs(1, { controls: ['tutorial', 'tutorial-next'] }),
      gameObs(2, { controls: ['intro', 'start', 'difficulty.easy'] }),
      gameObs(3, { controls: ['round.1', 'score', 'pause', 'stage'] }),
      gameObs(4, { controls: ['round.1', 'score', 'pause', 'stage'] }),
    ],
    events: [
      event(1, { executionAttemptId: 'attempt-mpr-v1', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { executionAttemptId: 'attempt-mpr-v1', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
      event(3, { executionAttemptId: 'attempt-mpr-v1', action: 'back', observationBeforeSeq: 3, observationAfterSeq: 3, actionAcknowledged: false }),
    ],
  });
  assert.equal(validateRunRecord(rec).valid, true);
  const level = deriveLevel(rec);
  const axes = level.axes;
  assert.notEqual(level.level, 2, 'started-only runs must not classify L2');
  assert.ok(level.level < 2);
  // Honest milestones are credited...
  assert.equal(axes.tutorialCompleted.status, AxisStatus.VERIFIED);
  assert.equal(axes.gameplayEntered.status, AxisStatus.VERIFIED);
  // ...but nothing that was never proven.
  assert.equal(axes.inputAttempted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.inputAccepted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.autonomousGameplayEvent.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.safeExit.status, AxisStatus.FAILED);
});


// ===========================================================================
// Advance/confirm control policy (Campaign 080, Wave D)
//
// CONFIRMED DEFECT this pins: `math-fast-math` could never exceed L1. The round
// timed out, the feedback overlay rendered `next-problem`, the harness's fixed
// advance-key list did not contain that name, `chooseGameplayAction()` returned
// null, and the loop fell through to its "passive" branch and never tapped
// again — score stayed 0 and no post-input feedback transition was ever
// observed. These tests make that class of stall a red suite instead of a
// device-only discovery.
// ===========================================================================

test('advance control: real catalog names the old literal list missed are recognised', () => {
  // Every name below appears in the recorded 42-game control inventories.
  for (const name of ['next-problem', 'next-trial', 'submit-estimate', 'next-round', 'submit', 'confirm']) {
    assert.equal(isAdvanceControl(name), true, `${name} must be recognised as an advance control`);
  }
});

test('advance control: prefixed and dotted forms are recognised', () => {
  assert.equal(isAdvanceControl('sequence.next'), true);
  assert.equal(isAdvanceControl('tutorial-demo-next'), true);
  assert.equal(isAdvanceControl('round.confirm'), true);
});

test('advance control: decorative -lip overlays are not advance controls', () => {
  // The shared GameButton renders `<base>-lip` above its base control; tapping
  // the overlay is a tap on the base, so the overlay must never be preferred.
  assert.equal(isAdvanceControl('next-problem-lip'), false);
  assert.equal(isAdvanceControl('next-lip'), false);
  assert.equal(isAdvanceControl('submit-lip'), false);
});

test('advance control: answer surfaces are not mistaken for advances', () => {
  for (const name of ['digit.1', 'option.0', 'cell.4', 'tile.2', 'score', 'stage',
    'problem-left', 'feedback', 'feedback-timeout', 'pause', 'screen']) {
    assert.equal(isAdvanceControl(name), false, `${name} must NOT be treated as an advance control`);
  }
});

test('REGRESSION math-fast-math: the timeout overlay yields an advance action', () => {
  // Exact inventory recorded on device when the round timed out.
  const controls = {
    feedback: {}, 'feedback-expected-answer': {}, 'feedback-problem': {},
    'feedback-timeout': {}, 'next-problem': {}, 'next-problem-lip': {},
    pause: {}, 'problem-label.1': {}, score: {}, screen: {}, stage: {},
  };
  assert.equal(pickAdvanceControl(controls), 'next-problem');
});

test('advance control preference: semantic round-advance beats a generic submit', () => {
  assert.equal(pickAdvanceControl({ submit: {}, 'next-round': {} }), 'next-round');
  assert.equal(pickAdvanceControl({ submit: {}, 'next-problem': {} }), 'next-problem');
  assert.equal(pickAdvanceControl({ submit: {}, confirm: {} }), 'submit');
  // The base control wins over its -lip overlay.
  assert.equal(pickAdvanceControl({ 'next-trial-lip': {}, 'next-trial': {} }), 'next-trial');
});

test('advance control: no advance control present returns null (passive is honest)', () => {
  assert.equal(pickAdvanceControl({ 'digit.1': {}, score: {}, pause: {} }), null);
  assert.equal(pickAdvanceControl({}), null);
  assert.equal(pickAdvanceControl(null), null);
  // A key ARRAY is accepted too (the sweep holds both shapes).
  assert.equal(pickAdvanceControl(['digit.1', 'next-round']), 'next-round');
});
