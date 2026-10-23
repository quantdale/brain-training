import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  AxisStatus,
  CausalityVerdict,
  ScreenKind,
  classifyInputCausality,
  deriveCapabilities,
  deriveLevel,
  deriveTutorialStatus,
  deriveScreenKind,
  observeState,
  validateRunRecord,
} from '../scripts/qa/coverage-contract.mjs';
import {
  EvidenceMode,
  hierarchyIsEmpty,
  verifyArtifactLedger,
  sniffHierarchy,
  resolveArtifactPath,
} from '../scripts/qa/artifact-integrity.mjs';

const root = path.resolve(process.cwd());
const scratch = path.join(root, 'review-scratch');
const fixtures = path.join(scratch, 'fixtures');
fs.mkdirSync(fixtures, { recursive: true });

const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
const build = (suffix = 'a') => ({
  gitSha: suffix.repeat(40),
  apkSha256: suffix.repeat(64),
  packageName: 'com.braintraining.app',
  versionName: '1.0.0',
  versionCode: 1000,
});
const device = { serial: 'emulator-5554', model: 'test', abi: 'x86_64', display: '1080x1920', density: '420' };
const ts = (n) => `2026-10-23T00:00:${String(n).padStart(2, '0')}.000Z`;

function obs(seq, controls, extra = {}) {
  return { seq, timestamp: ts(seq), phase: extra.phase || 'play', controls, observedGameId: 'memory-pair-recall', score: extra.score ?? '0', ...extra };
}
function ev(seq, before, after, extra = {}) {
  return { seq, action: extra.action || 'tap', target: extra.target, actionRequested: true, actionExecuted: extra.actionExecuted ?? true, actionAcknowledged: extra.actionAcknowledged ?? null, executionAttemptId: extra.executionAttemptId || 'probe-attempt', timestamp: ts(seq), observationBeforeSeq: before, observationAfterSeq: after, ...extra };
}
function record(overrides = {}) {
  return { executionAttemptId: 'probe-attempt', gameId: 'memory-pair-recall', buildIdentity: build(), deviceProfile: device, startedAt: ts(0), events: [], observations: [], ...overrides };
}
function print(label, value) {
  console.log(`\n[${label}]`);
  console.log(JSON.stringify(value, null, 2));
}

// 1. A failed tap is still accepted if a coincidental score/feedback change
// occurs: deriveCapabilities never filters playing input events by
// actionExecuted/actionAcknowledged.
const failedTap = record({
  observations: [
    obs(1, ['intro', 'start']),
    obs(2, ['stage', 'pause', 'round.1', 'score', 'option.1']),
    obs(3, ['stage', 'pause', 'round.1', 'score', 'option.1', 'verdict-correct'], { score: '10' }),
  ],
  events: [
    ev(1, 1, 2, { action: 'tap', target: 'memory-pair-recall.start', actionAcknowledged: true }),
    ev(2, 2, 3, { action: 'tap', target: 'memory-pair-recall.option.1', actionExecuted: false, actionAcknowledged: false }),
  ],
});
const failedTapAxes = deriveCapabilities(failedTap);
print('failed-tap-input', {
  classify: classifyInputCausality({ target: 'option.1', action: 'tap', before: failedTap.observations[1], after: failedTap.observations[2] }),
  inputAccepted: failedTapAxes.inputAccepted,
  feedbackObserved: failedTapAxes.feedbackObserved,
});

const timeoutWindow = record({
  observations: [
    obs(1, ['intro', 'start']),
    obs(2, ['stage', 'pause', 'round.1', 'option.1']),
    obs(3, ['stage', 'pause', 'round.1', 'option.1', 'round-timeout', 'round-answer-reveal']),
  ],
  events: [
    ev(1, 1, 2, { action: 'tap', target: 'memory-pair-recall.start', actionAcknowledged: true }),
    ev(2, 2, 3, { action: 'tap', target: 'memory-pair-recall.option.1', actionAcknowledged: true }),
  ],
});
const timeoutAxes = deriveCapabilities(timeoutWindow);
print('timeout-window-attribution', {
  classify: classifyInputCausality({ target: 'option.1', before: timeoutWindow.observations[1], after: timeoutWindow.observations[2], action: 'tap' }),
  inputAccepted: timeoutAxes.inputAccepted,
  autonomousGameplayEvent: timeoutAxes.autonomousGameplayEvent,
});

