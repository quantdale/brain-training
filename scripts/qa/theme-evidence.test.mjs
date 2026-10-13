import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { analyseImage } from './image-theme.mjs';
import { resolveTheme, pairThemeStatus } from './theme-evidence.mjs';
const { PNG } = createRequire(new URL('../../apps/mobile/package.json', import.meta.url))('pngjs');
const hash = 'a'.repeat(64);
const metadata = (theme, kind, sha256 = hash) => ({ theme, kind, sha256, source: 'fixture.json', field: 'theme' });

test('requested light/dark modes never prove observed theme', () => {
  for (const theme of ['light', 'dark']) {
    const result = resolveTheme(hash, [metadata(theme, 'requested-capture-mode')]);
    assert.equal(result.theme, 'UNKNOWN');
    assert.equal(result.requestedTheme, theme);
  }
});
test('absent observed metadata remains UNKNOWN', () => {
  assert.equal(resolveTheme(hash).theme, 'UNKNOWN');
});
test('hash-linked observed metadata can establish a theme', () => {
  for (const theme of ['light', 'dark']) assert.equal(resolveTheme(hash, [metadata(theme, 'observed-app-theme')]).theme, theme);
});
test('a system request cannot override observed app preference', () => {
  const result = resolveTheme(hash, [metadata('light', 'requested-capture-mode'), metadata('dark', 'observed-app-theme')]);
  assert.equal(result.theme, 'dark');
  assert.equal(result.requestedTheme, 'light');
});
test('conflicting observations remain UNKNOWN', () => {
  assert.equal(resolveTheme(hash, [metadata('light', 'observed-app-theme'), metadata('dark', 'observed-app-theme')]).theme, 'UNKNOWN');
});
test('metadata for other bytes cannot classify an image', () => {
  assert.equal(resolveTheme(hash, [metadata('light', 'observed-app-theme', 'b'.repeat(64))]).theme, 'UNKNOWN');
});
test('two UNKNOWN themes are never a match', () => {
  for (const [before, after] of [['UNKNOWN', 'UNKNOWN'], ['light', 'UNKNOWN'], [null, 'dark']]) assert.equal(pairThemeStatus(before, after), 'THEME-UNKNOWN');
  assert.equal(pairThemeStatus('light', 'light'), 'MATCHED');
  assert.equal(pairThemeStatus('light', 'dark'), 'THEME-MISMATCHED');
});
test('PNG brightness extremes remain diagnostic, not theme classifications', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-theme-evidence-'));
  const files = [];
  try {
    for (const colour of [0, 255]) {
      const png = new PNG({ width: 4, height: 4 });
      for (let i = 0; i < png.data.length; i += 4) {
        png.data[i] = png.data[i + 1] = png.data[i + 2] = colour; png.data[i + 3] = 255;
      }
      const bytes = PNG.sync.write(png);
      const file = path.join(dir, colour + '.png');
      files.push(file); fs.writeFileSync(file, bytes);
      const measured = analyseImage(file);
      assert.equal(measured.theme, 'UNKNOWN');
      assert.equal(measured.meanLuminance, colour === 0 ? 0 : 1);
      assert.equal(measured.sha256, createHash('sha256').update(bytes).digest('hex'));
    }
  } finally {
    for (const file of files) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});
