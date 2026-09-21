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
 * unclassified skip, ambiguous match, malformed allowlist entry, or result
 * shape it cannot interpret. Schema v4 pins each waiver exactly:
 *
 *   - `expectedMatches` (positive integer) is the reviewed number of pending
 *     tests the entry may match in one run. A count mismatch fails, so a new
 *     `it.skip` whose name merely contains an allowlisted pattern cannot be
 *     absorbed by an entry that was reviewed for a different test.
 *   - `minTotalSuites` / `minTotalTests` are reviewed top-level floors; a run
 *     below either fails even when every discovered skip is classified, so a
 *     silently collapsing test matrix cannot pass green.
 *
 * Stale-entry detection still requires every entry's file and `enableWith`
 * gate to exist, every entry carries review metadata (`reviewedAt`) plus an
 * `expires` date (fails closed once passed, warns inside the 60-day window),
 * and an entry that matched zero pending tests is an orphan exemption.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const defaultAllowlist = path.join(root, 'scripts', 'certification', 'jest-skip-allowlist.json');
const ALLOWLIST_SCHEMA_VERSION = 4;
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

/**
 * Pure allowlist schema validation (schema v4: review/expiry metadata,
 * per-entry exact match pins and reviewed suite/test floors required).
 * Returns `{ entries, minTotalSuites, minTotalTests }`.
 */