// 2. A tutorial-like surface with no literal `tutorial` test id is classified
// as PLAYING by the special-case branch and can reach L2.
const masquerade = record({
  observations: [
    obs(1, ['intro', 'start']),
    obs(2, ['pause', 'stage', 'round.1', 'score', 'demo-status']),
    obs(3, ['pause', 'stage', 'round.1', 'score', 'demo-status', 'verdict-correct'], { score: '10' }),
  ],
  events: [
    ev(1, 1, 2, { action: 'tap', target: 'memory-pair-recall.start', actionAcknowledged: true }),
    ev(2, 2, 3, { action: 'tap', target: 'memory-pair-recall.option.1', actionAcknowledged: true }),
  ],
});
print('tutorial-masquerade', {
  observedState: observeState({ ...masquerade.observations[1], gameId: masquerade.gameId }),
  level: deriveLevel(masquerade).level,
  gameplayEntered: deriveCapabilities(masquerade).gameplayEntered,
});
const tutorialMetadataOnly = { ...masquerade, hasTutorial: true, tutorialState: { previouslyCompleted: false } };
print('tutorial-status-not-wired', {
  derivedTutorialStatus: deriveTutorialStatus({ hasTutorial: true, tutorialState: { previouslyCompleted: false }, tutorialObserved: false, tutorialCleared: false }),
  levelFromSameRecord: deriveLevel(tutorialMetadataOnly).level,
  tutorialObservedAxis: deriveCapabilities(tutorialMetadataOnly).tutorialObserved,
  tutorialCompletedAxis: deriveCapabilities(tutorialMetadataOnly).tutorialCompleted,
});

// 3. A forged `screenKind` is trusted over raw controls/markers. An executed
// Back from an already-exited destination also satisfies safeExit because the
// before-state is only checked for UNKNOWN, not for a game/intro surface.
const forgedExit = record({
  observations: [
    obs(1, ['intro', 'start']),
    { seq: 2, timestamp: ts(2), phase: 'play', controls: [], screenMarkers: [], screenKind: ScreenKind.APP_DESTINATION },
    { seq: 3, timestamp: ts(3), phase: 'play', controls: [], screenMarkers: [], screenKind: ScreenKind.APP_DESTINATION },
  ],
  events: [ev(1, 2, 3, { action: 'back', actionAcknowledged: true })],
});
print('forged-safe-exit', {
  states: forgedExit.observations.map((o) => observeState({ ...o, gameId: forgedExit.gameId }).state),
  safeExit: deriveCapabilities(forgedExit).safeExit,
  level: deriveLevel(forgedExit).level,
  validation: validateRunRecord(forgedExit),
});
const failedExit = structuredClone(forgedExit);
failedExit.events[0].actionExecuted = false;
failedExit.events[0].actionAcknowledged = false;
print('failed-command-safe-exit', {
  safeExit: deriveCapabilities(failedExit).safeExit,
  level: deriveLevel(failedExit).level,
});
const dialogLabelledExit = structuredClone(forgedExit);
dialogLabelledExit.observations[2].screenMarkers = ['system-dialog'];
print('dialog-marker-overridden-by-screen-kind', {
  safeExit: deriveCapabilities(dialogLabelledExit).safeExit,
  after: observeState({ ...dialogLabelledExit.observations[2], gameId: dialogLabelledExit.gameId }),
});

// 4. The pure verifier catches explicit malformed/empty status, but the
// harness-side detector only checks for the literal substring `<node`.
print('hierarchy-shapes', {
  empty: hierarchyIsEmpty(Buffer.from('<hierarchy/>')),
  truncatedLooksLikeHierarchy: sniffHierarchy(Buffer.from('<hierarchy><node')),
  staleHierarchyWithExpectedFocus: deriveScreenKind({ expectedPackage: 'com.braintraining.app', focusPackage: 'com.braintraining.app/Main', hierarchyStatus: 'ok', controlCount: 0, appAlive: true }),
  explicitMalformedStatus: deriveScreenKind({ expectedPackage: 'com.braintraining.app', focusPackage: 'com.braintraining.app/Main', hierarchyStatus: 'malformed', controlCount: 0, appAlive: true }),
  emptyStatus: deriveScreenKind({ expectedPackage: 'com.braintraining.app', focusPackage: 'com.braintraining.app/Main', hierarchyStatus: 'empty', controlCount: 0, appAlive: true }),
});

