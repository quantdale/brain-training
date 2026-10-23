import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';
import {
  applyPreviewedImport, buildFailureFixtures, hasSubstantiveSnapshot, parseDataControls, parseDataViewport,
  portableRows, qualifyImportRoundTrip, safeTapPoint, SNAPSHOT_TABLES, snapshotRowsSql,
  validateRunConsent, visibleDataBoundsHealthy, wipedWorkoutsAreFresh,
} from './data-management-journey.mjs';

test('wipe allows only a newly seeded empty workout, never old or progressed rows', () => {
  const row = { status: 'active', current_index: 0, reroll_attempt: 0, created_at: 200, skipped_indices_json: null };
  assert.equal(wipedWorkoutsAreFresh([], 100), true);
  assert.equal(wipedWorkoutsAreFresh([row], 100), true);
  for (const patch of [{ created_at: 100 }, { current_index: 1 }, { reroll_attempt: 1 },
    { skipped_indices_json: '[0]' }, { skipped_indices_json: '{bad' }, { status: 'completed' }]) {
    assert.equal(wipedWorkoutsAreFresh([{ ...row, ...patch }], 100), false);
  }
  assert.equal(wipedWorkoutsAreFresh([row, row], 100), false);
});

test('compressed hierarchy preserves app-owned completion text flattened outside the status container', () => {
  const xml = '<hierarchy><node resource-id="data-message" package="com.braintraining.app" bounds="[84,500][996,700]" />' +
    '<node text="Replace complete: current data was erased and 49 sessions restored" package="com.braintraining.app" bounds="[84,500][996,700]" /></hierarchy>';
  assert.match(parseDataControls(xml)['data-message'].content, /^Replace complete:/);
  assert.equal(parseDataControls(xml.replace('package="com.braintraining.app" bounds="[84,500][996,700]" /></hierarchy>', 'package="android" bounds="[84,500][996,700]" /></hierarchy>'))['data-message'].content, '');
});

test('API 36 edge-to-edge app viewport excludes visible status and navigation bars', () => {
  const dump = 'Window #0 Window{a u0 StatusBar}:\nFrames: frame=[0,0][1080,63]\nisVisible=true\n' +
    'Window #1 Window{b u0 Taskbar}:\nFrames: frame=[0,1794][1080,1920]\nisVisible=true\n' +
    'Window #2 Window{c u0 com.braintraining.app/com.braintraining.app.MainActivity}:\nFrames: parent=[0,0][1080,1920] frame=[0,0][1080,1920]\nisVisible=true';
  assert.deepEqual(parseDataViewport(dump, 'com.braintraining.app'), { left: 0, top: 63, right: 1080, bottom: 1794 });
  assert.throws(() => parseDataViewport(dump.replace('isVisible=true', 'isVisible=false').replace(/isVisible=true/g, 'isVisible=false'), 'com.braintraining.app'), /visible app/);
});

test('legacy app frame remains measurable without accepting another package', () => {
  const dump = 'Window #1 Window{c u0 com.braintraining.app/.MainActivity}:\nmFrame=[0,63][1080,1794]\nisVisible=true';
  assert.deepEqual(parseDataViewport(dump, 'com.braintraining.app'), { left: 0, top: 63, right: 1080, bottom: 1794 });
  assert.throws(() => parseDataViewport(dump, 'another.app'), /visible app/);
});

const viewport = { left: 0, top: 60, right: 1080, bottom: 1800 };
test('fully top-clipped RN nodes do not invalidate healthy visible controls, but cannot be tapped', () => {
  const clipped = { enabled: true, clickable: true, bounds: [84, 60, 254, 46] };
  assert.equal(visibleDataBoundsHealthy({ clipped }, viewport), true);
  assert.equal(safeTapPoint(clipped, viewport), null);
  assert.equal(visibleDataBoundsHealthy({ bad: { bounds: [84, 800, 254, 790] } }, viewport), false);
});

const button = (id, extra = {}) => ({ id, enabled: true, clickable: true, bounds: [40, 800, 1040, 940], content: '', ...extra });

function importHarness(mode, options = {}) {
  let phase = 'loaded';
  let time = 0;
  const taps = [];
  const boundaries = [];
  const read = () => {
    if (phase === 'loaded') return { [`data-preview-${mode}`]: button(`data-preview-${mode}`) };
    if (phase === 'complete') return { 'data-message': { content: `${mode === 'replace' ? 'Replace' : 'Merge'} complete: 2 sessions restored` } };
    const nodes = {
      'data-preview-output': { content: `Preview (${options.previewMode || mode}): ${options.invalid ? 'Invalid (checksum)' : 'Valid'}` },
      [`data-import-${mode}`]: button(`data-import-${mode}`, {
        enabled: !options.disabled,
        content: phase === 'armed' && !options.armMissing ? 'Tap again to erase and restore. Apply replace import' : `Apply ${mode} import`,
      }),
    };
    if (options.lossy) nodes['data-preview-lossy-warning'] = { content: 'data.newField will be lost' };
    return nodes;
  };
  const io = {
    find: async () => read(),
    read: async () => { time += options.captureMs || 50; return read(); },
    now: () => time,
    boundary: (phase) => boundaries.push(phase),
    tap: async (nodes, key) => {
      assert.ok(nodes[key]?.enabled, `cannot tap ${key}`);
      taps.push(key);
      if (options.failedCommand) throw new Error('adb failed');
      if (key.startsWith('data-preview-')) phase = 'previewed';
      else if (mode === 'replace' && phase !== 'armed') phase = 'armed';
      else phase = options.noCompletion ? 'pending' : 'complete';
    },
    completion: async () => read(),
  };
  return { io, taps, boundaries };
}

