import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { captureIssues, contentColorCount, inspectPng, routeArrived } from './capture-validation.mjs';

const { PNG } = createRequire(new URL('../../apps/mobile/package.json', import.meta.url))('pngjs');

const pkg = 'com.braintraining.app';
const xml = `<hierarchy><node package="${pkg}" resource-id="" bounds="[0,0][1080,2400]"><node package="${pkg}" resource-id="bootstrap-recovery-title"/><node package="${pkg}" resource-id="bootstrap-recovery-message"/></node></hierarchy>`;
const good = (surface) => ({ surface, profile: 'default', theme: 'light', routeVerified: true, foregroundVerified: true, blank: false, pngBytes: 42000, xmlBytes: 100, pngSha256: 'a', xmlSha256: 'b' });
const manifest = () => ({ profiles: ['default'], themes: ['light'], requestedSurfaces: ['home', 'games'], surfaces: [good('home'), good('games')], skipped: [] });

test('rejects a white app viewport despite multicolored system status and navigation bars', () => {
  const png = new PNG({ width: 160, height: 200 });
  for (let y = 0; y < 200; y += 1) {
    for (let x = 0; x < 160; x += 1) {
      const offset = (y * 160 + x) * 4;
      const shade = y < 20 ? x % 2 ? 20 : 80 : y > 180 ? 45 : 250;
      png.data.set([shade, shade, shade, 255], offset);
    }
  }
  assert.equal(contentColorCount(PNG.sync.write(png)), 1);
  for (let y = 50; y < 115; y += 1) {
    for (let x = 40; x < 120; x += 1) {
      png.data.set(y < 70 ? [210, 10, 30, 255] : [20, 20, 20, 255], (y * 160 + x) * 4);
    }
  }
  assert.ok(contentColorCount(PNG.sync.write(png)) > 2);
  // A previous run filed this rich app frame as PASS despite a black strip
  // covering the top half of the OS status icons.
  for (let y = 0; y < 20; y += 1) {
    for (let x = 0; x < 160; x += 1) {
      png.data.set(y < 5 ? [0, 0, 0, 255] : [250, 250, 250, 255], (y * 160 + x) * 4);
    }
  }
  assert.equal(inspectPng(PNG.sync.write(png)).statusBarDiscontinuity, true);
});

test('arrival requires app-owned hierarchy and the expected route testIDs', () => {
  assert.equal(routeArrived('', pkg, ['bootstrap-recovery-title']), false);
  assert.equal(routeArrived(xml.replaceAll(pkg, 'com.google.android.apps.nexuslauncher'), pkg, ['bootstrap-recovery-title']), false);
  assert.equal(routeArrived(xml, pkg, ['wrong-id']), false);
  assert.equal(routeArrived(xml, pkg, ['bootstrap-recovery-title', 'bootstrap-recovery-message'], true), true);
  assert.equal(routeArrived(xml, pkg, ['bootstrap-recovery-title', 'wrong-id'], true), false);
});

test('matrix rejects missing, duplicated, skipped and invalid frames', () => {
  assert.deepEqual(captureIssues(manifest()), []);
  const missing = manifest();
  missing.surfaces.pop();
  assert.ok(captureIssues(missing).some((issue) => issue.includes('missing capture: default/light/games')));
  const duplicate = manifest();
  duplicate.surfaces.push(good('home'));
  assert.ok(captureIssues(duplicate).some((issue) => issue.includes('duplicate capture')));
  const invalid = manifest();
  invalid.surfaces[0].xmlBytes = 0;
  assert.ok(captureIssues(invalid).some((issue) => issue.includes('invalid screenshot or hierarchy')));
  const skipped = manifest();
  skipped.skipped.push({ ...good('games'), reason: 'launcher foreground' });
  assert.ok(captureIssues(skipped).some((issue) => issue.includes('skipped: default/light/games')));
  const aborted = manifest();
  aborted.aborted = 'display reset failed';
  assert.ok(captureIssues(aborted).some((issue) => issue.includes('capture aborted')));
});

test('capture CLI refuses to overwrite an existing immutable run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ui-capture-'));
  try {
    const output = join(dir, 'manifest.json');
    writeFileSync(output, 'existing evidence');
    const script = fileURLToPath(new URL('./ui-capture.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script, '--out', dir], { encoding: 'utf8' });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /already contains evidence/);
    assert.equal(readFileSync(output, 'utf8'), 'existing evidence');
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