// 4b. Explicit system-dialog, launcher, and crash classifications are safe
// outcomes, but they only cover the package names known to the contract.
print('system-dialog-and-crash', {
  system: deriveScreenKind({ expectedPackage: 'com.braintraining.app', focusPackage: 'com.android.systemui/.SystemUI', hierarchyStatus: 'ok', controlCount: 0, appAlive: true }),
  permission: deriveScreenKind({ expectedPackage: 'com.braintraining.app', focusPackage: 'com.google.android.permissioncontroller/.GrantPermissionsActivity', hierarchyStatus: 'ok', controlCount: 0, appAlive: true }),
  launcher: deriveScreenKind({ expectedPackage: 'com.braintraining.app', focusPackage: 'com.google.android.apps.nexuslauncher/.NexusLauncherActivity', hierarchyStatus: 'ok', controlCount: 0, appAlive: true }),
  crash: deriveScreenKind({ expectedPackage: 'com.braintraining.app', focusPackage: 'com.braintraining.app/Main', hierarchyStatus: 'ok', controlCount: 0, appAlive: false }),
  unknownPackage: deriveScreenKind({ expectedPackage: 'com.braintraining.app', focusPackage: 'com.oem.dialog/.Dialog', hierarchyStatus: 'ok', controlCount: 0, appAlive: true }),
});

// 5. Parseable type-corrupt records crash deriveLevel/merge after validation
// has already identified the bad shape.
const corrupt = record({ events: {}, observations: [] });
let corruptOutcome;
try { corruptOutcome = { value: deriveLevel(corrupt) }; } catch (e) { corruptOutcome = { name: e.name, message: e.message }; }
print('type-corrupt-derive-level', corruptOutcome);

// 5b. A result with a higher score than the playing maximum remains current
// when scoreSemantics is absent; and a failed entry/session action is not
// filtered from the capability axes.
const staleResult = record({
  observations: [
    obs(1, ['intro', 'start']),
    obs(2, ['stage', 'pause', 'round.1', 'score', 'option.1'], { score: '5' }),
    obs(3, ['results', 'score'], { score: '99' }),
  ],
  events: [
    ev(1, 1, 2, { action: 'tap', target: 'memory-pair-recall.start', actionExecuted: false, actionAcknowledged: false }),
    ev(2, 2, 3, { action: 'back', actionExecuted: false, actionAcknowledged: false }),
  ],
});
print('stale-results-and-failed-actions', {
  noScoreSemantics: deriveCapabilities(staleResult),
  higherIsBetter: deriveCapabilities({ ...staleResult, scoreSemantics: 'higher-is-better' }),
});

const duplicateEventSeq = structuredClone(masquerade);
duplicateEventSeq.events.push(structuredClone(duplicateEventSeq.events[1]));
print('duplicate-event-seq', {
  eventSeqs: duplicateEventSeq.events.map((e) => e.seq),
  validation: validateRunRecord(duplicateEventSeq),
  level: deriveLevel(duplicateEventSeq).level,
});

// 6. The artifact verifier accepts a non-empty, structurally empty run as a
// PASS, and the CLI therefore has a zero-exit path with no evidence inspected.
const emptyRun = { executionAttemptId: 'empty-run', gameId: 'made-up-game', buildIdentity: build(), deviceProfile: device, events: [], observations: [] };
print('empty-run-artifact-verifier', verifyArtifactLedger([emptyRun], { mode: EvidenceMode.LOCAL, repoRoot: root }));

