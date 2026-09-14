#!/usr/bin/env node
/**
 * Validate the machine-readable Jest JSON result against the Campaign 016
 * intentional-skip allowlist.
 *
 * Usage from the repository root:
 *   node scripts/certification/validate-jest-signal.mjs \
 *     --summary apps/mobile/jest-summary.json
 *
 * The validator classifies pending/todo assertion records by exact relative
 * file plus an allowlisted full-name substring. It fails closed for any
 * unclassified skip, malformed allowlist entry, duplicate match, or result
 * shape it cannot interpret. Since campaign 028 it also fails closed on stale
 * allowlist entries: every entry must point at an existing test file that
 * still contains its `enableWith` gate, and every entry carries review
 * metadata (`reviewedAt`).
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const defaultAllowlist = path.join(root, 'scripts', 'certification', 'jest-skip-allowlist.json');
const ALLOWLIST_SCHEMA_VERSION = 2;

function usage() {
  console.error(
    'Usage: node scripts/certification/validate-jest-signal.mjs --summary <jest.json> [--allowlist <allowlist.json>] [--self-test]',
  );
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read JSON ${file}: ${error.message}`);
  }
}

function relativeFile(file) {
  const normalized = path.normalize(file);
  const relative = path.isAbsolute(normalized) ? path.relative(root, normalized) : normalized;
  return relative.split(path.sep).join('/');
}

function loadAllowlist(file) {
  return validateAllowlistValue(readJson(file), file);
}

/** Pure allowlist schema validation (schema v2: review metadata required). */
function validateAllowlistValue(value, file) {
  if (value?.schemaVersion !== ALLOWLIST_SCHEMA_VERSION || !Array.isArray(value.entries)) {
    throw new Error(
      `invalid allowlist schema: ${file} (expected schemaVersion ${ALLOWLIST_SCHEMA_VERSION} with entries[])`,
    );
  }
  const seen = new Set();
  return value.entries.map((entry, index) => {
    if (
      typeof entry?.file !== 'string' ||
      typeof entry?.testPattern !== 'string' ||
      typeof entry?.enableWith !== 'string' ||
      typeof entry?.rationale !== 'string' ||
      typeof entry?.owner !== 'string' ||
      typeof entry?.reviewedAt !== 'string' ||
      !entry.file ||
      !entry.testPattern ||
      !entry.enableWith
    ) {
      throw new Error(`allowlist entry ${index} is missing required fields`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt) || Number.isNaN(Date.parse(entry.reviewedAt))) {
      throw new Error(`allowlist entry ${index} has invalid reviewedAt '${entry.reviewedAt}' (want YYYY-MM-DD)`);
    }
    const key = `${entry.file}\n${entry.testPattern}`;
    if (seen.has(key)) throw new Error(`duplicate allowlist entry: ${key}`);
    seen.add(key);
    return entry;
  });
}

/**
 * Stale-entry detection (campaign 028, task 4.5): every allowlisted skip must
 * still point at an existing test file that still contains its `enableWith`
 * gate. A renamed/deleted file or a removed/renamed gate must fail closed
 * instead of silently exempting nothing.
 */
function findStaleEntries(allowlist) {
  const stale = [];
  for (const entry of allowlist) {
    const abs = path.join(root, entry.file);
    if (!existsSync(abs)) {
      stale.push({ entry, reason: `file missing: ${entry.file}` });
      continue;
    }
    const source = readFileSync(abs, 'utf8');
    const token = entry.enableWith.split(/[=: ]/)[0];
    if (!token || !source.includes(token)) {
      stale.push({ entry, reason: `enableWith gate '${entry.enableWith}' not found in ${entry.file}` });
    }
  }
  return stale;
}

function pendingAssertions(summary) {
  if (!Array.isArray(summary?.testResults)) {
    throw new Error('Jest JSON has no testResults array');
  }
  const pending = [];
  for (const result of summary.testResults) {
    const file = relativeFile(result.name);
    const assertions = Array.isArray(result.assertionResults) ? result.assertionResults : [];
    let foundPendingAssertion = false;
    for (const assertion of assertions) {
      if (assertion.status === 'pending' || assertion.status === 'todo' || assertion.status === 'skipped') {
        foundPendingAssertion = true;
        pending.push({
          file,
          fullName: typeof assertion.fullName === 'string'
            ? assertion.fullName
            : [...(assertion.ancestorTitles ?? []), assertion.title ?? ''].filter(Boolean).join(' '),
          suiteName: (assertion.ancestorTitles ?? []).join(' '),
          status: assertion.status,
        });
      }
    }
    // Jest versions/configurations may report a skipped describe block only
    // through the file result. Preserve that signal instead of silently
    // treating a suite with no assertion records as green.
    if (!foundPendingAssertion && (result.status === 'pending' || result.status === 'skipped')) {
      pending.push({
        file,
        fullName: '',
        suiteName: typeof result.message === 'string' ? result.message : path.basename(file),
        status: result.status,
      });
    }
  }
  return pending;
}

