import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  AxisStatus,
  classifyRun,
  deriveCapabilities,
  deriveLevel,
  observeState,
  or3,
  validateRunRecord,
} from './coverage-contract.mjs';

// Adversarial regression suite for the pure QA evidence contract (v2.0).
// The suite exists to prove the harness CANNOT claim gameplay success without
// proving actual gameplay. Every negative fixture reproduces a historical
// false-positive shape or an attack on one evidence axis; every positive
// fixture is the minimal honest proof the contract must credit.

const GAME_ID = 'memory-pair-recall';
const ATTEMPT_ID = 'attempt-fixture-001';

const sha1Of = (label) => createHash('sha1').update(label).digest('hex');

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
// contract derives state from, so fixtures stay self-consistent.
function observation(seq, {
  controls = [], screenMarkers = [], observedGameId, score = '0', boardValues = [],
  sha1, expectedSha1,
} = {}) {
  const derived = observeState({ controls, screenMarkers, gameId: GAME_ID, observedGameId });
  const evidenceArtifact = { sha1: sha1 || sha1Of(`obs-${seq}`) };
  if (expectedSha1 !== undefined) evidenceArtifact.expectedSha1 = expectedSha1;
  const o = { seq, state: derived.state, controls, screenMarkers, score, boardValues, evidenceArtifact };
  if (observedGameId !== undefined) o.observedGameId = observedGameId;
  return o;
}

const gameObs = (seq, extra = {}) => observation(seq, { observedGameId: GAME_ID, ...extra });
const introObs = (seq, extra = {}) => gameObs(seq, { controls: ['intro', 'start'], ...extra });
const playingObs = (seq, extra = {}) => gameObs(seq, { controls: ['stage', 'pause', 'round.1', 'score'], ...extra });
const resultsObs = (seq, extra = {}) => gameObs(seq, { controls: ['results', 'result-facts'], ...extra });
const exitedObs = (seq, extra = {}) => observation(seq, { screenMarkers: ['games-title'], ...extra });

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
  return {
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

test('N15: artifact hash mismatch fails validation and awards no level', () => {
  const badArtifact = runRecord({
    observations: [gameObs(1, { controls: ['intro', 'start'], sha1: 'a'.repeat(40), expectedSha1: 'b'.repeat(40) })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  const checks = validateRunRecord(badArtifact);
  assert.equal(checks.valid, false);
  assert.ok(checks.errors.some((e) => e.includes('artifact hash mismatch')));
  assert.equal(deriveLevel(badArtifact).level, 0);

  const badArtifactList = runRecord({
    observations: [introObs(1)],
    artifacts: [{ sha1: 'a'.repeat(40), expectedSha1: 'c'.repeat(40) }],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  assert.equal(validateRunRecord(badArtifactList).valid, false);
  assert.equal(deriveLevel(badArtifactList).level, 0);
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
