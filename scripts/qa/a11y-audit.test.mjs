import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./a11y-audit.mjs', import.meta.url));
const app = 'com.braintraining.app';
const node = (pkg, attrs, children = '') =>
  `<node package="${pkg}" class="android.view.View" text="" resource-id="" long-clickable="false" checkable="false" scrollable="false" ${attrs.includes('bounds=') ? '' : 'bounds="[0,0][1080,2400]"'} ${attrs.includes('clickable=') ? '' : 'clickable="false"'} ${attrs}>${children}</node>`;
const control = (pkg, attrs = '') =>
  node(pkg, `clickable="true" bounds="[381,100][400,226]" ${attrs}`);

function audit(xml) {
  const dir = mkdtempSync(join(tmpdir(), 'a11y-audit-'));
  try {
    writeFileSync(join(dir, 'surface.xml'), `<hierarchy>${xml}</hierarchy>`);
    const result = spawnSync(process.execPath, [script, '--dir', dir, '--out', join(dir, 'report.json')], { encoding: 'utf8' });
    assert.ok(result.status !== null, result.stderr);
    return { status: result.status, report: JSON.parse(readFileSync(join(dir, 'report.json'), 'utf8')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('rejects launcher-only hierarchy even with an empty resource-id', () => {
  const { status, report } = audit(node('com.google.android.apps.nexuslauncher', '', control('com.google.android.apps.nexuslauncher')));
  assert.equal(status, 1);
  assert.equal(report.violations[0].kind, 'missing-app-hierarchy');
});

test('rejects app roots with no interactive controls rather than claiming an a11y pass', () => {
  const { status, report } = audit(node(app, ''));
  assert.equal(status, 1);
  assert.equal(report.violations[0].kind, 'no-interactive-evidence');
});

test('a partially visible rail control must still have an accessible name', () => {
  const rail = `<node package="${app}" class="android.widget.HorizontalScrollView" scrollable="true" bounds="[0,100][400,300]">${control(app)}</node>`;
  const { status, report } = audit(node(app, '', rail));
  assert.equal(status, 1);
  assert.ok(report.violations.some((v) => v.kind === 'unlabelled-interactive'));
  assert.ok(report.occluded.some((v) => v.reason === 'rail-edge (scroll-reachable)'));
});

test('a nearby rail never excuses an unrelated undersized control', () => {
  const rail = `<node package="${app}" class="android.widget.HorizontalScrollView" scrollable="true" bounds="[0,100][400,300]"></node>`;
  const { status, report } = audit(node(app, '', rail + control(app, 'content-desc="Tiny control"')));
  assert.equal(status, 1);
  assert.ok(report.violations.some((v) => v.kind === 'target<48dp'));
});

test('scores only app-owned nodes, accepting a labelled 48dp target beside a foreign window', () => {
  const good = node(app, 'bounds="[0,0][1080,2400]"', node(app, 'clickable="true" content-desc="Start" bounds="[0,200][126,326]"'));
  const foreign = node('com.google.android.apps.nexuslauncher', '', control('com.google.android.apps.nexuslauncher'));
  const { status, report } = audit(foreign + good);
  assert.equal(status, 0);
  assert.equal(report.surfaces[0].interactive, 1);
  assert.equal(report.violations.length, 0);
});