function validate(summary, allowlist) {
  const pending = pendingAssertions(summary);
  const classifications = pending.map((item) => {
    const matches = allowlist.filter((entry) => {
      if (item.file !== entry.file) return false;
      if (item.fullName) {
        return item.fullName.includes(entry.testPattern);
      }
      return item.suiteName.includes(entry.suitePattern ?? entry.testPattern);
    });
    return { ...item, matches };
  });
  const unclassified = classifications.filter((item) => item.matches.length === 0);
  const ambiguous = classifications.filter((item) => item.matches.length > 1);
  const summaryCounts = {
    passedSuites: Number(summary.numPassedTestSuites ?? 0),
    failedSuites: Number(summary.numFailedTestSuites ?? 0),
    skippedSuites: Number(summary.numPendingTestSuites ?? 0),
    totalSuites: Number(summary.numTotalTestSuites ?? 0),
    passedTests: Number(summary.numPassedTests ?? 0),
    failedTests: Number(summary.numFailedTests ?? 0),
    skippedTests: Number(summary.numPendingTests ?? 0),
    todoTests: Number(summary.numTodoTests ?? 0),
    totalTests: Number(summary.numTotalTests ?? 0),
  };
  const report = {
    schemaVersion: 1,
    source: 'jest-json',
    allowlistEntryCount: allowlist.length,
    counts: summaryCounts,
    classifiedSkipCount: classifications.length,
    unclassifiedSkipCount: unclassified.length,
    ambiguousSkipCount: ambiguous.length,
    warningCounts: {
      total: Number(summary.warningCount ?? 0),
      classified: Number(summary.classifiedWarningCount ?? 0),
      unexpected: Number(summary.unexpectedWarningCount ?? 0),
    },
    skips: classifications.map(({ file, fullName, status, matches }) => ({
      file,
      fullName,
      status,
      allowlist: matches[0] ? {
        testPattern: matches[0].testPattern,
        enableWith: matches[0].enableWith,
        owner: matches[0].owner,
      } : null,
    })),
    pass: unclassified.length === 0 && ambiguous.length === 0,
  };
  return { report, unclassified, ambiguous, classifications };
}

/**
 * Orphan-entry detection (frontier audit `certify-provenance-parity`): an
 * allowlist row that matched no pending test in this run exempts nothing — the
 * skip it justified was removed, renamed or re-enabled. Fail closed instead of
 * leaving a dead exemption behind.
 */
function findOrphanEntries(allowlist, classifications) {
  const matched = new Set();
  for (const item of classifications) {
    for (const entry of item.matches) {
      matched.add(`${entry.file}\n${entry.testPattern}`);
    }
  }
  return allowlist.filter(
    (entry) => !matched.has(`${entry.file}\n${entry.testPattern}`),
  );
}

function assertPass(report, unclassified, ambiguous) {
  if (unclassified.length || ambiguous.length) {
    console.error(JSON.stringify(report, null, 2));
    for (const item of unclassified) {
      console.error(`UNCLASSIFIED_JEST_SKIP: ${item.file} :: ${item.fullName}`);
    }
    for (const item of ambiguous) {
      console.error(`AMBIGUOUS_JEST_SKIP: ${item.file} :: ${item.fullName}`);
    }
    throw new Error('Jest signal integrity failed: every skipped test must match exactly one allowlist entry');
  }
  console.log(JSON.stringify(report, null, 2));
}

function syntheticSummary(status = 'pending') {
  return {
    numPassedTestSuites: 1,
    numFailedTestSuites: 0,
    numPendingTestSuites: status === 'pending' ? 1 : 0,
    numTotalTestSuites: 1,
    numPassedTests: status === 'pending' ? 0 : 1,
    numFailedTests: 0,
    numPendingTests: status === 'pending' ? 1 : 0,
    numTotalTests: 1,
    testResults: [{
      name: path.join(root, 'apps/mobile/src/__tests__/perf-quest-eval-ab.test.ts'),
      assertionResults: [{
        ancestorTitles: ['perf quest eval A/B (opt-in via PERF_PROBE=1)'],
        title: 'compares engine scan vs partitioned single pass in-process',
        fullName: 'perf quest eval A/B (opt-in via PERF_PROBE=1) compares engine scan vs partitioned single pass in-process',
        status,
      }],
    }],
  };
}

function allAllowlistedSummary() {
  const allowlist = loadAllowlist(defaultAllowlist);
  return {
    numPassedTestSuites: 0,
    numFailedTestSuites: 0,
    numPendingTestSuites: allowlist.length,
    numTotalTestSuites: allowlist.length,
    numPassedTests: 0,
    numFailedTests: 0,
    numPendingTests: allowlist.length,
    numTotalTests: allowlist.length,
    testResults: allowlist.map((entry, index) => ({
      name: path.join(root, entry.file),
      status: index === 0 ? 'pending' : 'passed',
      message: entry.suitePattern,
      assertionResults: index === 0 ? [] : [{
        ancestorTitles: [entry.suitePattern],
        title: 'measurement',
        fullName: `${entry.suitePattern} measurement`,
        status: 'pending',
      }],
    })),
  };
}

