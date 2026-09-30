/**
 * Bounded import diagnostics (Change 070, design D3 / task 1.4).
 *
 * The defect these tests pin is a RESOURCE defect, not a correctness one, which
 * is why the existing validation tests could never have caught it: every one of
 * them used a handful of invalid rows, and a list of five is free. The failure
 * mode needs a size-legal backup carrying a very large number of invalid
 * entries, at which point the old unbounded `string[]` grew without limit and
 * was then joined into one `Error.message` — turning a validation failure into
 * an out-of-memory failure, so the user saw an OOM instead of the reason their
 * backup was rejected.
 *
 * The assertions are therefore about BOUNDS, not about specific messages:
 * a count that must not grow with the problem count, and a notice that must
 * always accompany truncation.
 */
import { describe, expect, it } from '@jest/globals';

import { parseAndValidateBackup } from '../deserialize';
import { DiagnosticsBudget, IssueRecorder, type DiagnosticTier } from '../diagnostics-budget';
import { BackupDataValidationError } from '../types';
import { buildEnvelope } from './helpers';

/** A size-legal, correctly-checksummed envelope around arbitrary `data`. */
function envelopeFor(data: unknown): string {
  // The shared helper computes the checksum over the canonical form, which is
  // what the real parser verifies — a hand-rolled envelope would fail the
  // integrity gate first and never reach the validation path under test.
  return JSON.stringify(buildEnvelope(data as Record<string, unknown>));
}

/** A session entry that fails validation, with a caller-controlled id. */
function invalidSession(id: string): Record<string, unknown> {
  return { id, gameId: null, gameVersion: 'not-a-number' };
}

/**
 * A data object with EVERY section present, so the only validation problems are
 * the ones a test deliberately introduces. Omitting a section would add a
 * "must be an array" problem, and those are reported first (they are the
 * actionable class) — which would hide the row-level messages under test.
 */
function dataWithOnly(rows: unknown[]): Record<string, unknown> {
  return {
    schemaVersion: 12,
    profile: null,
    gameSessions: rows,
    domainRatings: [],
    ratingHistory: [],
    currencyLedger: [],
    gameFavorites: [],
    xpAwards: [],
    tutorialState: [],
    workoutInstances: [],
    questDefinitions: [],
    questProgress: [],
    achievementDefinitions: [],
    achievementUnlocks: [],
  };
}

describe('DiagnosticsBudget bounds', () => {
  it('counts every problem but retains only the budgeted ones', () => {
    const budget = new DiagnosticsBudget();
    for (let i = 0; i < 10_000; i++) budget.note('row', `row problem ${i}`);

    expect(budget.total).toBe(10_000);
    // Retention stops with the budget; the count does not.
    expect(budget.messages().length).toBe(30);
    expect(budget.dropped).toBe(10_000 - 30);
    expect(budget.truncated).toBe(true);
  });

  it('is not truncated when the problem count fits the budget', () => {
    const budget = new DiagnosticsBudget();
    for (let i = 0; i < 5; i++) budget.note('row', `row problem ${i}`);
    expect(budget.truncated).toBe(false);
    expect(budget.dropped).toBe(0);
    expect(budget.truncationNotice()).toBeNull();
    // A clean report carries no notice at all — a user must be able to trust
    // the absence of a notice.
    expect(budget.report()).toHaveLength(5);
  });

  it('keeps the actionable structural class when the row class floods', () => {
    const budget = new DiagnosticsBudget();
    // 200 structural problems first: the row budget must NOT be able to evict
    // them, because a section that is not an array is something a user can fix.
    for (let i = 0; i < 200; i++) budget.note('structural', `structural problem ${i}`);
    for (let i = 0; i < 200; i++) budget.note('row', `row problem ${i}`);

    const entries = budget.entries();
    const structural = entries.filter((e) => e.tier === 'structural');
    const row = entries.filter((e) => e.tier === 'row');
    expect(structural.length).toBe(20);
    expect(row.length).toBe(30);
    // Structural first, so the most actionable messages survive truncation.
    expect(entries.slice(0, 20).every((e) => e.tier === 'structural')).toBe(true);
  });

  it('reports the exact total and per-class drop counts in the notice', () => {
    const budget = new DiagnosticsBudget();
    for (let i = 0; i < 100; i++) budget.note('row', `row ${i}`);
    budget.note('structural', 'shape is wrong');
    for (let i = 0; i < 100; i++) budget.note('row', `row ${i}`);

    const notice = budget.truncationNotice();
    expect(notice).not.toBeNull();
    // "and N more" without saying which kind was dropped is half an answer.
    expect(notice).toMatch(/201 problems found in total/);
    expect(notice).toMatch(/showing the first 31/);
    expect(notice).toMatch(/170 more row-level/);
  });

  it('reports a zero-problem budget as empty', () => {
    const budget = new DiagnosticsBudget();
    expect(budget.total).toBe(0);
    expect(budget.truncated).toBe(false);
    expect(budget.report()).toEqual([]);
  });

  it('starts a fresh budget per pass so one import cannot starve the next', () => {
    const first = new IssueRecorder(new DiagnosticsBudget());
    for (let i = 0; i < 1_000; i++) first.push(`problem ${i}`);
    expect(first.report().length).toBeLessThan(1_000);

    const second = new IssueRecorder(new DiagnosticsBudget());
    second.push('one problem');
    expect(second.report()).toEqual(['one problem']);
  });

  it('honours custom tier limits', () => {
    const budget = new DiagnosticsBudget({ tierLimits: { row: 2 } });
    for (let i = 0; i < 10; i++) budget.note('row', `row ${i}`);
    expect(budget.messages()).toEqual(['row 0', 'row 1']);
    expect(budget.total).toBe(10);
  });

  it('hasRoom reports budget state per tier', () => {
    const budget = new DiagnosticsBudget({ tierLimits: { structural: 1, row: 1 } });
    expect(budget.hasRoom('row')).toBe(true);
    budget.note('row', 'a');
    expect(budget.hasRoom('row')).toBe(false);
    // One tier exhausting must not affect the other.
    expect(budget.hasRoom('structural')).toBe(true);
  });
});