test('Replace follows preview -> arm -> observed armed label -> second tap -> completion', async () => {
  const h = importHarness('replace');
  const result = await applyPreviewedImport('replace', h.io);
  assert.equal(result.completionObserved, true);
  assert.deepEqual(h.taps, ['data-preview-replace', 'data-import-replace', 'data-import-replace']);
  assert.deepEqual(h.boundaries, ['preview-validated', 'replace-arm-observed', 'import-completed']);
});

test('Merge takes exactly one apply tap after the matching preview', async () => {
  const h = importHarness('merge');
  assert.equal((await applyPreviewedImport('merge', h.io)).completionObserved, true);
  assert.deepEqual(h.taps, ['data-preview-merge', 'data-import-merge']);
});

for (const [name, options, error, taps] of [
  ['wrong-mode preview', { previewMode: 'merge' }, /Matching valid/, 1],
  ['invalid backup', { invalid: true }, /Matching valid/, 1],
  ['lossy backup without explicit consent', { lossy: true }, /explicit user consent/, 1],
  ['disabled action', { disabled: true }, /disabled/, 1],
  ['arm not observed', { armMissing: true }, /arm missing/, 2],
  ['capture exceeds four-second arm window', { captureMs: 4100 }, /safe time budget/, 2],
  ['failed adb command', { failedCommand: true }, /adb failed/, 1],
  ['tap without completion', { noCompletion: true }, /completion not observed/, 3],
]) {
  test(`refuses ${name} without certifying or blindly retrying`, async () => {
    const h = importHarness('replace', options);
    await assert.rejects(applyPreviewedImport('replace', h.io), error);
    assert.equal(h.taps.length, taps);
    assert.ok(!h.boundaries.includes('import-completed'));
  });
}

test('missing requested Replace does not silently tap a visible Merge sibling', async () => {
  const h = importHarness('replace');
  h.io.find = async (key) => key === 'data-import-replace'
    ? { 'data-import-merge': button('data-import-merge') }
    : key === 'data-preview-output'
      ? { 'data-preview-output': { content: 'Preview (replace): Valid' } }
      : { [key]: button(key) };
  await assert.rejects(applyPreviewedImport('replace', h.io), /disabled/);
  assert.deepEqual(h.taps, ['data-preview-replace']);
});

function qualifiedSnapshot(overrides = {}) {
  const counts = Object.fromEntries(SNAPSHOT_TABLES.map((table) => [table, 0]));
  counts.profile = 1;
  counts.game_sessions = 49;
  counts.currency_ledger = 49;
  const digests = Object.fromEntries(SNAPSHOT_TABLES.map((table) => [table, 'a'.repeat(64)]));
  return {
    integrity: [{ integrity_check: 'ok' }],
    counts,
    aggregates: { sessionXp: 815, ledgerSum: 8, balance: 8 },
    rowDigests: digests,
    portableRowDigests: digests,
    ...overrides,
  };
}

test('unchanged DB alone cannot certify a no-op, empty profile, wrong mode or changed rows', () => {
  const snap = qualifiedSnapshot();
  assert.equal(hasSubstantiveSnapshot(snap), true);
  assert.equal(qualifyImportRoundTrip([], snap, snap, 'replace').verified, false);
  assert.equal(qualifyImportRoundTrip([null], snap, snap, 'replace').verified, false);
  assert.equal(qualifyImportRoundTrip([{ completionObserved: true, mode: 'merge' }], snap, snap, 'replace').verified, false);
  assert.equal(qualifyImportRoundTrip([{ completionObserved: true, mode: 'replace' }, null], snap, snap, 'replace').verified, false);
  assert.equal(qualifyImportRoundTrip([{ completionObserved: true, mode: 'replace' }], snap, snap, 'replace').verified, true);
  assert.equal(qualifyImportRoundTrip([{ completionObserved: true, mode: 'replace' }], snap,
    qualifiedSnapshot({ portableRowDigests: { ...snap.portableRowDigests, game_sessions: 'b'.repeat(64) } }), 'replace').verified, false);
  const empty = qualifiedSnapshot({ counts: { ...snap.counts, game_sessions: 0, currency_ledger: 0 } });
  assert.equal(hasSubstantiveSnapshot(empty), false);
  assert.equal(qualifyImportRoundTrip([{ completionObserved: true, mode: 'replace' }], empty, empty, 'replace').verified, false);
});