function selfTest() {
  const allowlist = loadAllowlist(defaultAllowlist);
  const good = validate(allAllowlistedSummary(), allowlist);
  assert.equal(good.unclassified.length, 0);
  assert.equal(good.ambiguous.length, 0);
  assert.equal(good.report.classifiedSkipCount, allowlist.length);

  const badSummary = syntheticSummary();
  badSummary.testResults[0].assertionResults[0].fullName = 'unowned skip';
  const bad = validate(badSummary, allowlist);
  assert.equal(bad.unclassified.length, 1);

  const nonPending = validate(syntheticSummary('passed'), allowlist);
  assert.equal(nonPending.report.classifiedSkipCount, 0);

  // Stale-entry detection (campaign 028, task 4.5): the shipped allowlist must
  // be free of stale entries, and both stale shapes must be detected.
  assert.equal(findStaleEntries(allowlist).length, 0, 'default allowlist must not be stale');
  assert.equal(
    findStaleEntries([{ ...allowlist[0], file: 'apps/mobile/src/__tests__/does-not-exist.test.ts' }]).length,
    1,
  );
  assert.equal(findStaleEntries([{ ...allowlist[1], enableWith: 'NO_SUCH_PROBE=1' }]).length, 1);

  // Orphan entries (frontier audit `certify-provenance-parity`): an entry that
  // matches zero current pending tests is stale even when its file and gate
  // still exist.
  const noPending = validate(syntheticSummary('passed'), allowlist);
  assert.equal(
    findOrphanEntries(allowlist, noPending.classifications).length,
    allowlist.length,
    'a summary with no pending tests must orphan every allowlist entry',
  );
  assert.equal(
    findOrphanEntries(allowlist, [{ matches: [allowlist[1]] }]).length,
    allowlist.length - 1,
    'only the matched entry may be kept',
  );
  assert.equal(
    findOrphanEntries(allowlist, good.classifications).length,
    0,
    'fully matched allowlist must have no orphans',
  );

  // Schema v2: legacy version and missing/invalid review metadata are rejected.
  assert.throws(() => validateAllowlistValue({ schemaVersion: 1, entries: [] }, 'fixture'), /invalid allowlist schema/);
  assert.throws(
    () => validateAllowlistValue({ schemaVersion: 2, entries: [{ ...allowlist[0], reviewedAt: undefined }] }, 'fixture'),
    /missing required fields/,
  );
  assert.throws(
    () => validateAllowlistValue({ schemaVersion: 2, entries: [{ ...allowlist[0], reviewedAt: 'yesterday' }] }, 'fixture'),
    /invalid reviewedAt/,
  );
  console.log('validate-jest-signal self-test: PASS');
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selfTest();
} else {
  const summaryIndex = args.indexOf('--summary');
  const allowlistIndex = args.indexOf('--allowlist');
  if (summaryIndex < 0 || !args[summaryIndex + 1]) {
    usage();
    process.exitCode = 2;
  } else {
    try {
      const summaryFile = path.resolve(args[summaryIndex + 1]);
      const allowlistFile = path.resolve(
        allowlistIndex >= 0 && args[allowlistIndex + 1] ? args[allowlistIndex + 1] : defaultAllowlist,
      );
      if (!existsSync(summaryFile)) throw new Error(`summary does not exist: ${summaryFile}`);
      const allowlist = loadAllowlist(allowlistFile);
      const stale = findStaleEntries(allowlist);
      if (stale.length) {
        for (const { entry, reason } of stale) {
          console.error(`STALE_ALLOWLIST_ENTRY: ${entry.file} (${entry.testPattern}) — ${reason}`);
        }
        throw new Error(`${stale.length} stale jest-skip allowlist entr${stale.length === 1 ? 'y' : 'ies'} — update or remove them`);
      }
      const result = validate(readJson(summaryFile), allowlist);
      const orphans = findOrphanEntries(allowlist, result.classifications);
      if (orphans.length) {
        for (const entry of orphans) {
          console.error(
            `ORPHAN_ALLOWLIST_ENTRY: ${entry.file} (${entry.testPattern}) — matched no pending test in this summary`,
          );
        }
        throw new Error(
          `${orphans.length} orphan jest-skip allowlist entr${orphans.length === 1 ? 'y' : 'ies'} — update or remove them`,
        );
      }
      assertPass(result.report, result.unclassified, result.ambiguous);
    } catch (error) {
      console.error(`validate-jest-signal: FAIL — ${error.message}`);
      process.exitCode = 1;
    }
  }
}