describe('import validation is bounded on a hostile-but-legal input', () => {
  const INVALID_ROWS = 12_000;

  it('completes with a bounded report and an explicit truncation notice', () => {
    const text = envelopeFor(
      dataWithOnly(Array.from({ length: INVALID_ROWS }, (_, i) => invalidSession(`s${i}`))),
    );

    // The input is size-legal: validation is reached, not the size gate.
    expect(text.length).toBeLessThan(64 * 1024 * 1024);

    let thrown: unknown;
    try {
      parseAndValidateBackup(text);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BackupDataValidationError);
    const error = thrown as BackupDataValidationError;

    // BOUNDED: the retained set and therefore the message size does not grow
    // with the number of problems. This is the whole point of the budget.
    expect(error.issues.length).toBeLessThanOrEqual(51); // 20 structural + 30 row + 1 notice
    expect(error.issues.length).toBeLessThan(INVALID_ROWS);
    expect(error.message.length).toBeLessThan(8_000);
    // Counted exactly, and the user is told the report is partial.
    const notice = error.issues[error.issues.length - 1];
    expect(notice).toMatch(new RegExp(`${INVALID_ROWS} problems found in total`));
    expect(notice).toMatch(/Not shown:/);
  });

  it('scales linearly in COUNT but not in retained memory as the input grows', () => {
    // A 10x larger corrupt file must not produce a 10x larger report. This is
    // the property that makes the fix a fix rather than a raised threshold.
    const measure = (rows: number): number => {
      const text = envelopeFor(
        dataWithOnly(Array.from({ length: rows }, (_, i) => invalidSession(`s${i}`))),
      );
      try {
        parseAndValidateBackup(text);
        return 0;
      } catch (error) {
        return (error as BackupDataValidationError).issues.length;
      }
    };
    const small = measure(100);
    const large = measure(10_000);
    expect(large).toBe(small);
  });

  it('produces a complete, untruncated report for a small invalid file', () => {
    try {
      parseAndValidateBackup(envelopeFor(dataWithOnly([invalidSession('a'), invalidSession('b')])));
      throw new Error('expected validation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(BackupDataValidationError);
      const issues = (error as BackupDataValidationError).issues;
      expect(issues.length).toBe(2);
      // No truncation notice: a short report must be trustworthy as complete.
      expect(issues.join(' ')).not.toMatch(/Not shown:/);
      expect(issues.join(' ')).not.toMatch(/problems found in total/);
    }
  });
});

describe('oversized field values are never echoed whole', () => {
  it('truncates an oversized id in the message with an explicit marker', () => {
    // A hostile id must not amplify into UI text, a toast, or a logcat line.
    const hugeId = 'x'.repeat(500_000);
    try {
      parseAndValidateBackup(envelopeFor(dataWithOnly([invalidSession(hugeId)])));
      throw new Error('expected validation to reject');
    } catch (error) {
      const issues = (error as BackupDataValidationError).issues;
      expect(issues).toHaveLength(1);
      // Bounded message, and the length is stated so nothing looks complete
      // when it is not.
      expect(issues[0].length).toBeLessThan(200);
      expect(issues[0]).toMatch(/chars\)/);
      // The oversized value is named but not reproduced.
      expect(issues[0].includes(hugeId)).toBe(false);
    }
  });

  it('renders a normal short id verbatim, so existing message contracts hold', () => {
    try {
      parseAndValidateBackup(envelopeFor(dataWithOnly([invalidSession('short-id')])));
      throw new Error('expected validation to reject');
    } catch (error) {
      const issues = (error as BackupDataValidationError).issues;
      expect(issues[0]).toContain('"short-id"');
      expect(issues[0]).not.toMatch(/chars\)/);
    }
  });
});

describe('IssueRecorder mirrors the array the validator used', () => {
  it('pushes into the row tier and reports nothing when unused', () => {
    const recorder = new IssueRecorder(new DiagnosticsBudget());
    expect(recorder.hasProblems).toBe(false);
    expect(recorder.report()).toEqual([]);
    recorder.push('a problem');
    expect(recorder.hasProblems).toBe(true);
    expect(recorder.report()).toEqual(['a problem']);
  });

  it('accepts both tiers and orders structural first in the report', () => {
    const recorder = new IssueRecorder(new DiagnosticsBudget());
    recorder.push('row first');
    recorder.pushStructural('structural second');
    // Order is by tier, not by insertion: the actionable message leads.
    expect(recorder.report()).toEqual(['structural second', 'row first']);
  });

  it('exposes the budget so a caller can skip expensive work when full', () => {
    const budget = new DiagnosticsBudget({ tierLimits: { structural: 1 } });
    const recorder = new IssueRecorder(budget);
    expect(budget.hasRoom('structural' satisfies DiagnosticTier)).toBe(true);
    recorder.pushStructural('one');
    expect(budget.hasRoom('structural')).toBe(false);
    // The caller can now skip building an expensive message entirely.
    expect(budget.total).toBe(1);
  });
});