function validateAllowlistValue(value, file) {
  if (value?.schemaVersion !== ALLOWLIST_SCHEMA_VERSION || !Array.isArray(value.entries)) {
    throw new Error(
      `invalid allowlist schema: ${file} (expected schemaVersion ${ALLOWLIST_SCHEMA_VERSION} with entries[])`,
    );
  }
  for (const floorField of ['minTotalSuites', 'minTotalTests']) {
    const floor = value[floorField];
    if (!Number.isInteger(floor) || floor <= 0) {
      throw new Error(
        `invalid allowlist schema: ${file} (${floorField} must be a positive integer, got ${floor})`,
      );
    }
  }
  const seen = new Set();
  const entries = value.entries.map((entry, index) => {
    if (
      typeof entry?.file !== 'string' ||
      typeof entry?.testPattern !== 'string' ||
      typeof entry?.testFullName !== 'string' ||
      typeof entry?.enableWith !== 'string' ||
      typeof entry?.rationale !== 'string' ||
      typeof entry?.owner !== 'string' ||
      typeof entry?.reviewedAt !== 'string' ||
      typeof entry?.expires !== 'string' ||
      !entry.file ||
      !entry.testPattern ||
      !entry.testFullName ||
      !entry.enableWith
    ) {
      throw new Error(`allowlist entry ${index} is missing required fields`);
    }
    if (!Number.isInteger(entry.expectedMatches) || entry.expectedMatches <= 0) {
      throw new Error(
        `allowlist entry ${index} has invalid expectedMatches '${entry.expectedMatches}' (want a positive integer)`,
      );
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
  return {
    entries,
    minTotalSuites: value.minTotalSuites,
    minTotalTests: value.minTotalTests,
  };
}

/**
 * Stale-entry detection (campaign 028, task 4.5): every allowlisted skip must
 * still point at an existing test file that still contains its `enableWith`
 * gate. A renamed/deleted file or a removed/renamed gate must fail closed
 * instead of silently exempting nothing.
 */
function findStaleEntries(entries) {
  const stale = [];
  for (const entry of entries) {
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
function classifyExpiry(entries, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const warningLimit = new Date(today);
  warningLimit.setDate(warningLimit.getDate() + EXPIRY_WARNING_WINDOW_DAYS);
  const expired = [];
  const expiringSoon = [];
  for (const entry of entries) {
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
function enforceExpiry(entries, now = new Date()) {
  const expiry = classifyExpiry(entries, now);
  reportExpiry(expiry);
  if (expiry.expired.length) {
    throw new Error(
      `${expiry.expired.length} expired jest-skip allowlist entr${expiry.expired.length === 1 ? 'y' : 'ies'} — renew the review window or remove them`,
    );
  }
  return expiry;
}

/** Earliest expiry across the allowlist (ISO dates sort lexicographically). */
function earliestExpiry(entries) {
  return entries.map((entry) => entry.expires).sort()[0];
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

/**
 * Reviewed suite/test floors (schema v4): a run below either pinned minimum
 * means test discovery silently collapsed, so the gate fails closed even when
 * every discovered test passed. Intentional floor reductions require an
 * explicit reviewed change (see `floorsNote` in the allowlist).
 */
function floorViolations(summaryCounts, allowlist) {
  const violations = [];
  if (summaryCounts.totalSuites < allowlist.minTotalSuites) {
    violations.push({
      field: 'totalSuites',
      actual: summaryCounts.totalSuites,
      minimum: allowlist.minTotalSuites,
    });
  }
  if (summaryCounts.totalTests < allowlist.minTotalTests) {
    violations.push({
      field: 'totalTests',
      actual: summaryCounts.totalTests,
      minimum: allowlist.minTotalTests,
    });
  }
  return violations;
}

function validate(summary, allowlist) {
  const pending = pendingAssertions(summary);
  const classifications = pending.map((item) => {
    const matches = allowlist.entries.filter((entry) => {
      if (item.file !== entry.file) return false;
      if (item.fullName) {
        // Schema v4 pins the EXACT reviewed test name (campaign 065 closure):
        // a renamed/replaced skip can no longer be absorbed by a substring
        // match with the same count.
        return item.fullName === entry.testFullName;
      }
      return item.suiteName.includes(entry.suitePattern ?? entry.testPattern);
    });
    return { ...item, matches };
  });
  const unclassified = classifications.filter((item) => item.matches.length === 0);
  const ambiguous = classifications.filter((item) => item.matches.length > 1);

  // Exact pinning (schema v4): an entry may absorb exactly `expectedMatches`
  // pending signals in a run. A second `it.skip` inside the same suite whose
  // name merely contains the reviewed pattern therefore fails the count.
  const matchedCounts = new Map();
  for (const item of classifications) {
    for (const entry of item.matches) {
      const key = `${entry.file}\n${entry.testPattern}`;
      matchedCounts.set(key, (matchedCounts.get(key) ?? 0) + 1);
    }
  }
  const countMismatches = allowlist.entries
    .map((entry) => ({
      entry,
      expectedMatches: entry.expectedMatches,
      matched: matchedCounts.get(`${entry.file}\n${entry.testPattern}`) ?? 0,
    }))
    .filter(({ expectedMatches, matched }) => matched !== expectedMatches);

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
  const floors = floorViolations(summaryCounts, allowlist);
  const report = {
    schemaVersion: 1,
    source: 'jest-json',
    allowlistEntryCount: allowlist.entries.length,
    counts: summaryCounts,
    floors: {
      minTotalSuites: allowlist.minTotalSuites,
      totalSuites: summaryCounts.totalSuites,
      minTotalTests: allowlist.minTotalTests,
      totalTests: summaryCounts.totalTests,
      pass: floors.length === 0,
    },
    classifiedSkipCount: classifications.length,
    unclassifiedSkipCount: unclassified.length,
    ambiguousSkipCount: ambiguous.length,
    countMismatchCount: countMismatches.length,
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
    pass: unclassified.length === 0
      && ambiguous.length === 0
      && countMismatches.length === 0
      && floors.length === 0,
  };
  return { report, unclassified, ambiguous, countMismatches, floorViolations: floors, classifications };
}

/**
 * Orphan-entry detection (frontier audit `certify-provenance-parity`): an
 * allowlist row that matched no pending test in this run exempts nothing — the
 * skip it justified was removed, renamed or re-enabled. Fail closed instead of
 * leaving a dead exemption behind.
 */
function findOrphanEntries(entries, classifications) {
  const matched = new Set();
  for (const item of classifications) {
    for (const entry of item.matches) {
      matched.add(`${entry.file}\n${entry.testPattern}`);
    }
  }
  return entries.filter(
    (entry) => !matched.has(`${entry.file}\n${entry.testPattern}`),
  );
}

/**
 * Pure failure-line builder for the summary gate: one line per unclassified
 * skip, ambiguous skip, per-entry count mismatch and below-floor count. Kept
 * separate from `assertPass` so the self-test can assert failures without
 * printing a full report dump.
 */
function failureLines(unclassified, ambiguous, countMismatches = [], floors = []) {
  const lines = [];
  for (const item of unclassified) {
    lines.push(`UNCLASSIFIED_JEST_SKIP: ${item.file} :: ${item.fullName}`);
  }
  for (const item of ambiguous) {
    lines.push(`AMBIGUOUS_JEST_SKIP: ${item.file} :: ${item.fullName}`);
  }
  for (const { entry, expectedMatches, matched } of countMismatches) {
    lines.push(
      `COUNT_MISMATCH_JEST_SKIP: ${entry.file} (${entry.testPattern}) — pinned expectedMatches=${expectedMatches}, matched ${matched} pending test(s)`,
    );
  }
  for (const { field, actual, minimum } of floors) {
    lines.push(`JEST_SUMMARY_BELOW_FLOOR: ${field}=${actual} < reviewed minimum ${minimum}`);
  }
  return lines;
}

function assertPass(report, unclassified, ambiguous, countMismatches = [], floors = []) {
  const lines = failureLines(unclassified, ambiguous, countMismatches, floors);
  if (lines.length) {
    console.error(JSON.stringify(report, null, 2));
    for (const line of lines) console.error(line);
    throw new Error(
      'Jest signal integrity failed: every skipped test must match exactly one allowlist entry with its pinned count, and the run must meet the reviewed suite/test floors',
    );
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

/**
 * Synthetic "everything is allowlisted" summary: each entry yields exactly
 * `expectedMatches` pending signals. The first entry is reported at file level
 * (a skipped describe) to keep that Jest shape covered; the rest arrive as
 * pending assertions. Totals are pinned to the reviewed floors so the happy
 * path exercises the floor check's passing branch.
 */
function allAllowlistedSummary() {
  const allowlist = loadAllowlist(defaultAllowlist);
  const testResults = allowlist.entries.flatMap((entry, index) => {
    const name = path.join(root, entry.file);
    if (index === 0) {
      return Array.from({ length: entry.expectedMatches }, () => ({
        name,
        status: 'pending',
        message: entry.suitePattern,
        assertionResults: [],
      }));
    }
    return [{
      name,
      status: 'passed',
      message: entry.suitePattern,
      assertionResults: Array.from({ length: entry.expectedMatches }, (_, i) => ({
        ancestorTitles: [entry.suitePattern],
        title: entry.testFullName.split(' ').slice(-1)[0],
        fullName: i === 0 ? entry.testFullName : `${entry.testFullName} (fixture ${i + 1})`,
        status: 'pending',
      })),
    }];
  });
  const skipped = allowlist.entries.reduce((sum, entry) => sum + entry.expectedMatches, 0);
  return {
    numPassedTestSuites: allowlist.entries.length,
    numFailedTestSuites: 0,
    numPendingTestSuites: 0,
    numTotalTestSuites: allowlist.minTotalSuites,
    numPassedTests: allowlist.minTotalTests - skipped,
    numFailedTests: 0,
    numPendingTests: skipped,
    numTodoTests: 0,
    numTotalTests: allowlist.minTotalTests,
    testResults,
  };
}

function selfTest() {
  const allowlist = loadAllowlist(defaultAllowlist);
  const good = validate(allAllowlistedSummary(), allowlist);
  assert.equal(good.unclassified.length, 0);
  assert.equal(good.ambiguous.length, 0);
  assert.equal(good.countMismatches.length, 0, 'shipped pins must match the synthetic fixture exactly');
  assert.equal(good.report.classifiedSkipCount, allowlist.entries.length);
  assert.equal(good.report.pass, true, 'fully classified summary above the floors must pass');

  const badSummary = syntheticSummary();
  badSummary.testResults[0].assertionResults[0].fullName = 'unowned skip';
  const bad = validate(badSummary, allowlist);
  assert.equal(bad.unclassified.length, 1);

  const nonPending = validate(syntheticSummary('passed'), allowlist);
  assert.equal(nonPending.report.classifiedSkipCount, 0);

  // Exact pinning (schema v4, campaign 065 closure): the entry matches its
  // EXACT reviewed full name. An extra pending test inside the same suite is
  // unclassified (not absorbed), and a renamed replacement is unclassified
  // too while the pinned entry reports a count mismatch.
  const extraSkipSummary = allAllowlistedSummary();
  const targetEntry = allowlist.entries[1];
  const targetResult = extraSkipSummary.testResults.find(
    (result) => result.name === path.join(root, targetEntry.file),
  );
  assert.ok(targetResult, 'fixture must contain the second allowlist entry file');
  targetResult.assertionResults.push({
    ancestorTitles: [targetEntry.suitePattern],
    title: 'unreviewed extra pending test',
    fullName: `${targetEntry.suitePattern} unreviewed extra pending test`,
    status: 'pending',
  });
  const extraSkip = validate(extraSkipSummary, allowlist);
  assert.equal(extraSkip.unclassified.length, 1, 'a substring-only extra skip is unclassified');
  assert.equal(extraSkip.ambiguous.length, 0);
  assert.equal(extraSkip.report.pass, false, 'an extra skip inside an allowlisted suite must fail the signal');
  assert.ok(
    failureLines(extraSkip.unclassified, extraSkip.ambiguous, extraSkip.countMismatches, extraSkip.floorViolations)
      .some((line) => line.includes('UNCLASSIFIED_JEST_SKIP')),
    'the unclassified skip must be reported as a failure line',
  );

  // Renamed replacement: the reviewed name disappears and a lookalike takes
  // its place — the pinned entry misses (count mismatch) and the lookalike is
  // unclassified, so a one-for-one swap cannot pass.
  const renamedSummary = allAllowlistedSummary();
  const renamedResult = renamedSummary.testResults.find(
    (result) => result.name === path.join(root, targetEntry.file),
  );
  assert.ok(renamedResult, 'fixture must contain the second allowlist entry file');
  renamedResult.assertionResults[0].fullName = `${targetEntry.testFullName} (v2)`;
  renamedResult.assertionResults[0].title = 'lookalike';
  const renamed = validate(renamedSummary, allowlist);
  assert.equal(renamed.unclassified.length, 1, 'the lookalike skip is unclassified');
  assert.equal(renamed.countMismatches.length, 1, 'the pinned entry no longer matches its reviewed name');
  assert.equal(renamed.countMismatches[0].matched, 0);
  assert.equal(renamed.report.pass, false, 'a renamed replacement must fail the signal');

  // Reviewed floors (schema v4): a summary below either floor fails even when
  // every discovered skip classifies correctly, and both counts are reported.
  const belowTestFloor = allAllowlistedSummary();
  belowTestFloor.numTotalTests = allowlist.minTotalTests - 1;
  const lowTests = validate(belowTestFloor, allowlist);
  assert.equal(lowTests.countMismatches.length, 0);
  assert.equal(lowTests.floorViolations.length, 1);
  assert.equal(lowTests.floorViolations[0].field, 'totalTests');
  assert.equal(lowTests.report.floors.totalTests, allowlist.minTotalTests - 1);
  assert.equal(lowTests.report.floors.minTotalTests, allowlist.minTotalTests);
  assert.equal(lowTests.report.pass, false, 'a run below the test floor must not pass');
  assert.ok(
    failureLines(lowTests.unclassified, lowTests.ambiguous, lowTests.countMismatches, lowTests.floorViolations)
      .some((line) => line.includes('JEST_SUMMARY_BELOW_FLOOR')),
    'the below-floor count must be reported as a failure line',
  );
  const belowSuiteFloor = allAllowlistedSummary();
  belowSuiteFloor.numTotalTestSuites = allowlist.minTotalSuites - 1;
  const lowSuites = validate(belowSuiteFloor, allowlist);
  assert.equal(lowSuites.floorViolations.length, 1);
  assert.equal(lowSuites.floorViolations[0].field, 'totalSuites');
  assert.equal(lowSuites.report.floors.totalSuites, allowlist.minTotalSuites - 1);

  // Stale-entry detection (campaign 028, task 4.5): the shipped allowlist must
  // be free of stale entries, and both stale shapes must be detected.
  assert.equal(findStaleEntries(allowlist.entries).length, 0, 'default allowlist must not be stale');
  assert.equal(
    findStaleEntries([{ ...allowlist.entries[0], file: 'apps/mobile/src/__tests__/does-not-exist.test.ts' }]).length,
    1,
  );
  assert.equal(findStaleEntries([{ ...allowlist.entries[1], enableWith: 'NO_SUCH_PROBE=1' }]).length, 1);

  // Orphan entries (frontier audit `certify-provenance-parity`): an entry that
  // matches zero current pending tests is stale even when its file and gate
  // still exist.
  const noPending = validate(syntheticSummary('passed'), allowlist);
  assert.equal(
    findOrphanEntries(allowlist.entries, noPending.classifications).length,
    allowlist.entries.length,
    'a summary with no pending tests must orphan every allowlist entry',
  );
  assert.equal(
    findOrphanEntries(allowlist.entries, [{ matches: [allowlist.entries[1]] }]).length,
    allowlist.entries.length - 1,
    'only the matched entry may be kept',
  );
  assert.equal(
    findOrphanEntries(allowlist.entries, good.classifications).length,
    0,
    'fully matched allowlist must have no orphans',
  );

  // Per-entry expiry (schema v3): an expired waiver fails closed, a waiver
  // inside the inclusive 60-day window warns without failing, and a
  // far-future waiver stays quiet. `now` is fixed for determinism.
  const expiryNow = new Date('2026-09-21T12:00:00');
  const expired = classifyExpiry([{ ...allowlist.entries[0], expires: '2026-09-20' }], expiryNow);
  assert.equal(expired.expired.length, 1, 'waiver expiring before today must be an error');
  assert.equal(expired.expiringSoon.length, 0, 'expired waiver must not double as a warning');
  const nearExpiry = classifyExpiry([{ ...allowlist.entries[0], expires: '2026-11-20' }], expiryNow);
  assert.equal(nearExpiry.expired.length, 0, 'waiver inside the window must not be an error');
  assert.equal(nearExpiry.expiringSoon.length, 1, 'waiver expiring exactly 60 days out must warn');
  const farFuture = classifyExpiry([{ ...allowlist.entries[0], expires: '2030-01-01' }], expiryNow);
  assert.equal(farFuture.expired.length + farFuture.expiringSoon.length, 0, 'far-future waiver must stay quiet');
  const shippedExpiry = classifyExpiry(allowlist.entries, expiryNow);
  assert.equal(
    shippedExpiry.expired.length,
    0,
    'no shipped waiver may be expired at the pinned review date',
  );
  // Renewal-safe invariant: entries must carry a real calendar date, but the
  // self-test must not pin the exact date/count or a legitimate renewal would
  // turn CI red.
  assert.ok(
    allowlist.entries.every((entry) => isValidAllowlistDate(entry.expires)),
    'every shipped allowlist entry carries a real calendar expiry',
  );

  // Schema v4: legacy versions, missing/invalid review metadata and expiry
  // dates, and missing/invalid exact-match pins or floors are all rejected.
  const v4Shell = {
    schemaVersion: 4,
    minTotalSuites: 1,
    minTotalTests: 1,
    entries: [allowlist.entries[0]],
  };
  for (const legacyVersion of [1, 2, 3]) {
    assert.throws(
      () => validateAllowlistValue({ ...v4Shell, schemaVersion: legacyVersion }, 'fixture'),
      /invalid allowlist schema/,
      `schemaVersion ${legacyVersion} must be rejected`,
    );
  }
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, minTotalSuites: undefined }, 'fixture'),
    /minTotalSuites/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, minTotalSuites: 0 }, 'fixture'),
    /minTotalSuites/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, minTotalTests: 1.5 }, 'fixture'),
    /minTotalTests/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], expectedMatches: undefined }] }, 'fixture'),
    /expectedMatches/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], expectedMatches: 0 }] }, 'fixture'),
    /expectedMatches/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], expectedMatches: '1' }] }, 'fixture'),
    /expectedMatches/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], reviewedAt: undefined }] }, 'fixture'),
    /missing required fields/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], reviewedAt: 'yesterday' }] }, 'fixture'),
    /invalid reviewedAt/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], expires: undefined }] }, 'fixture'),
    /missing required fields/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], expires: '2027/03/31' }] }, 'fixture'),
    /invalid expires/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], expires: '2027-13-01' }] }, 'fixture'),
    /invalid expires/,
  );
  assert.throws(
    () => validateAllowlistValue({ ...v4Shell, entries: [{ ...allowlist.entries[0], expires: '2027-02-30' }] }, 'fixture'),
    /invalid expires/,
    'impossible calendar dates must be rejected, not rolled over',
  );
  console.log('validate-jest-signal self-test: PASS');
}

