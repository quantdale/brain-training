#!/usr/bin/env node
/**
 * Validate the machine-readable Jest JSON result against the Campaign 016
 * intentional-skip allowlist.
 *
 * Usage from the repository root:
 *   node scripts/certification/validate-jest-signal.mjs \
 *     --summary apps/mobile/jest-summary.json
 *   node scripts/certification/validate-jest-signal.mjs --check-allowlist
 *
 * The validator classifies pending/todo assertion records by exact relative
 * file plus an allowlisted full-name substring. It fails closed for any
 * unclassified skip, malformed allowlist entry, duplicate match, or result
 * shape it cannot interpret. Since campaign 028 it also fails closed on stale
 * allowlist entries: every entry must point at an existing test file that
 * still contains its `enableWith` gate, and every entry carries review
 * metadata (`reviewedAt`) plus an `expires` date (schema v3) that fails
 * closed once passed and warns inside the 60-day window.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const defaultAllowlist = path.join(root, 'scripts', 'certification', 'jest-skip-allowlist.json');
const ALLOWLIST_SCHEMA_VERSION = 3;
const EXPIRY_WARNING_WINDOW_DAYS = 60;

function usage() {
  console.error(
    'Usage: node scripts/certification/validate-jest-signal.mjs --summary <jest.json> [--allowlist <allowlist.json>] [--check-allowlist] [--self-test]',
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

/** Pure allowlist schema validation (schema v3: review and expiry metadata required). */
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
      typeof entry?.expires !== 'string' ||
      !entry.file ||
      !entry.testPattern ||
      !entry.enableWith
    ) {
      throw new Error(`allowlist entry ${index} is missing required fields`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt) || Number.isNaN(Date.parse(entry.reviewedAt))) {
      throw new Error(`allowlist entry ${index} has invalid reviewedAt '${entry.reviewedAt}' (want YYYY-MM-DD)`);
    }
    if (!isValidAllowlistDate(entry.expires)) {
      throw new Error(`allowlist entry ${index} has invalid expires '${entry.expires}' (want YYYY-MM-DD)`);
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

/** Parse a YYYY-MM-DD allowlist date as local midnight; null when impossible. */
function parseAllowlistDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  // `Date` rolls impossible dates over (2027-02-30 → 2027-03-02); a calendar
  // round-trip keeps the schema honest instead of silently shifting a waiver.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

/** True when a string is a real calendar date in YYYY-MM-DD form. */
function isValidAllowlistDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && parseAllowlistDate(value) !== null;
}

/**
 * Per-entry expiry classification (schema v3): a waiver whose `expires` day is
 * before today fails closed; a waiver inside the inclusive 60-day warning
 * window is surfaced without failing. `now` is injectable so the self-test
 * stays deterministic.
 */
function classifyExpiry(allowlist, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const warningLimit = new Date(today);
  warningLimit.setDate(warningLimit.getDate() + EXPIRY_WARNING_WINDOW_DAYS);
  const expired = [];
  const expiringSoon = [];
  for (const entry of allowlist) {
    const expires = parseAllowlistDate(entry.expires);
    if (expires === null) {
      // Schema validation rejects this; fail closed if it ever gets here.
      expired.push(entry);
      continue;
    }
    if (expires < today) expired.push(entry);
    else if (expires <= warningLimit) expiringSoon.push(entry);
  }
  return { expired, expiringSoon };
}

/** Print expiry diagnostics; expired waivers are errors, near-expiry warn. */
function reportExpiry({ expired, expiringSoon }) {
  for (const entry of expiringSoon) {
    console.warn(
      `EXPIRING_SOON_JEST_SKIP_WAIVER: ${entry.file} (${entry.testPattern}) (expires ${entry.expires})`,
    );
  }
  for (const entry of expired) {
    console.error(`EXPIRED_JEST_SKIP_WAIVER: ${entry.file} (${entry.testPattern})`);
  }
}

/**
 * Classify, report and fail closed on expired waivers. Warnings never throw;
 * the classification result is returned for callers that need it.
 */
function enforceExpiry(allowlist, now = new Date()) {
  const expiry = classifyExpiry(allowlist, now);
  reportExpiry(expiry);
  if (expiry.expired.length) {
    throw new Error(
      `${expiry.expired.length} expired jest-skip allowlist entr${expiry.expired.length === 1 ? 'y' : 'ies'} — renew the review window or remove them`,
    );
  }
  return expiry;
}

