// PASS verifies an honest, byte-linked record; missing comparisons do not pass.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { EV, normalPath, loadThemeInventory, checkIndexedImage, resolveTheme, pairThemeStatus } from './theme-evidence.mjs';
const J = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const data = J(EV + '/image-themes.json');
const expected = loadThemeInventory();
const images = new Map(data.images.map((image) => [normalPath(image.file), image]));
assert.equal(data.count, expected.length);
assert.equal(images.size, expected.length);
for (const entry of expected) {
  const image = images.get(entry.file);
  assert.ok(image, 'missing theme entry: ' + entry.file);
  const hash = checkIndexedImage(entry);
  assert.equal(image.sha256, hash, 'stale PNG hash: ' + entry.file);
  const resolved = resolveTheme(hash, entry.metadata);
  for (const field of ['theme', 'requestedTheme', 'themeReason', 'themeMetadata']) {
    assert.deepEqual(image[field], resolved[field], 'unsupported theme claim: ' + entry.file + '/' + field);
  }
  assert.equal(image.integrityStatus, entry.integritySource ? 'INDEX_HASH_VERIFIED' : 'HASH_COMPUTED_ONLY');
}
const fullPath = (ref) => ref.startsWith('076-f-final-product-certification/') ? 'openspec/changes/' + ref : EV + '/' + ref;
const checkFrame = (frame) => {
  if (!frame) return;
  const image = images.get(fullPath(frame.file));
  assert.ok(image, 'unindexed frame: ' + frame.file);
  assert.equal(frame.sha256, image.sha256);
  assert.equal(frame.theme, image.theme);
  assert.equal(frame.integrityStatus, image.integrityStatus);
};
const gallery = J(EV + '/matched-gallery.json');
let matched = 0;
for (const list of Object.values(gallery.pairs)) {
  for (const pair of list) {
    checkFrame(pair.before); checkFrame(pair.after);
    assert.equal(pairThemeStatus(pair.before.theme, pair.after.theme), 'MATCHED');
    matched++;
  }
}
for (const [name, list] of Object.entries(gallery.gaps)) {
  for (const pair of list) {
    checkFrame(pair.before); checkFrame(pair.after);
    if (name.endsWith('ThemeUnknown')) assert.equal(pairThemeStatus(pair.before.theme, pair.after.theme), 'THEME-UNKNOWN');
    if (name.endsWith('ThemeMismatch')) assert.equal(pairThemeStatus(pair.before.theme, pair.after.theme), 'THEME-MISMATCHED');
  }
}
assert.equal(gallery.summary.totalMatchedPairs, matched);
const coverage = J(EV + '/coverage-matrix.json');
assert.equal(coverage.totals.rows, coverage.rows.length);
assert.equal(new Set(coverage.rows.map((r) => [r.kind, r.profile, r.captureTheme, r.surface].join('|'))).size, coverage.rows.length);
const tally = {};
for (const row of coverage.rows) {
  checkFrame(row.before); checkFrame(row.after);
  tally[row.status] = (tally[row.status] || 0) + 1;
  if (['MATCHED', 'THEME-UNKNOWN', 'THEME-MISMATCHED'].includes(row.status)) assert.equal(pairThemeStatus(row.before.theme, row.after.theme), row.status);
  assert.equal(row.theme, row.after?.theme || row.before?.theme || 'UNKNOWN');
}
assert.deepEqual(tally, coverage.totals.byStatus);
assert.equal(tally.MATCHED || 0, matched);
assert.equal(coverage.rows.length, Object.values(gallery.pairs).concat(Object.values(gallery.gaps)).reduce((n, list) => n + list.length, 0));
const tutorials = J(EV + '/terminal-tutorials-c8c3d46c/manifest.json');
for (const game of tutorials.games) {
  const image = images.get(EV + '/terminal-tutorials-c8c3d46c/' + game.file);
  assert.equal(game.observedTheme, image.theme);
  assert.ok(!('measuredTheme' in game) && !('themeMatchesRequest' in game), 'legacy luminance-derived theme claim');
}
const report = fs.readFileSync(EV + '/VISUAL_DECISION.md', 'utf8');
assert.ok(!report.includes(String.fromCharCode(36) + '{'), 'literal template placeholder');
assert.ok(report.includes('**' + matched + ' theme-confirmed matched pairs**'));
assert.ok(report.includes('**Parent 14.3 remains OPEN.'));
const parent = fs.readFileSync('openspec/changes/076-product-wide-ui-ux-reboot/tasks.md', 'utf8');
assert.match(parent, /^- \[ \] 14\.3 /m);
assert.match(parent, /^- \[x\] 14\.7 /m);
assert.equal(J('.agent/GOVERNANCE.json').lastCampaignVerdict, 'CHANGE_076_RELEASE_ACCEPTANCE_BLOCKED');
console.log('PASS evidence integrity/classification: ' + images.size + ' PNGs, ' + coverage.rows.length + ' rows, ' + matched + ' confirmed pairs; missing comparisons remain NOT VALIDATED');
