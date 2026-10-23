import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  captureArtifact,
  dumpHierarchy,
  hierarchyStatus,
  parseHierarchyGameData,
  queryTutorialStateFromDatabaseBytes,
  readTutorialStateFromDatabaseBytes,
  tutorialDatabaseReadCommand,
  tutorialStateFromPersistedRow,
  bindBuildIdentityToManifest,
  writeCaptureReceiptIndex,
} from './native-game-sweep.mjs';
import { loadBuildManifest } from './artifact-integrity.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const requireFromMobile = createRequire(path.join(REPO_ROOT, 'apps/mobile/package.json'));
const BetterSqlite3 = requireFromMobile('better-sqlite3');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const repoTempDir = (prefix) => {
  const root = path.join(REPO_ROOT, 'qa-artifacts', '080');
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, prefix));
};

test('hierarchyStatus accepts only a complete hierarchy document with nodes', () => {
  assert.equal(hierarchyStatus('<hierarchy rotation="0"><node resource-id="game" /></hierarchy>'), 'ok');
  assert.equal(hierarchyStatus('<hierarchy/>'), 'empty');
  assert.equal(hierarchyStatus(''), 'empty');
  assert.equal(hierarchyStatus('<hierarchy><node'), 'malformed');
  assert.equal(hierarchyStatus('<other><node /></other>'), 'malformed');
  assert.equal(hierarchyStatus('<!DOCTYPE hierarchy><hierarchy><node /></hierarchy>'), 'malformed');
});

test('dumpHierarchy deletes before every acquisition and never returns stale XML after command failure', () => {
  const calls = [];
  const xml = '<hierarchy><node resource-id="fresh" /></hierarchy>';
  const result = dumpHierarchy('emulator-5554', (_serial, command) => {
    calls.push(command);
    if (command[1] === 'cat') return xml;
    return '';
  });
  assert.equal(result, xml);
  assert.deepEqual(calls.map((command) => command.slice(1, 3)), [['rm', '-f'], ['uiautomator', 'dump'], ['cat', '/sdcard/bt-sweep-dump.xml']]);

  const staleCalls = [];
  const failedRemoval = dumpHierarchy('emulator-5554', (_serial, command) => {
    staleCalls.push(command);
    if (command[1] === 'rm') throw new Error('could not invalidate prior hierarchy');
    return '<hierarchy><node resource-id="stale" /></hierarchy>';
  });
  assert.equal(failedRemoval, '');
  assert.equal(staleCalls.length, 1, 'dump/cat must not proceed if the stale path was not removed');

  const failedDumpCalls = [];
  const failedDump = dumpHierarchy('emulator-5554', (_serial, command) => {
    failedDumpCalls.push(command);
    if (command[1] === 'uiautomator') throw new Error('dump failed');
    return '<hierarchy><node resource-id="stale" /></hierarchy>';
  });
  assert.equal(failedDump, '');
  assert.equal(failedDumpCalls.length, 2, 'cat must not run after a failed dump');

  const failedCat = dumpHierarchy('emulator-5554', (_serial, command) => {
    if (command[1] === 'cat') throw new Error('cat failed');
    return '';
  });
  assert.equal(failedCat, '');
});

test('persisted tutorial facts distinguish completion, replay, version drift, and unavailable reads', () => {
  assert.equal(tutorialStateFromPersistedRow(null).previouslyCompleted, false, 'a successful empty query is first-play, not prior completion');
  assert.equal(tutorialStateFromPersistedRow({ completed: 1, replay_requested: 0, version: '1.0.0' }).previouslyCompleted, true);
  assert.equal(tutorialStateFromPersistedRow({ completed: 0, replay_requested: 0, version: '1.0.0' }).previouslyCompleted, false);
  assert.equal(tutorialStateFromPersistedRow({ completed: 1, replay_requested: 1, version: '1.0.0' }).previouslyCompleted, false);
  assert.equal(tutorialStateFromPersistedRow({ completed: 1, replay_requested: 0, version: '0.9.0' }).previouslyCompleted, false);
  assert.equal(tutorialStateFromPersistedRow({ completed: '1', replay_requested: 0, version: '1.0.0' }), null);
});