/** Earliest expiry across the allowlist (ISO dates sort lexicographically). */
function earliestExpiry(allowlist) {
  return allowlist.map((entry) => entry.expires).sort()[0];
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

  // Per-entry expiry (schema v3): an expired waiver fails closed, a waiver
  // inside the inclusive 60-day window warns without failing, and a
  // far-future waiver stays quiet. `now` is fixed for determinism.
  const expiryNow = new Date('2026-09-21T12:00:00');
  const expired = classifyExpiry([{ ...allowlist[0], expires: '2026-09-20' }], expiryNow);
  assert.equal(expired.expired.length, 1, 'waiver expiring before today must be an error');
  assert.equal(expired.expiringSoon.length, 0, 'expired waiver must not double as a warning');
  const nearExpiry = classifyExpiry([{ ...allowlist[0], expires: '2026-11-20' }], expiryNow);
  assert.equal(nearExpiry.expired.length, 0, 'waiver inside the window must not be an error');
  assert.equal(nearExpiry.expiringSoon.length, 1, 'waiver expiring exactly 60 days out must warn');
  const farFuture = classifyExpiry([{ ...allowlist[0], expires: '2030-01-01' }], expiryNow);
  assert.equal(farFuture.expired.length + farFuture.expiringSoon.length, 0, 'far-future waiver must stay quiet');
  const shippedExpiry = classifyExpiry(allowlist, expiryNow);
  assert.equal(
    shippedExpiry.expired.length,
    0,
    'no shipped waiver may be expired at the pinned review date',
  );
  // Renewal-safe invariant: entries must carry a real calendar date, but the
  // self-test must not pin the exact date/count or a legitimate renewal would
  // turn CI red.
  assert.ok(
    allowlist.every((entry) => isValidAllowlistDate(entry.expires)),
    'every shipped allowlist entry carries a real calendar expiry',
  );

  // Schema v3: legacy versions and missing/invalid review or expiry metadata
  // are rejected.
  assert.throws(() => validateAllowlistValue({ schemaVersion: 1, entries: [] }, 'fixture'), /invalid allowlist schema/);
  assert.throws(() => validateAllowlistValue({ schemaVersion: 2, entries: [] }, 'fixture'), /invalid allowlist schema/);
  assert.throws(
    () => validateAllowlistValue({ schemaVersion: 3, entries: [{ ...allowlist[0], reviewedAt: undefined }] }, 'fixture'),
    /missing required fields/,
  );
  assert.throws(
    () => validateAllowlistValue({ schemaVersion: 3, entries: [{ ...allowlist[0], reviewedAt: 'yesterday' }] }, 'fixture'),
    /invalid reviewedAt/,
  );
  assert.throws(
    () => validateAllowlistValue({ schemaVersion: 3, entries: [{ ...allowlist[0], expires: undefined }] }, 'fixture'),
    /missing required fields/,
  );
  assert.throws(
    () => validateAllowlistValue({ schemaVersion: 3, entries: [{ ...allowlist[0], expires: '2027/03/31' }] }, 'fixture'),
    /invalid expires/,
  );
  assert.throws(
    () => validateAllowlistValue({ schemaVersion: 3, entries: [{ ...allowlist[0], expires: '2027-13-01' }] }, 'fixture'),
    /invalid expires/,
  );
  assert.throws(
    () => validateAllowlistValue({ schemaVersion: 3, entries: [{ ...allowlist[0], expires: '2027-02-30' }] }, 'fixture'),
    /invalid expires/,
    'impossible calendar dates must be rejected, not rolled over',
  );
  console.log('validate-jest-signal self-test: PASS');
}

/**
 * `--check-allowlist` (schema v3): validate the shipped allowlist without a
 * Jest summary. Schema failures, stale entries and expired waivers exit
 * non-zero; near-expiry waivers warn and exit zero.
 */
function checkAllowlist() {
  try {
    const allowlist = loadAllowlist(defaultAllowlist);
    const stale = findStaleEntries(allowlist);
    if (stale.length) {
      for (const { entry, reason } of stale) {
        console.error(`STALE_ALLOWLIST_ENTRY: ${entry.file} (${entry.testPattern}) — ${reason}`);
      }
      throw new Error(`${stale.length} stale jest-skip allowlist entr${stale.length === 1 ? 'y' : 'ies'} — update or remove them`);
    }
    enforceExpiry(allowlist);
    console.log(
      `validate-jest-signal: allowlist OK — ${allowlist.length} entries, earliest expiry ${earliestExpiry(allowlist)}`,
    );
  } catch (error) {
    console.error(`validate-jest-signal: FAIL — ${error.message}`);
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  selfTest();
} else if (args.includes('--check-allowlist')) {
  checkAllowlist();
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
      enforceExpiry(allowlist);
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
