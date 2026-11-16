import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./validate-jest-signal.mjs', import.meta.url));
const counters = ['numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites', 'numTotalTestSuites', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests', 'numTotalTests'];
const goodSummary = () => ({
  numPassedTestSuites: 1, numFailedTestSuites: 0, numPendingTestSuites: 0, numTotalTestSuites: 1,
  numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0, numTotalTests: 1,
  testResults: [{ name: 'test.js', status: 'passed', assertionResults: [{ status: 'passed', fullName: 'control' }] }],
});
function run(summary) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jest-signal-counts-'));
  try {
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary));
    fs.writeFileSync(path.join(dir, 'allowlist.json'), JSON.stringify({ schemaVersion: 4, minTotalSuites: 1, minTotalTests: 1, entries: [] }));
    return spawnSync(process.execPath, [script, '--summary', path.join(dir, 'summary.json'), '--allowlist', path.join(dir, 'allowlist.json')], { encoding: 'utf8', timeout: 10000 });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('T10 valid numeric totals and discovered results pass', () => {
  const result = run(goodSummary());
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).pass, true);
});
for (const field of counters) {
  test(`T10 rejects malformed ${field} before floor comparisons`, () => {
    for (const value of ['not-a-number', '1', null, -1, 1.5, 1e100, true, undefined]) {
      const result = run({ ...goodSummary(), [field]: value });
      assert.equal(result.status, 1, `${field}=${String(value)} passed: ${result.stdout}`);
      assert.match(result.stderr, /invalid Jest counter/);
    }
  });
}
for (const [label, mutate] of [
  ['suite discovery', (s) => { s.numTotalTestSuites = 2; s.numPassedTestSuites = 2; }],
  ['test discovery', (s) => { s.numTotalTests = 2; s.numPassedTests = 2; }],
  ['suite subtotals', (s) => { s.numFailedTestSuites = 1; }],
  ['test subtotals', (s) => { s.numFailedTests = 1; }],
]) {
  test(`T10 rejects inconsistent ${label} counts`, () => {
    const summary = goodSummary(); mutate(summary);
    const result = run(summary);
    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /inconsistent Jest counts/);
  });
}