test('signed corrupt RN bounds are preserved; disabled, inverted and system-bar taps refused', () => {
  for (const extra of [
    { bounds: [42, 63, 252, -5792] }, { bounds: [40, -100, 1040, 100] },
    { bounds: [40, 1750, 1040, 1920] }, { bounds: [50, 100, 40, 200] },
    { enabled: false }, { clickable: false }, { bounds: null },
  ]) assert.equal(safeTapPoint(button('test', extra), viewport), null);
  assert.deepEqual(safeTapPoint(button('test'), viewport), [540, 870]);
  const xml = '<hierarchy><node resource-id="data-import-replace" enabled="true" clickable="true" bounds="[42,63][252,-5792]" /></hierarchy>';
  assert.deepEqual(parseDataControls(xml)['data-import-replace'].bounds, [42, 63, 252, -5792]);
});

test('portable row comparisons ignore only known regenerated IDs and post-replace bookkeeping', () => {
  const before = [{ id: 1, operation_id: 'op-1', amount: 5 }];
  assert.deepEqual(portableRows('currency_ledger', before), portableRows('currency_ledger', [{ ...before[0], id: 99 }]));
  assert.notDeepEqual(portableRows('currency_ledger', before), portableRows('currency_ledger', [{ ...before[0], amount: 6 }]));
  const profile = [{ id: 'local', updated_at: 1, settings_json: '{"theme":"dark","progressionSeedVersion":1}' }];
  assert.deepEqual(portableRows('profile', profile), portableRows('profile',
    [{ id: 'local', updated_at: 2, settings_json: '{"progressionSeedVersion":2,"theme":"dark"}' }]));
  assert.notDeepEqual(portableRows('profile', profile), portableRows('profile',
    [{ id: 'local', updated_at: 2, settings_json: '{"theme":"light"}' }]));
  assert.notDeepEqual(portableRows('game_sessions', before), portableRows('game_sessions', [{ ...before[0], id: 2 }]));
});

test('database reconciliation queries views without rowid and sorts view rows deterministically', () => {
  assert.ok(SNAPSHOT_TABLES.includes('currency_balance'));
  assert.equal(snapshotRowsSql('currency_balance'), 'SELECT * FROM "currency_balance"');
  assert.throws(() => snapshotRowsSql('table; DROP TABLE profile'), /Unknown snapshot relation/);
  const rows = [{ balance: 8 }, { balance: 15 }];
  assert.deepEqual(portableRows('currency_balance', rows), portableRows('currency_balance', rows.slice().reverse()));
  assert.deepEqual(portableRows('currency_balance', rows), ['{"balance":15}', '{"balance":8}']);
});

test('QA destructive journey requires an explicitly selected emulator and disposable-profile consent', () => {
  assert.equal(validateRunConsent('emulator-5554', true), true);
  assert.equal(validateRunConsent('', true), false);
  assert.equal(validateRunConsent('emulator-5554', false), false);
  assert.equal(validateRunConsent('device-1234', true), false);
});

test('invalid data fixtures retain valid checksums and exercise schema/value rejection gates', () => {
  const raw = JSON.stringify({
    format: 'brain-training-backup', version: 1, schemaVersion: 13, checksumAlgorithm: 'sha256',
    data: { gameSessions: [{ id: 's1', xp: 1 }] }, checksum: 'discard-me',
  });
  const fixtures = buildFailureFixtures(raw);
  assert.deepEqual(fixtures.map(({ expectedKind }) => expectedKind),
    ['malformed', 'malformed', 'unsupported-version', 'data-validation']);
  for (const index of [2, 3]) {
    const fixture = JSON.parse(fixtures[index].content);
    const { checksum, ...payload } = fixture;
    const canonical = (value) => Array.isArray(value) ? value.map(canonical) :
      value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
        : value;
    assert.equal(checksum, crypto.createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex'));
  }
  assert.equal(JSON.parse(fixtures[2].content).version, 2);
  assert.equal(JSON.parse(fixtures[3].content).data.gameSessions[0].xp, -5);
});

test('hierarchy captures descendant preview/message text rather than empty card attributes', () => {
  const nodes = parseDataControls('<hierarchy><node resource-id="data-preview-output"><node text="Preview (replace): Valid"/><node text="Would add 49 sessions &amp; 49 ledger entries"/></node></hierarchy>');
  assert.match(nodes['data-preview-output'].content, /Preview \(replace\): Valid.*49 sessions & 49 ledger/);
  assert.throws(() => parseDataControls(''), /hierarchy/);
  assert.throws(() => parseDataControls('<hierarchy><node></hierarchy>'), /Unclosed/);
});