// 7. Artifact bytes have no build identity. A one-run ledger can relabel
// evidence from build A as build B and still pass every artifact check.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const xml = Buffer.from('<hierarchy><node resource-id="memory-pair-recall" /></hierarchy>');
const pngPath = path.join(fixtures, 'cross-build.png');
const xmlPath = path.join(fixtures, 'cross-build.xml');
fs.writeFileSync(pngPath, png);
fs.writeFileSync(xmlPath, xml);
const truncatedXml = Buffer.from('<hierarchy><node');
const truncatedXmlPath = path.join(fixtures, 'truncated.xml');
fs.writeFileSync(truncatedXmlPath, truncatedXml);
const signatureOnlyPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const signatureOnlyPngPath = path.join(fixtures, 'signature-only.png');
fs.writeFileSync(signatureOnlyPngPath, signatureOnlyPng);
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const artifactRun = (attemptId, b) => ({
  executionAttemptId: attemptId, gameId: 'made-up-game', buildIdentity: b, deviceProfile: device,
  events: [], observations: [
    { seq: 0, phase: 'launch', timestamp: ts(0), controls: [], evidenceArtifact: { file: rel(pngPath), sha256: hash(png), bytes: png.length, kind: 'screenshot', executionAttemptId: attemptId } },
    { seq: 1, phase: 'terminal', timestamp: ts(1), controls: [], evidenceArtifact: { file: rel(xmlPath), sha256: hash(xml), bytes: xml.length, kind: 'hierarchy', executionAttemptId: attemptId } },
  ],
});
print('relabelled-cross-build-artifact', {
  sourceBuildClaim: 'artifact bytes were captured under build A; ledger claims build B',
  result: verifyArtifactLedger([artifactRun('relabelled', build('b'))], { mode: EvidenceMode.LOCAL, repoRoot: root }),
});

// 8. Windows path case aliases bypass per-file reuse detection.
const samePathA = rel(pngPath);
const samePathB = samePathA.toUpperCase();
const reuseA = artifactRun('reuse-a', build('a'));
const reuseB = artifactRun('reuse-b', build('a'));
for (const o of reuseA.observations) o.evidenceArtifact.file = o.evidenceArtifact.file;
for (const o of reuseB.observations) o.evidenceArtifact.file = o.evidenceArtifact.file.replace(rel(xmlPath), samePathB).replace(rel(pngPath), samePathB);
// Keep only one observation per run so the two citations are the same physical PNG.
reuseA.observations = [reuseA.observations[0]];
reuseB.observations = [reuseB.observations[0]];
reuseB.observations[0].evidenceArtifact.file = samePathB;
print('case-aliased-cross-attempt-reuse', {
  pathA: resolveArtifactPath(samePathA, root),
  pathB: resolveArtifactPath(samePathB, root),
  result: verifyArtifactLedger([reuseA, reuseB], { mode: EvidenceMode.LOCAL, repoRoot: root }),
});
const copiedPngPath = path.join(fixtures, 'cross-build-copy.png');
fs.copyFileSync(pngPath, copiedPngPath);
const copiedA = artifactRun('copy-a', build('a'));
const copiedB = artifactRun('copy-b', build('a'));
copiedA.observations = [copiedA.observations[0]];
copiedB.observations = [copiedB.observations[0]];
copiedB.observations[0].evidenceArtifact.file = rel(copiedPngPath);
print('copied-cross-attempt-reuse', verifyArtifactLedger([copiedA, copiedB], { mode: EvidenceMode.LOCAL, repoRoot: root }));

