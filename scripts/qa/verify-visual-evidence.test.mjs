import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkMatrixDir, evidenceResultPassed, verifyVisualEvidence } from './verify-visual-evidence.mjs';

const { PNG } = createRequire(new URL('../../apps/mobile/package.json', import.meta.url))('pngjs');
const apkSha256 = 'a'.repeat(64);
const codeSha = 'b'.repeat(40);
const hash = (buf) => createHash('sha256').update(buf).digest('hex');

function fixturePng(rgb) {
  const png = new PNG({ width: 8, height: 8 });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data.set(rgb, i);
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

const originalPng = fixturePng([255, 0, 0]);
const changedPng = fixturePng([0, 0, 255]);

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-evidence-test-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  for (const inventory of ['before', 'before-captures']) {
    const dir = path.join(root, inventory);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'baseline.png'), originalPng);
    writeJson(path.join(dir, 'index.json'), {
      count: 1, apkSha256, sourceSha: codeSha,
      images: [{ file: 'baseline.png', bytes: originalPng.length, sha256: hash(originalPng) }],
    });
  }
  const matrixDir = path.join(root, 'final-matrix-de6c5fcd');
  fs.mkdirSync(path.join(matrixDir, 'default', 'light'), { recursive: true });
  const manifest = {
    expectedCount: 90, build: { apkSha256, codeSha },
    surfaces: Array.from({ length: 90 }, (_, i) => ({
      name: `default-route-${i}-light`, apkSha256, codeSha,
      pngBytes: originalPng.length, pngSha256: hash(originalPng),
    })),
  };
  for (let i = 0; i < 90; i++) {
    fs.writeFileSync(path.join(matrixDir, 'default', 'light', `route-${i}.png`), originalPng);
  }
  const manifestPath = path.join(matrixDir, 'captures.json');
  writeJson(manifestPath, manifest);
  return {
    root, manifest, manifestPath,
    lastPng: path.join(matrixDir, 'default', 'light', 'route-89.png'),
  };
}

test('valid recorded hashes and bytes verify all 90 PNGs and both historical inventories', (t) => {
  const { root, manifestPath } = fixture(t);
  const recorded = fs.readFileSync(manifestPath);
  const results = verifyVisualEvidence(root);
  assert.equal(results.length, 3);
  assert.deepEqual(results.map((r) => r.verified), [1, 1, 90]);
  assert.ok(results.every(evidenceResultPassed));
  assert.deepEqual(fs.readFileSync(manifestPath), recorded);
});

test('a changed valid PNG with identical byte length fails its recorded hash without rehashing the index', (t) => {
  const { root, manifestPath, lastPng } = fixture(t);
  assert.equal(changedPng.length, originalPng.length);
  assert.notDeepEqual(changedPng, originalPng);
  assert.equal(PNG.sync.read(changedPng).width, 8);
  const recorded = fs.readFileSync(manifestPath);
  fs.writeFileSync(lastPng, changedPng);
  const result = checkMatrixDir(root);
  assert.equal(evidenceResultPassed(result), false);
  assert.equal(result.verified, 89);
  assert.equal(result.hashMismatch.length, 1);
  assert.match(result.hashMismatch[0], /route-89\.png: index .+ vs disk/);
  assert.deepEqual(result.sizeMismatch, []);
  assert.deepEqual(fs.readFileSync(manifestPath), recorded);
});

test('a missing or malformed per-PNG digest fails and does not count as verified', async (t) => {
  for (const digest of [undefined, '', 'c'.repeat(63), 'g'.repeat(64)]) {
    await t.test(`digest ${digest ?? 'absent'}`, (subtest) => {
      const { root, manifest, manifestPath } = fixture(subtest);
      manifest.surfaces[89].pngSha256 = digest;
      writeJson(manifestPath, manifest);
      const result = checkMatrixDir(root);
      assert.equal(evidenceResultPassed(result), false);
      assert.equal(result.verified, 89);
      assert.equal(result.hashMismatch.length, 1);
      assert.match(result.hashMismatch[0], /missing or malformed recorded pngSha256/);
    });
  }
});

test('recorded PNG byte lengths are required and must match', async (t) => {
  for (const size of [undefined, String(originalPng.length), originalPng.length + 1]) {
    await t.test(`size ${size ?? 'absent'}`, (subtest) => {
      const { root, manifest, manifestPath } = fixture(subtest);
      manifest.surfaces[89].pngBytes = size;
      writeJson(manifestPath, manifest);
      const result = checkMatrixDir(root);
      assert.equal(evidenceResultPassed(result), false);
      assert.equal(result.verified, 89);
      assert.equal(result.sizeMismatch.length, 1);
      assert.deepEqual(result.hashMismatch, []);
    });
  }
});

test('APK/source identity mismatches remain failures even when PNG bytes match', async (t) => {
  for (const field of ['apkSha256', 'codeSha']) {
    await t.test(field, (subtest) => {
      const { root, manifest, manifestPath } = fixture(subtest);
      manifest.surfaces[89][field] = 'c'.repeat(field === 'apkSha256' ? 64 : 40);
      writeJson(manifestPath, manifest);
      const result = checkMatrixDir(root);
      assert.equal(evidenceResultPassed(result), false);
      assert.equal(result.verified, 89);
      assert.equal(result.identityMismatch.length, 1);
      assert.deepEqual(result.hashMismatch, []);
    });
  }
});

test('PNG signature validity remains required when the recorded hash matches invalid bytes', (t) => {
  const { root, manifest, manifestPath, lastPng } = fixture(t);
  const invalid = Buffer.from(originalPng);
  invalid[4] = 0;
  fs.writeFileSync(lastPng, invalid);
  manifest.surfaces[89].pngSha256 = hash(invalid);
  writeJson(manifestPath, manifest);
  const result = checkMatrixDir(root);
  assert.equal(evidenceResultPassed(result), false);
  assert.equal(result.verified, 89);
  assert.match(result.sizeMismatch[0], /not a PNG/);
  assert.deepEqual(result.hashMismatch, []);
});

test('missing referenced PNGs fail and are excluded from the verified count', (t) => {
  const { root, lastPng } = fixture(t);
  fs.unlinkSync(lastPng);
  const result = checkMatrixDir(root);
  assert.equal(evidenceResultPassed(result), false);
  assert.equal(result.verified, 89);
  assert.deepEqual(result.missing, ['default/light/route-89.png']);
});

test('both before indexes still reject altered bytes against their original SHA-256', async (t) => {
  for (const inventory of ['before-captures', 'before']) {
    await t.test(inventory, (subtest) => {
      const { root } = fixture(subtest);
      fs.writeFileSync(path.join(root, inventory, 'baseline.png'), changedPng);
      const results = verifyVisualEvidence(root);
      const result = results.find((r) => r.index === `${inventory}/index.json`);
      assert.equal(evidenceResultPassed(result), false);
      assert.equal(result.verified, 0);
      assert.equal(result.hashMismatch.length, 1);
      assert.ok(results.filter((r) => r !== result).every(evidenceResultPassed));
    });
  }
});
