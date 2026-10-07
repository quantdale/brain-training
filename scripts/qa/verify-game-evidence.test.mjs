import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const { PNG } = createRequire(new URL('../../apps/mobile/package.json', import.meta.url))('pngjs');
const cli = join(root, 'scripts/qa/verify-game-evidence.mjs');

function fixturePng() {
  const png = new PNG({ width: 140, height: 140 });
  for (let y = 0; y < 140; y++) for (let x = 0; x < 140; x++) {
    const i = (y * 140 + x) * 4;
    png.data[i] = x < 47 ? 255 : 0;
    png.data[i + 1] = x >= 47 && x < 94 ? 255 : 0;
    png.data[i + 2] = x >= 94 ? 255 : 0;
    png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

function run(index, ...args) {
  return spawnSync(process.execPath, [cli, '--index', relative(root, index), ...args], {
    cwd: root, encoding: 'utf8', timeout: 30000,
  });
}

test('game index verifies bytes but never promotes missing states to completeness', () => {
  const artifacts = join(root, 'qa-artifacts');
  mkdirSync(artifacts, { recursive: true });
  const dir = mkdtempSync(join(artifacts, 'game-evidence-test-'));
  try {
    const pngFile = join(dir, 'after-memory-active.png');
    const bytes = fixturePng();
    writeFileSync(pngFile, bytes);
    const indexFile = join(dir, 'index.json');
    const index = {
      count: 1, images: [{ file: 'after-memory-active.png', sha256: createHash('sha256').update(bytes).digest('hex') }], excluded: [],
    };
    writeFileSync(indexFile, JSON.stringify(index));
    const valid = run(indexFile);
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /\[PARTIAL\] 42 games, 1\/168 core frames/);

    const incomplete = run(indexFile, '--require-complete');
    assert.equal(incomplete.status, 1);
    assert.match(incomplete.stderr, /missing core game states/);

    writeFileSync(pngFile, Buffer.from('not a png'));
    const corrupted = run(indexFile);
    assert.equal(corrupted.status, 1);
    assert.match(corrupted.stderr, /not a PNG|SHA-256 mismatch/);
    writeFileSync(pngFile, bytes);
    writeFileSync(join(dir, 'after-stray-feedback.png'), bytes);
    const unindexed = run(indexFile);
    assert.equal(unindexed.status, 1);
    assert.match(unindexed.stderr, /unindexed PNG/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
