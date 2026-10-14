import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvedThemeWitness } from './resolved-theme-witness.mjs';

const apk = 'a'.repeat(64);
const w = { apkSha256: apk, settingsSnapshotSha256: 'b'.repeat(64), persistedThemeId: 'system' };
test('system preference uses the actual Activity night flag, not capture request', () => {
  assert.equal(resolvedThemeWitness(w, apk, 'mCurrentConfig={1.0 sw411dp port night finger}').observedTheme, 'dark');
  assert.equal(resolvedThemeWitness(w, apk, 'mCurrentConfig={1.0 sw411dp port finger}').observedTheme, 'light');
});
test('persisted explicit preference outranks the native system theme', () => {
  assert.equal(resolvedThemeWitness({ ...w, persistedThemeId: 'light' }, apk, 'mCurrentConfig={night port}').observedTheme, 'light');
  assert.equal(resolvedThemeWitness({ ...w, persistedThemeId: 'dark' }, apk, 'mCurrentConfig={port}').observedTheme, 'dark');
});
test('unbound, stale or absent runtime evidence stays UNKNOWN', () => {
  for (const [witness, hash, config] of [[null, apk, 'mCurrentConfig={night}'], [w, 'c'.repeat(64), 'mCurrentConfig={night}'], [w, apk, ''], [{ ...w, settingsSnapshotSha256: null }, apk, 'mCurrentConfig={night}'], [{ ...w, persistedThemeId: 'bad' }, apk, 'mCurrentConfig={night}']]) {
    assert.equal(resolvedThemeWitness(witness, hash, config).observedTheme, 'UNKNOWN');
  }
});