/**
 * `--check-allowlist` (schema v4): validate the shipped allowlist without a
 * Jest summary. Schema failures, stale entries and expired waivers exit
 * non-zero; near-expiry waivers warn and exit zero.
 */
function checkAllowlist() {
  try {
    const allowlist = loadAllowlist(defaultAllowlist);
    const stale = findStaleEntries(allowlist.entries);
    if (stale.length) {
      for (const { entry, reason } of stale) {
        console.error(`STALE_ALLOWLIST_ENTRY: ${entry.file} (${entry.testPattern}) — ${reason}`);
      }
      throw new Error(`${stale.length} stale jest-skip allowlist entr${stale.length === 1 ? 'y' : 'ies'} — update or remove them`);
    }
    enforceExpiry(allowlist.entries);
    console.log(
      `validate-jest-signal: allowlist OK — ${allowlist.entries.length} entries, floors ${allowlist.minTotalSuites} suites / ${allowlist.minTotalTests} tests, earliest expiry ${earliestExpiry(allowlist.entries)}`,
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
      const stale = findStaleEntries(allowlist.entries);
      if (stale.length) {
        for (const { entry, reason } of stale) {
          console.error(`STALE_ALLOWLIST_ENTRY: ${entry.file} (${entry.testPattern}) — ${reason}`);
        }
        throw new Error(`${stale.length} stale jest-skip allowlist entr${stale.length === 1 ? 'y' : 'ies'} — update or remove them`);
      }
      enforceExpiry(allowlist.entries);
      const result = validate(readJson(summaryFile), allowlist);
      const orphans = findOrphanEntries(allowlist.entries, result.classifications);
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
      assertPass(result.report, result.unclassified, result.ambiguous, result.countMismatches, result.floorViolations);
    } catch (error) {
      console.error(`validate-jest-signal: FAIL — ${error.message}`);
      process.exitCode = 1;
    }
  }
}
