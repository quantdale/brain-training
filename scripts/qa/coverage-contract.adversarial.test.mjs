import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  AxisStatus,
  CausalityVerdict,
  ScreenKind,
  TutorialStatus,
  classifyInputCausality,
  deriveCapabilities,
  deriveLevel,
  deriveScreenKind,
  deriveTutorialStatus,
  observeState,
  validateRunRecord,
  verifyArtifactBytes,
} from './coverage-contract.mjs';

// ===========================================================================
// CAMPAIGN 080 — WAVE A + WAVE C
//
// Mandatory adversarial negative controls for the REPAIRED evidence contract,
// plus mutation controls proving the protections have teeth.
//
// These tests establish the INTENDED SEMANTICS independently: they encode what
// the evidence contract MUST refuse to certify, not merely what the current
// implementation happens to do. Each negative fixture reproduces a confirmed
// historical false-positive shape or an attack on one evidence axis.
// ===========================================================================

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

function observation(seq, {
  controls = [], screenMarkers = [], screenKind, observedGameId, score = '0', boardValues = [],
  controlDetails, sha256, verifiedSha256, artifact = true, phase = 'play', requireArtifact,
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
    timestamp: `2026-10-21T12:00:${String(seq).padStart(2, '0')}Z`,
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
const exitedObs = (seq, extra = {}) =>
  observation(seq, { screenKind: 'app-destination', screenMarkers: ['games-title'], ...extra });
const launcherObs = (seq, extra = {}) =>
  observation(seq, { screenKind: 'launcher', screenMarkers: ['launcher'], ...extra });
const hierarchyFailObs = (seq, extra = {}) =>
  observation(seq, { screenKind: 'hierarchy-failure', screenMarkers: ['hierarchy-failure'], ...extra });
const crashObs = (seq, extra = {}) =>
  observation(seq, { screenKind: 'crash', screenMarkers: ['crash'], ...extra });
const dialogObs = (seq, extra = {}) =>
  observation(seq, { screenKind: 'system-dialog', screenMarkers: ['system-dialog'], ...extra });

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
  for (const o of rec.observations || []) {
    if (o && o.evidenceArtifact && typeof o.evidenceArtifact === 'object' &&
        o.evidenceArtifact.executionAttemptId === ATTEMPT_ID && rec.executionAttemptId !== ATTEMPT_ID) {
      o.evidenceArtifact = { ...o.evidenceArtifact, executionAttemptId: rec.executionAttemptId };
    }
  }
  return rec;
}

// ===========================================================================
// WAVE A (P1-A) — CAUSAL ATTRIBUTION
//
// Confirmed false positive: in `language-word-chain` a tap on `chain-word.2`
// was credited as accepted input + fresh feedback while the observed change
// was a ROUND TIMEOUT. A fingerprint difference alone must never certify input
// acceptance.
// ===========================================================================

function wordChainTimeoutFixture() {
  return runRecord({
    gameId: 'language-word-chain',
    executionAttemptId: 'attempt-lwc-timeout',
    observations: [
      gameObs(1, { observedGameId: 'language-word-chain', controls: ['intro', 'start'] }),
      gameObs(2, { observedGameId: 'language-word-chain', controls: ['stage', 'pause', 'round.1', 'score', 'chain-display', 'chain-word.2'], score: '0' }),
      gameObs(3, {
        observedGameId: 'language-word-chain',
        controls: ['stage', 'pause', 'round.1', 'score', 'chain-display', 'chain-word.2', 'round-timeout', 'round-answer-reveal'],
        score: '0',
      }),
      gameObs(4, { observedGameId: 'language-word-chain', controls: ['results', 'result-facts'], score: '0' }),
    ],
    events: [
      event(1, { executionAttemptId: 'attempt-lwc-timeout', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, {
        executionAttemptId: 'attempt-lwc-timeout', action: 'tap', target: 'language-word-chain.chain-word.2',
        actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3,
      }),
    ],
  });
}

test('A1 (P1-A): an autonomous round timeout inside a tap window is NOT accepted input [Word Chain regression]', () => {
  const rec = wordChainTimeoutFixture();
  const axes = deriveCapabilities(rec);
  assert.equal(axes.inputAccepted.status, AxisStatus.FAILED,
    'a tap whose observed change is a round timeout must never certify input acceptance');
  assert.equal(axes.feedbackObserved.status, AxisStatus.NOT_EXECUTED,
    'a timeout answer-reveal is not post-input answer feedback');
  assert.match(axes.inputCausality.note, /AUTONOMOUS_TIMEOUT/);
  assert.equal(axes.autonomousGameplayEvent.status, AxisStatus.VERIFIED,
    'timeouts must still qualify through the autonomous-gameplay capability, not fabricated tap acceptance');
});

test('A2 (P1-A): causality classification covers every mandated shape', () => {
  const base = (controls, extra = {}) => ({ controls, gameId: GAME_ID, score: '0', ...extra });

  // 1. Input tap followed by unrelated timeout.
  assert.equal(classifyInputCausality({
    target: 'option.1', action: 'tap',
    before: base(['stage', 'pause', 'round.1', 'score']),
    after: base(['stage', 'pause', 'round.1', 'score', 'round-timeout']),
  }).verdict, CausalityVerdict.AUTONOMOUS_TIMEOUT);

  // 2. Tap with no application response.
  assert.equal(classifyInputCausality({
    target: 'option.1', action: 'tap',
    before: base(['stage', 'pause', 'round.1', 'score']),
    after: base(['stage', 'pause', 'round.1', 'score']),
  }).verdict, CausalityVerdict.NO_RESPONSE);

  // 3. Correct tap producing answer feedback.
  const correct = classifyInputCausality({
    target: 'option.1', action: 'tap',
    before: base(['stage', 'pause', 'round.1', 'score'], { score: '0' }),
    after: base(['stage', 'pause', 'round.1', 'score', 'verdict-correct'], { score: '10' }),
  });
  assert.equal(correct.verdict, CausalityVerdict.INPUT_ACCEPTED);
  assert.equal(correct.outcome, 'correct');

  // 4. Incorrect tap producing answer feedback — "accepted" means the app
  //    received and processed the input, not that the answer was right.
  const wrong = classifyInputCausality({
    target: 'option.2', action: 'tap',
    before: base(['stage', 'pause', 'round.1', 'score']),
    after: base(['stage', 'pause', 'round.1', 'score', 'verdict-wrong']),
  });
  assert.equal(wrong.verdict, CausalityVerdict.INPUT_ACCEPTED);
  assert.equal(wrong.outcome, 'incorrect');

  // 5. Tap immediately before timeout (both in one window).
  assert.equal(classifyInputCausality({
    target: 'option.1', action: 'tap',
    before: base(['stage', 'pause', 'round.1', 'score']),
    after: base(['stage', 'pause', 'round.1', 'score', 'round-timeout', 'verdict-correct']),
  }).verdict, CausalityVerdict.AMBIGUOUS_CAUSALITY);

  // 6. Tap after timeout — never accepted.
  assert.notEqual(classifyInputCausality({
    target: 'option.1', action: 'tap',
    before: base(['stage', 'pause', 'round.1', 'score', 'round-timeout']),
    after: base(['stage', 'pause', 'round.1', 'score', 'round-timeout', 'round-answer-reveal']),
  }).verdict, CausalityVerdict.INPUT_ACCEPTED);

  // 8. Action and autonomous transition in the same observation window.
  assert.notEqual(classifyInputCausality({
    target: 'option.1', action: 'tap',
    before: base(['stage', 'pause', 'round.1', 'score']),
    after: base(['stage', 'pause', 'round.2', 'score', 'streak-expired']),
  }).verdict, CausalityVerdict.INPUT_ACCEPTED);
});

test('A3 (P1-A): passive gameplay with no input is credited autonomously, never as taps', () => {
  const rec = runRecord({
    observations: [introObs(1), playingObs(2, { score: '0' }), playingObs(3, { score: '15' }), resultsObs(4, { score: '15' })],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'wait', observationBeforeSeq: 3, observationAfterSeq: 4 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.inputAttempted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.inputAccepted.status, AxisStatus.NOT_EXECUTED);
  assert.equal(axes.autonomousGameplayEvent.status, AxisStatus.VERIFIED);
});

test('A4 (P1-A): a changed fingerprint with NO attributable signal is ambiguous, not accepted', () => {
  const rec = runRecord({
    observations: [
      introObs(1),
      gameObs(2, { controls: ['stage', 'pause', 'round.1', 'score'], score: '0' }),
      gameObs(3, { controls: ['stage', 'pause', 'round.1', 'score', 'stimulus.1'], score: '0' }),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'tap', target: 'memory-pair-recall.card.1', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  assert.equal(deriveCapabilities(rec).inputAccepted.status, AxisStatus.FAILED,
    'fingerprint difference alone must never certify input acceptance');
});

test('A5 (P1-A): target-control identity change IS attributable', () => {
  const rec = runRecord({
    observations: [
      introObs(1),
      gameObs(2, { controls: ['stage', 'pause', 'round.1', 'score', 'card.1'], score: '0', controlDetails: { 'card.1': { text: 'up', desc: '' } } }),
      gameObs(3, { controls: ['stage', 'pause', 'round.1', 'score', 'card.1'], score: '0', controlDetails: { 'card.1': { text: 'up', desc: 'selected' } } }),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'tap', target: 'memory-pair-recall.card.1', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  assert.equal(deriveCapabilities(rec).inputAccepted.status, AxisStatus.VERIFIED);
});

// ===========================================================================
// WAVE A (P1-B) — SAFE EXIT
//
// Confirmed false positive: a failed hierarchy dump parsed to zero game
// controls -> `non-game-app-screen` -> EXITED -> safeExit VERIFIED, while the
// adb input path suppressed its own failure.
// ===========================================================================

test('B1 (P1-B): an empty / failed hierarchy dump is NOT an exit destination', () => {
  const rec = runRecord({
    observations: [introObs(1), hierarchyFailObs(2)],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.safeExit.status, AxisStatus.FAILED,
    'a failed dump must never be read as successful navigation');
});

test('B2 (P1-B): the legacy `non-game-app-screen` mechanism is rejected', () => {
  const legacy = runRecord({
    gameId: 'language-word-chain',
    executionAttemptId: 'attempt-legacy-marker',
    observations: [
      gameObs(1, { observedGameId: 'language-word-chain', controls: ['intro', 'start'] }),
      observation(2, { screenMarkers: ['non-game-app-screen'] }),
    ],
    events: [event(1, { executionAttemptId: 'attempt-legacy-marker', action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.notEqual(deriveCapabilities(legacy).safeExit.status, AxisStatus.VERIFIED,
    'the historical safe-exit false-positive mechanism must be demonstrably rejected');
});

test('B3 (P1-B): crash-to-launcher is not safe navigation', () => {
  const rec = runRecord({
    observations: [introObs(1), crashObs(2), launcherObs(3)],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.notEqual(deriveCapabilities(rec).safeExit.status, AxisStatus.VERIFIED,
    'an app crash or task termination must not be equated with safe navigation');
});

test('B4 (P1-B): launcher-only exit is rejected unless the explicit exit contract allows it', () => {
  const strict = runRecord({
    observations: [introObs(1), launcherObs(2)],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.notEqual(deriveCapabilities(strict).safeExit.status, AxisStatus.VERIFIED,
    'the default exit contract requires a confirmed APP destination');

  const permissive = runRecord({
    observations: [introObs(1), launcherObs(2)],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
    exitContract: { acceptableDestinations: ['app-destination', 'launcher'] },
  });
  assert.equal(deriveCapabilities(permissive).safeExit.status, AxisStatus.VERIFIED,
    'an EXPLICIT exit contract may accept launcher; the default never does');
});

test('B5 (P1-B): a system or permission dialog obscuring the app is not an exit', () => {
  for (const dialog of [
    dialogObs(2),
    observation(2, { screenKind: 'permission-dialog', screenMarkers: ['permission-dialog'] }),
  ]) {
    const rec = runRecord({
      observations: [introObs(1), dialog],
      events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
    });
    assert.notEqual(deriveCapabilities(rec).safeExit.status, AxisStatus.VERIFIED);
  }
});

test('B6 (P1-B): a FAILED adb command is not an executed exit', () => {
  const rec = runRecord({
    observations: [introObs(1), hierarchyFailObs(2)],
    events: [event(1, { action: 'back', actionExecuted: false, actionAcknowledged: false, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.equal(deriveCapabilities(rec).safeExit.status, AxisStatus.NOT_EXECUTED,
    'a command that never executed cannot prove anything');
});

test('B7 (P1-B): Back that only opens Pause does not verify safe exit', () => {
  const rec = runRecord({
    observations: [
      gameObs(1, { controls: ['stage', 'pause', 'round.1', 'score'] }),
      gameObs(2, { controls: ['pause', 'pause-quit', 'pause-resume'] }),
    ],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.equal(deriveCapabilities(rec).safeExit.status, AxisStatus.FAILED);
});

test('B8 (P1-B): quit reaching the expected APP destination verifies safe exit', () => {
  const rec = runRecord({
    observations: [
      gameObs(1, { controls: ['stage', 'pause', 'round.1', 'score'] }),
      gameObs(2, { controls: ['pause', 'pause-quit', 'pause-resume'] }),
      exitedObs(3),
    ],
    events: [
      event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'tap', target: 'memory-pair-recall.quit', actionAcknowledged: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.safeExit.status, AxisStatus.VERIFIED);
  assert.match(axes.safeExit.note, /app-destination/);
});

test('B9 (P1-B): delayed navigation is credited only at the step that proved it', () => {
  const rec = runRecord({
    observations: [introObs(1), introObs(2, { boardValues: ['still-here'] }), exitedObs(3)],
    events: [
      event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  const axes = deriveCapabilities(rec);
  assert.equal(axes.safeExit.status, AxisStatus.VERIFIED);
  assert.equal(axes.safeExit.evidence[0], 'evt#2', 'credit belongs to the step that observed the destination');
});

test('B10 (P1-B): screenshot and hierarchy disagree -> no proven destination', () => {
  const rec = runRecord({
    observations: [introObs(1), exitedObs(2, { artifact: false, requireArtifact: true })],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  const local = validateRunRecord(rec, { evidenceMode: 'local' });
  assert.equal(local.valid, false, 'an unverifiable exit observation must not certify in local runtime mode');
});

test('B11 (P1-B): deriveScreenKind maps every harness signal to the intended semantics', () => {
  const pkg = 'com.braintraining.app';
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: pkg, hierarchyStatus: 'malformed', controlCount: 0 }), ScreenKind.HIERARCHY_FAILURE);
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: pkg, hierarchyStatus: 'adb-failure' }), ScreenKind.ADB_FAILURE);
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: pkg, hierarchyStatus: 'ok', controlCount: 3 }), ScreenKind.GAME_SCREEN);
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: pkg, hierarchyStatus: 'ok', controlCount: 0 }), ScreenKind.APP_DESTINATION);
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: 'com.android.launcher3', hierarchyStatus: 'ok' }), ScreenKind.LAUNCHER);
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: 'com.android.systemui', hierarchyStatus: 'ok' }), ScreenKind.SYSTEM_DIALOG);
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: 'com.android.permissioncontroller', hierarchyStatus: 'ok' }), ScreenKind.PERMISSION_DIALOG);
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: pkg, hierarchyStatus: 'ok', controlCount: 2, appAlive: false }), ScreenKind.CRASH);
  assert.equal(deriveScreenKind({ expectedPackage: pkg, focusPackage: '', hierarchyStatus: 'ok' }), ScreenKind.UNKNOWN);
});

// ===========================================================================
// WAVE A (P1-C) — ARTIFACT INTEGRITY
// ===========================================================================

test('C1 (P1-C): certification-critical observations must be artifact-bound', () => {
  const bare = runRecord({
    observations: [introObs(1, { artifact: false }), exitedObs(2, { artifact: false })],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  const local = validateRunRecord(bare, { evidenceMode: 'local' });
  assert.equal(local.valid, false);
  assert.ok(local.errors.some((e) => e.includes('artifact') || e.includes('evidence')));
});

test('C2 (P1-C): three evidence modes are distinct — local / portable / source', () => {
  const rec = runRecord({
    observations: [introObs(1, { artifact: false }), exitedObs(2, { artifact: false })],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.equal(validateRunRecord(rec, { evidenceMode: 'local' }).valid, false,
    'local runtime certification demands real artifacts');
  const portable = validateRunRecord(rec, { evidenceMode: 'portable' });
  assert.equal(portable.valid, true,
    'portable verification must not falsely FAIL when gitignored native artifacts are absent from a fresh checkout');
  assert.ok(portable.notes.length > 0,
    'portable mode must explicitly report what it could not verify');
  assert.equal(validateRunRecord(rec, { evidenceMode: 'source' }).valid, true,
    'source-level fixture testing treats artifacts as advisory');
});

test('C3 (P1-C): a hash mismatch is caught by independent byte verification', () => {
  const realBytes = Buffer.from('the actual screenshot bytes');
  const honest = { file: 'qa-artifacts/080/x.png', sha256: sha256Of('the actual screenshot bytes'), bytes: realBytes.length };
  assert.equal(verifyArtifactBytes(honest, realBytes).ok, true);
  assert.equal(verifyArtifactBytes({ ...honest, sha256: 'c'.repeat(64) }, realBytes).ok, false);
  assert.equal(verifyArtifactBytes(honest, Buffer.from('different bytes entirely')).ok, false);
  assert.equal(verifyArtifactBytes({ ...honest, bytes: 1 }, realBytes).ok, false);
});

test('C4 (P1-C): an artifact bound to another execution attempt is rejected', () => {
  const rec = runRecord({
    observations: [gameObs(1, { controls: ['intro', 'start'] })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  rec.observations[0].evidenceArtifact.executionAttemptId = 'some-other-attempt';
  const checks = validateRunRecord(rec, { evidenceMode: 'local' });
  assert.equal(checks.valid, false);
  assert.ok(checks.errors.some((e) => e.includes('different execution attempt')));
});

// ===========================================================================
// WAVE B — REGISTRY, MALFORMED INPUT, TUTORIAL SEMANTICS
// ===========================================================================

test('W-B1: an unknown game id cannot certify even when knownGameId is asserted true', () => {
  const registry = new Set([GAME_ID, 'language-word-chain']);
  const spoofed = runRecord({
    gameId: 'totally-made-up-game',
    knownGameId: true,
    observations: [gameObs(1, { observedGameId: 'totally-made-up-game', controls: ['intro', 'start'] })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  const checks = validateRunRecord(spoofed, { knownGames: registry });
  assert.equal(checks.valid, false);
  assert.ok(checks.errors.some((e) => e.includes('authoritative game registry')));
  assert.equal(deriveLevel(spoofed, { knownGames: registry }).level, 0);

  const legit = runRecord({
    observations: [gameObs(1, { controls: ['intro', 'start'] })],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });
  assert.equal(validateRunRecord(legit, { knownGames: registry }).valid, true);
});

test('W-B2: type-corrupt entries yield structured diagnostics, never an uncontrolled crash', () => {
  const good = runRecord({
    observations: [introObs(1)],
    events: [event(1, { action: 'deeplink', actionAcknowledged: null })],
  });

  const eventsObject = structuredClone(good);
  eventsObject.events = { not: 'an array' };
  assert.doesNotThrow(() => validateRunRecord(eventsObject));
  assert.equal(validateRunRecord(eventsObject).valid, false);

  const obsNumber = structuredClone(good);
  obsNumber.observations = 42;
  assert.doesNotThrow(() => validateRunRecord(obsNumber));
  assert.equal(validateRunRecord(obsNumber).valid, false);

  const obsJunk = structuredClone(good);
  obsJunk.observations = [null, 'oops', [1, 2]];
  assert.doesNotThrow(() => validateRunRecord(obsJunk));
  const junk = validateRunRecord(obsJunk);
  assert.equal(junk.valid, false);
  assert.ok(junk.errors.some((e) => e.includes('not an object')));

  const artJunk = structuredClone(good);
  artJunk.artifacts = [{ noDigest: true }, 'bad'];
  assert.doesNotThrow(() => validateRunRecord(artJunk));
  assert.equal(validateRunRecord(artJunk).valid, false);

  const dup = structuredClone(good);
  dup.observations = [introObs(1), introObs(1)];
  const dupCheck = validateRunRecord(dup);
  assert.equal(dupCheck.valid, false);
  assert.ok(dupCheck.errors.some((e) => e.includes('duplicate observation seq')));

  const notAnObject = validateRunRecord('a string, not a run');
  assert.equal(notAnObject.valid, false);
  assert.doesNotThrow(() => validateRunRecord(null));
});

test('W-B3: the authoritative tutorial-completion rule', () => {
  assert.equal(deriveTutorialStatus({ hasTutorial: false }), TutorialStatus.NOT_REQUIRED);
  assert.equal(deriveTutorialStatus({ hasTutorial: true, tutorialObserved: true, tutorialCleared: true }),
    TutorialStatus.COMPLETED_THIS_ATTEMPT);
  assert.equal(deriveTutorialStatus({ hasTutorial: true, tutorialObserved: true, tutorialCleared: false }),
    TutorialStatus.REQUIRED_NOT_CLEARED);
  assert.equal(deriveTutorialStatus({ hasTutorial: true, tutorialState: { previouslyCompleted: true } }),
    TutorialStatus.PREVIOUSLY_COMPLETED);
  assert.equal(deriveTutorialStatus({ hasTutorial: true }), TutorialStatus.UNKNOWN);

  // A returning player must not be forced to repeat a tutorial for QA: a
  // persisted-completed tutorial does not block L2.
  const returning = runRecord({
    hasTutorial: true,
    tutorialState: { previouslyCompleted: true },
    observations: [introObs(1), playingObs(2, { score: '0' }), resultsObs(3, { score: '5' })],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  assert.ok(deriveLevel(returning).level >= 2,
    'a previously-completed tutorial must not block gameplay certification');

  // A tutorial shown and never cleared DOES block gameplay.
  const blocked = runRecord({
    observations: [gameObs(1, { controls: ['tutorial', 'tutorial-next'] }), gameObs(2, { controls: ['tutorial', 'tutorial-done'] })],
    events: [event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  const blockedLevel = deriveLevel(blocked);
  assert.equal(blockedLevel.axes.tutorialCompleted.status, AxisStatus.FAILED,
    'a tutorial that never transitions out is REQUIRED_NOT_CLEARED');
  assert.ok(blockedLevel.level < 2, 'a tutorial shown and never cleared must block L2');
  assert.match(blockedLevel.reasons.join(' '), /tutorial/);

  // By contrast, a tutorial -> playing transition IS clearing the tutorial.
  const cleared = runRecord({
    observations: [gameObs(1, { controls: ['tutorial', 'tutorial-next'] }), playingObs(2, { score: '0' })],
    events: [event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.equal(deriveCapabilities(cleared).tutorialCompleted.status, AxisStatus.VERIFIED);
  assert.equal(deriveTutorialStatus({ hasTutorial: true, tutorialObserved: true, tutorialCleared: true }),
    TutorialStatus.COMPLETED_THIS_ATTEMPT);
});

test('W-C1: multi-run evidence union is never a fabricated journey', () => {
  // Run A proves entry + input. Run B proves a terminal results surface but
  // never proves entry. Nothing in either run is a full session, and no union
  // of them may ever be certified as one.
  const runA = runRecord({
    executionAttemptId: 'attempt-union-a',
    observations: [introObs(1), playingObs(2, { score: '0' }), gameObs(3, { controls: ['stage', 'pause', 'round.2', 'score'], score: '10' }), exitedObs(4)],
    events: [
      event(1, { executionAttemptId: 'attempt-union-a', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { executionAttemptId: 'attempt-union-a', action: 'tap', target: 'memory-pair-recall.card.1', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
      event(3, { executionAttemptId: 'attempt-union-a', action: 'back', actionAcknowledged: true, observationBeforeSeq: 3, observationAfterSeq: 4 }),
    ],
  });
  // Run B reaches a terminal results surface but NEVER proves gameplay entry.
  const runB = runRecord({
    executionAttemptId: 'attempt-union-b',
    observations: [playingObs(1, { score: '0' }), resultsObs(2, { score: '5' }), exitedObs(3)],
    events: [
      event(1, { executionAttemptId: 'attempt-union-b', action: 'wait', observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { executionAttemptId: 'attempt-union-b', action: 'back', actionAcknowledged: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  const levelA = deriveLevel(runA);
  const levelB = deriveLevel(runB);
  assert.equal(levelA.level, 2, 'entry + accepted input + proven exit is genuine L2');
  assert.notEqual(levelA.level, 3, 'entry without completion is not L3');
  assert.equal(levelB.axes.sessionEnded.status, AxisStatus.VERIFIED, 'run B really did reach results');
  assert.notEqual(levelB.level, 3, 'completion without proven entry is not L3');
  // Cross-run union never certifies a journey: that rule is enforced by the
  // merger (see merge-coverage.test.mjs M1 `cross-run-union-not-a-journey`).
});

test('W-C2: a legitimate full-session completion is credited at L3', () => {
  const rec = runRecord({
    scoreSemantics: 'higher-is-better',
    observations: [
      introObs(1),
      playingObs(2, { score: '0' }),
      gameObs(3, { controls: ['stage', 'pause', 'round.2', 'score'], score: '10' }),
      resultsObs(4, { score: '10' }),
      exitedObs(5),
    ],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'tap', target: 'memory-pair-recall.card.1', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 2, observationAfterSeq: 3 }),
      event(3, { action: 'wait', observationBeforeSeq: 3, observationAfterSeq: 4 }),
      event(4, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 4, observationAfterSeq: 5 }),
    ],
  });
  const level = deriveLevel(rec);
  assert.equal(level.level, 3);
  assert.equal(level.status, 'VERIFIED');
  assert.equal(level.axes.safeExit.status, AxisStatus.VERIFIED);
});

test('W-C3: stale results never certify — by order AND by content', () => {
  const stale = runRecord({
    scoreSemantics: 'higher-is-better',
    observations: [resultsObs(1, { score: '99' }), introObs(2), playingObs(3, { score: '0' }), exitedObs(4)],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 3, observationAfterSeq: 4 })],
  });
  assert.notEqual(deriveCapabilities(stale).resultsCurrent.status, AxisStatus.VERIFIED);

  const contradicted = runRecord({
    scoreSemantics: 'higher-is-better',
    observations: [introObs(1), playingObs(2, { score: '50' }), resultsObs(3, { score: '3' })],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'wait', observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  assert.notEqual(deriveCapabilities(contradicted).resultsCurrent.status, AxisStatus.VERIFIED,
    "a results score below this session's observed score belongs to another session");
});

test('W-C4: a lower-is-better score scale is not falsely rejected by score binding', () => {
  const reactionTime = runRecord({
    scoreSemantics: 'lower-is-better',
    observations: [introObs(1), playingObs(2, { score: '420' }), resultsObs(3, { score: '310' })],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
      event(2, { action: 'wait', observationBeforeSeq: 2, observationAfterSeq: 3 }),
    ],
  });
  assert.equal(deriveCapabilities(reactionTime).resultsCurrent.status, AxisStatus.VERIFIED);
});

test('W-C5: a tutorial-only session never certifies gameplay', () => {
  const rec = runRecord({
    observations: [gameObs(1, { controls: ['tutorial', 'tutorial-next'] }), gameObs(2, { controls: ['tutorial', 'tutorial-done'] })],
    events: [event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.ok(deriveLevel(rec).level < 2, 'tutorial-only evidence must never reach L2');
});

// ===========================================================================
// MUTATION CONTROLS — prove the protections have teeth.
//
// Each control re-implements the WEAKENED (pre-repair) rule and asserts that
// the weak rule WOULD have certified the very fixture the real contract
// rejects. If a protection is ever silently removed, the paired real assertion
// fails — and these controls demonstrate the fixtures genuinely discriminate
// strong from weak semantics rather than merely pinning current behaviour.
// ===========================================================================

/** The OLD defective input-acceptance rule: any fingerprint delta counts. */
const WEAK_inputAccepted = (before, after) =>
  JSON.stringify(before.controls) !== JSON.stringify(after.controls) ||
  String(before.score) !== String(after.score);

/** The OLD defective safe-exit rule: any zero-control non-game screen counts. */
const WEAK_safeExit = (after) =>
  (after.controls || []).length === 0 && (after.screenMarkers || []).length > 0;

test('MUTATION 1: weakening causality to fingerprint-delta would wrongly certify the Word Chain timeout', () => {
  const rec = wordChainTimeoutFixture();
  const before = rec.observations[1];
  const after = rec.observations[2];
  assert.equal(WEAK_inputAccepted(before, after), true,
    'the mutated rule must classify this as accepted — that IS the defect');
  assert.equal(deriveCapabilities(rec).inputAccepted.status, AxisStatus.FAILED,
    'the real contract must reject it; if this fails, the causality protection was weakened');
});

test('MUTATION 2: weakening safe-exit to marker shape would wrongly certify a failed dump', () => {
  const failedDump = observation(2, { screenMarkers: ['non-game-app-screen'] });
  assert.equal(WEAK_safeExit(failedDump), true,
    'the mutated rule must classify this as an exit — that IS the defect');
  const rec = runRecord({
    observations: [introObs(1), failedDump],
    events: [event(1, { action: 'back', actionAcknowledged: true, observationBeforeSeq: 1, observationAfterSeq: 2 })],
  });
  assert.notEqual(deriveCapabilities(rec).safeExit.status, AxisStatus.VERIFIED,
    'the real contract must reject it; if this fails, the safe-exit protection was weakened');
});

test('MUTATION 3: self-asserted artifact hashes do not verify — only real bytes do', () => {
  const claimed = { file: 'qa-artifacts/080/x.png', sha256: 'a'.repeat(64), bytes: 3 };
  assert.equal(claimed.sha256 === claimed.sha256, true,
    'self-comparison is vacuous — this is the removed dead `expectedSha1 !== sha1` check');
  assert.equal(verifyArtifactBytes(claimed, Buffer.from('real screenshot bytes')).ok, false,
    'the real verifier must recompute from bytes; if this fails, artifact binding was weakened');
});

test('MUTATION 4: trusting the caller-supplied knownGameId flag would let a fabricated game certify', () => {
  const WEAK_knownGame = (r) => r.knownGameId !== false;
  const spoofed = runRecord({ gameId: 'totally-made-up-game', knownGameId: true });
  assert.equal(WEAK_knownGame(spoofed), true, 'the mutated rule trusts the caller — that IS the defect');
  const registry = new Set([GAME_ID]);
  assert.equal(validateRunRecord(spoofed, { knownGames: registry }).valid, false,
    'the real contract must consult the authoritative registry; if this fails, registry enforcement was weakened');
});

test('MUTATION 5: crediting any new feedback marker would certify a timeout verdict as answer feedback', () => {
  // The OLD feedback rule credited any NEW feedback marker after an input,
  // without asking whether the input was actually accepted.
  const WEAK_feedback = (before, after) => {
    const beforeFb = new Set((before.controls || []).filter((c) => /^(verdict|feedback|correct|incorrect|round-result|round-failed)/.test(c)));
    return (after.controls || []).some((c) => /^(verdict|feedback|correct|incorrect|round-result|round-failed)/.test(c) && !beforeFb.has(c));
  };
  // A round verdict produced by an autonomous timeout, immediately after a tap.
  const before = gameObs(1, { controls: ['stage', 'pause', 'round.1', 'score'], score: '0' });
  const after = gameObs(2, {
    controls: ['stage', 'pause', 'round.1', 'score', 'round-timeout', 'round-failed'],
    score: '0',
  });
  assert.equal(WEAK_feedback(before, after), true,
    'the mutated rule credits the timeout verdict as fresh feedback — that IS the defect');

  const rec = runRecord({
    observations: [introObs(3), before, after],
    events: [
      event(1, { actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 3, observationAfterSeq: 1 }),
      event(2, { action: 'tap', target: 'memory-pair-recall.card.1', actionAcknowledged: true, transitionValid: true, observationBeforeSeq: 1, observationAfterSeq: 2 }),
    ],
  });
  assert.notEqual(deriveCapabilities(rec).feedbackObserved.status, AxisStatus.VERIFIED,
    'the real contract must attribute feedback to an ACCEPTED input only; if this fails, that linkage was weakened');
});