test('SQLite snapshot reader uses the persisted tutorial_state row and returns unknown on corrupt input', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt080-sweep-db-test-'));
  const source = path.join(dir, 'source.db');
  let db;
  try {
    db = new BetterSqlite3(source);
    db.exec('CREATE TABLE tutorial_state (game_id TEXT PRIMARY KEY, completed INTEGER NOT NULL, replay_requested INTEGER NOT NULL, version TEXT, updated_at INTEGER NOT NULL)');
    db.prepare('INSERT INTO tutorial_state VALUES (?, ?, ?, ?, ?)').run('memory-pair-recall', 1, 0, '1.0.0', 1234);
    db.prepare('INSERT INTO tutorial_state VALUES (?, ?, ?, ?, ?)').run('other-game', 0, 0, '1.0.0', 1235);
    const snapshot = fs.readFileSync(source);
    assert.deepEqual(readTutorialStateFromDatabaseBytes(snapshot, null, 'memory-pair-recall', dir), {
      previouslyCompleted: true, completed: true, replayRequested: false, version: '1.0.0', source: 'tutorial_state',
    });
    assert.deepEqual(queryTutorialStateFromDatabaseBytes(snapshot, null, 'memory-pair-recall', dir), {
      table: 'tutorial_state',
      columns: ['game_id', 'completed', 'replay_requested', 'version', 'updated_at'],
      where: { game_id: 'memory-pair-recall' },
      row: { game_id: 'memory-pair-recall', completed: 1, replay_requested: 0, version: '1.0.0', updated_at: 1234 },
    });
    assert.equal(readTutorialStateFromDatabaseBytes(snapshot, null, 'new-game', dir).previouslyCompleted, false);
    assert.equal(readTutorialStateFromDatabaseBytes(Buffer.from('not sqlite'), null, 'memory-pair-recall', dir), null);
  } finally {
    try { db?.close(); } catch { /* test cleanup */ }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('persisted tutorial DB access uses root file reads or run-as only for confirmed debug builds', () => {
  assert.deepEqual(tutorialDatabaseReadCommand('0', false, 'brain-training.db'), [
    'exec-out', 'cat', '/data/user/0/com.braintraining.app/files/SQLite/brain-training.db',
  ]);
  assert.deepEqual(tutorialDatabaseReadCommand('2000', true, 'brain-training.db-wal'), [
    'exec-out', 'run-as', 'com.braintraining.app', 'cat', 'files/SQLite/brain-training.db-wal',
  ]);
  assert.equal(tutorialDatabaseReadCommand('2000', false, 'brain-training.db'), null,
    'non-root, non-debuggable release remains UNKNOWN instead of invoking a failing run-as');
});

test('complete app-input manifest validates APK identity and every tracked apps/mobile file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-build-manifest-'));
  const relativeFiles = [
    'apps/mobile/app.json', 'apps/mobile/package.json', 'apps/mobile/package-lock.json',
    'apps/mobile/assets/icon.png', 'apps/mobile/src/app.ts', 'apps/mobile/metro.config.js',
    'apps/mobile/tsconfig.json', 'apps/mobile/plugins/withExample.js',
  ];
  const inputs = new Map(relativeFiles.map((file) => [file, Buffer.from(`input:${file}`)]));
  const apkFile = 'qa-artifacts/080/final-convergence/releases/test.apk';
  const apkBytes = Buffer.from('packaged test APK');
  const manifestFile = path.join(dir, 'qa-artifacts', '080', 'final-convergence', 'native-source-inputs-02-complete.json');
  const sourceSha = '22ae2f7c'.padEnd(40, '0');
  const writeManifest = (files = relativeFiles.map((file) => ({ file, sha256: hash(inputs.get(file)) }))) => {
    fs.writeFileSync(manifestFile, JSON.stringify({
      sourceSha, trackedStatus: '', inputPolicy: 'all-tracked-app-files-v1', buildType: 'test release',
      apk: { file: apkFile, bytes: apkBytes.length, sha256: hash(apkBytes) }, files,
    }));
  };
  try {
    for (const [file, bytes] of inputs) {
      const absolute = path.join(dir, ...file.split('/'));
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, bytes);
    }
    const absoluteApk = path.join(dir, ...apkFile.split('/'));
    fs.mkdirSync(path.dirname(absoluteApk), { recursive: true });
    fs.writeFileSync(absoluteApk, apkBytes);
    execFileSync('git', ['init', '--quiet'], { cwd: dir });
    execFileSync('git', ['add', ...relativeFiles], { cwd: dir });
    writeManifest();

    const manifest = loadBuildManifest(manifestFile, dir);
    assert.equal(manifest.sourceSha, sourceSha);
    assert.equal(manifest.apkSha256, hash(apkBytes));
    assert.equal(manifest.apkBytes, apkBytes.length);
    assert.equal(manifest.inputCount, relativeFiles.length);
    assert.equal(manifest.inputPolicy, 'all-tracked-app-files-v1');
    const identity = bindBuildIdentityToManifest({ packageName: 'com.braintraining.app', apkSha256: manifest.apkSha256 }, manifest);
    assert.equal(identity.gitSha, manifest.sourceSha, 'build source SHA comes from the manifest, not harness HEAD');
    assert.throws(() => bindBuildIdentityToManifest({ apkSha256: 'f'.repeat(64) }, manifest), /installed APK digest does not match/);

    writeManifest(relativeFiles.slice(1).map((file) => ({ file, sha256: hash(inputs.get(file)) })));
    assert.throws(() => loadBuildManifest(manifestFile, dir), /app input coverage is incomplete/);
    const withoutPolicy = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    delete withoutPolicy.inputPolicy;
    fs.writeFileSync(manifestFile, JSON.stringify(withoutPolicy));
    assert.throws(() => loadBuildManifest(manifestFile, dir), /inputPolicy all-tracked-app-files-v1/);
    writeManifest();
    fs.writeFileSync(path.join(dir, 'apps/mobile/src/app.ts'), Buffer.from('drifted app source input'));
    assert.throws(() => loadBuildManifest(manifestFile, dir), /build manifest input drift/);
    fs.writeFileSync(path.join(dir, 'apps/mobile/src/app.ts'), inputs.get('apps/mobile/src/app.ts'));
    fs.writeFileSync(absoluteApk, Buffer.from('changed APK bytes'));
    assert.throws(() => loadBuildManifest(manifestFile, dir), /build manifest APK drift/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('captureArtifact writes the agreed receipt schema and the independent index hashes receipt bytes', () => {
  const dir = repoTempDir('sweep-receipt-test-');
  const artifactFile = path.join(dir, 'capture.png');
  const bytes = Buffer.from('captured screenshot bytes');
  const refs = [];
  const ctx = {
    attemptId: 'attempt-receipt-test',
    buildIdentity: { gitSha: 'a'.repeat(40), apkSha256: 'b'.repeat(64) },
    captureReceipts: refs,
  };
  try {
    fs.writeFileSync(artifactFile, bytes);
    const artifact = captureArtifact(ctx, artifactFile, bytes, 'screenshot', { seq: 7, timestamp: '2026-10-23T12:00:00.000Z' });
    assert.deepEqual(Object.keys(artifact.captureReceipt).sort(), ['file', 'sha256']);
    const receiptPath = path.join(REPO_ROOT, artifact.captureReceipt.file);
    const receiptBytes = fs.readFileSync(receiptPath);
    assert.equal(artifact.captureReceipt.sha256, hash(receiptBytes));
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    assert.deepEqual(Object.keys(receipt).sort(), [
      'apkSha256', 'artifactFile', 'artifactKind', 'artifactSha256', 'captureId', 'capturedAt',
      'executionAttemptId', 'gitSha', 'observationSeq', 'observationTimestamp', 'schemaVersion',
    ]);
    assert.equal(receipt.schemaVersion, 1);
    assert.match(receipt.captureId, /^[0-9a-f-]{36}$/i);
    assert.equal(receipt.executionAttemptId, 'attempt-receipt-test');
    assert.equal(receipt.artifactSha256, hash(bytes));
    assert.equal(receipt.artifactFile, artifact.file);
    assert.equal(receipt.artifactKind, 'screenshot');
    assert.equal(receipt.observationSeq, 7);
    assert.equal(receipt.observationTimestamp, '2026-10-23T12:00:00.000Z');
    assert.match(receipt.capturedAt, /^\d{4}-\d\d-\d\dT/);
    assert.equal(artifact.observationSeq, 7);
    assert.equal(artifact.observationTimestamp, receipt.observationTimestamp);
    assert.equal(receipt.gitSha, 'a'.repeat(40));
    assert.equal(receipt.apkSha256, 'b'.repeat(64));
    assert.equal(refs.length, 1, 'the acquisition index is appended at capture time');

    const indexFile = path.join(dir, 'index.capture-receipts.json');
    writeCaptureReceiptIndex(indexFile, refs);
    assert.deepEqual(JSON.parse(fs.readFileSync(indexFile, 'utf8')), { schemaVersion: 1, receipts: refs });
    assert.throws(() => writeCaptureReceiptIndex(indexFile, [{ file: '../escape.json', sha256: 'c'.repeat(64) }]), /repo-relative/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('separately acquired identical frames keep distinct observation-bound receipts', () => {
  const dir = repoTempDir('sweep-identical-frame-test-');
  const bytes = Buffer.from('same pixels');
  const refs = [];
  const ctx = { attemptId: 'attempt-identical', buildIdentity: { gitSha: 'a'.repeat(40), apkSha256: 'b'.repeat(64) }, captureReceipts: refs };
  try {
    const firstFile = path.join(dir, 'first.png');
    const secondFile = path.join(dir, 'second.png');
    fs.writeFileSync(firstFile, bytes);
    fs.writeFileSync(secondFile, bytes);
    const first = captureArtifact(ctx, firstFile, bytes, 'screenshot', { seq: 1, timestamp: '2026-10-23T12:00:01Z' });
    const second = captureArtifact(ctx, secondFile, bytes, 'screenshot', { seq: 2, timestamp: '2026-10-23T12:00:02Z' });
    assert.equal(first.sha256, second.sha256);
    assert.notEqual(first.captureReceipt.file, second.captureReceipt.file);
    assert.equal(first.observationSeq, 1);
    assert.equal(second.observationSeq, 2);
    assert.equal(refs.length, 2);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('parseHierarchyGameData derives identity and control IDs from acquired UIA XML', () => {
  const xml = '<hierarchy><node resource-id="memory-pair-recall.intro" text=""/><node resource-id="memory-pair-recall.session-token.session%3A42"/><node resource-id="android:id/content"/></hierarchy>';
  const parsed = parseHierarchyGameData(xml, 'memory-pair-recall');
  assert.equal(parsed.observedGameId, 'memory-pair-recall');
  assert.deepEqual(parsed.hierarchyControlIds, [
    'memory-pair-recall.intro', 'memory-pair-recall.session-token.session%3A42', 'android:id/content',
  ]);
  assert.deepEqual(Object.keys(parsed.controls).sort(), ['intro', 'session-token.session%3A42']);
  assert.equal(parseHierarchyGameData(xml, 'attention-odd-one-out').observedGameId, 'memory-pair-recall',
    'caller-requested game identity cannot relabel acquired resource IDs');
});

test('captureArtifact refuses to index missing or different artifact bytes', () => {
  const ctx = { attemptId: 'attempt-bad-receipt', buildIdentity: { gitSha: 'a'.repeat(40), apkSha256: 'b'.repeat(64) }, captureReceipts: [] };
  const dir = repoTempDir('sweep-receipt-failure-test-');
  try {
    const file = path.join(dir, 'capture.png');
    fs.writeFileSync(file, 'different bytes');
    assert.throws(() => captureArtifact(ctx, file, Buffer.from('claimed bytes'), 'screenshot', { seq: 1, timestamp: '2026-10-23T12:00:01Z' }), /differ from the acquired file/);
    assert.equal(ctx.captureReceipts.length, 0);
    assert.throws(() => captureArtifact(ctx, path.join(dir, 'missing.png'), Buffer.from('bytes'), 'screenshot', { seq: 1, timestamp: '2026-10-23T12:00:01Z' }), /requires acquired artifact bytes/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