// Persist CLI fixtures for exact process-exit probes.
const write = (name, value) => { const p = path.join(fixtures, name); fs.writeFileSync(p, JSON.stringify(value, null, 2)); return p; };
write('empty-run.json', { runs: [emptyRun] });
write('empty-plus-null.json', { runs: [emptyRun, null] });
write('empty-array.json', []);
write('malformed-top-level.json', { notRuns: true });
write('primitive-entry.json', { runs: [42] });
write('corrupt-run.json', { schemaVersion: 2, runs: [corrupt] });
write('unknown-merge.json', { schemaVersion: 2, runs: [emptyRun] });
const dup = {
  executionAttemptId: 'duplicate-attempt', gameId: 'memory-pair-recall', buildIdentity: build(), deviceProfile: device, startedAt: ts(0), events: [ev(1, 1, 2, { action: 'back', actionAcknowledged: true, executionAttemptId: 'duplicate-attempt' })],
  observations: [obs(1, ['intro', 'start']), { seq: 2, timestamp: ts(2), phase: 'play', controls: [], screenKind: 'app-destination' }],
};
write('duplicate-merge.json', { schemaVersion: 2, runs: [dup, structuredClone(dup)] });
const unionValid = record({
  executionAttemptId: 'union-valid',
  observations: [
    obs(1, ['intro', 'start']),
    obs(2, ['stage', 'pause', 'round.1', 'option.1'], { score: '0' }),
    obs(3, ['stage', 'pause', 'round.1', 'option.1', 'verdict-correct'], { score: '1' }),
  ],
  events: [
    ev(1, 1, 2, { action: 'tap', target: 'memory-pair-recall.start', actionAcknowledged: true, executionAttemptId: 'union-valid' }),
    ev(2, 2, 3, { action: 'tap', target: 'memory-pair-recall.option.1', actionAcknowledged: true, executionAttemptId: 'union-valid' }),
  ],
});
const unionInvalid = structuredClone(unionValid);
unionInvalid.executionAttemptId = 'union-invalid';
unionInvalid.events = unionInvalid.events.map((e) => ({ ...e, executionAttemptId: 'union-invalid' }));
delete unionInvalid.deviceProfile.serial;
write('invalid-axis-union.json', { schemaVersion: 2, runs: [unionValid, unionInvalid] });
const resultsOnly = record({
  executionAttemptId: 'results-only',
  observations: [
    obs(1, ['stage', 'pause', 'round.1', 'score'], { score: '0' }),
    obs(2, ['results', 'score'], { score: '0' }),
  ],
  events: [
    ev(1, 1, 2, { action: 'wait', target: null, actionAcknowledged: true, executionAttemptId: 'results-only' }),
  ],
});
write('cross-run-complement.json', { schemaVersion: 2, runs: [unionValid, resultsOnly] });
const validArtifact = artifactRun('cli-valid', build('a'));
write('valid-artifact.json', { runs: [validArtifact] });
write('duplicate-artifact.json', { runs: [validArtifact, structuredClone(validArtifact)] });
write('relabelled-cross-build.json', { runs: [artifactRun('relabelled-cli', build('b'))] });
const truncatedArtifact = artifactRun('truncated-hierarchy', build('a'));
truncatedArtifact.observations[1].evidenceArtifact = {
  file: rel(truncatedXmlPath), bytes: truncatedXml.length, sha256: hash(truncatedXml), kind: 'hierarchy', executionAttemptId: 'truncated-hierarchy',
};
write('truncated-hierarchy.json', { runs: [truncatedArtifact] });
const signatureOnlyArtifact = artifactRun('signature-only-png', build('a'));
signatureOnlyArtifact.observations[0].evidenceArtifact = {
  file: rel(signatureOnlyPngPath), bytes: signatureOnlyPng.length, sha256: hash(signatureOnlyPng), kind: 'screenshot', executionAttemptId: 'signature-only-png',
};
write('signature-only-png.json', { runs: [signatureOnlyArtifact] });
const mismatch = structuredClone(validArtifact);
mismatch.observations[0].evidenceArtifact.sha256 = 'f'.repeat(64);
write('hash-mismatch.json', { runs: [mismatch] });
const missing = structuredClone(validArtifact);
missing.observations[0].evidenceArtifact.file = rel(path.join(fixtures, 'does-not-exist.png'));
write('missing-artifact.json', { runs: [missing] });
write('case-alias-reuse.json', { runs: [reuseA, reuseB] });
write('copied-cross-attempt.json', { runs: [copiedA, copiedB] });
const reused = structuredClone(validArtifact);
reused.executionAttemptId = 'cli-reuse';
reused.observations = reused.observations.map((o) => ({ ...o, evidenceArtifact: { ...o.evidenceArtifact, executionAttemptId: 'cli-reuse' } }));
const owner = structuredClone(validArtifact);
write('cross-attempt-reuse.json', { runs: [validArtifact, reused] });
const mixed = structuredClone(validArtifact);
mixed.executionAttemptId = 'cli-mixed';
mixed.buildIdentity = build('c');
mixed.observations = mixed.observations.map((o) => ({ ...o, evidenceArtifact: { ...o.evidenceArtifact, executionAttemptId: 'cli-mixed', file: o.evidenceArtifact.file.replace('cross-build', 'mixed-build') } }));
const mixedPng = path.join(fixtures, 'mixed-build.png');
const mixedXml = path.join(fixtures, 'mixed-build.xml');
fs.copyFileSync(pngPath, mixedPng); fs.copyFileSync(xmlPath, mixedXml);
write('mixed-build.json', { runs: [validArtifact, mixed] });

console.log(`\nfixtures=${fixtures}`);
