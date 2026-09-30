/**
 * Bounded validation diagnostics (Change 070, design D3).
 *
 * THE PROBLEM. Import validation deliberately collects every problem instead of
 * failing on the first, so a hand-edited backup reports all of its issues at
 * once. That is the right behavior — and it made the cost proportional to the
 * number of problems. A size-legal backup (the envelope cap is 64 MB of text)
 * can contain hundreds of thousands of invalid rows, and every one of them
 * allocated a string that was concatenated into a single error message. A
 * hostile or merely corrupt file could therefore turn a validation failure into
 * an allocation failure, which is the worst possible trade: the user sees an
 * out-of-memory error instead of the reason their backup was rejected.
 *
 * WHY TRUNCATION ALONE IS NOT A FIX. Capping the retained list *after* the
 * strings have been built does not bound anything — the memory was already
 * spent. The budget therefore has to be enforced at the point of appending:
 * once the budget is exhausted, validation stops *building* messages and keeps
 * *counting*.
 *
 * THE COUNTING IS THE POINT. A counter is what lets the final message say "and
 * 12,043 more" instead of quietly showing a prefix. A user who sees a truncated
 * report must be able to tell that it is truncated; a user who sees a short
 * report with no notice is being misled into thinking the file had five
 * problems when it had twelve thousand.
 *
 * THE TWO TIERS. Per-row problems are numerous, repetitive, and individually
 * low-value ("entry X is missing/invalid fields" repeated 50,000 times tells a
 * user nothing they do not already know). Structural problems — a section that
 * is not an array, a profile object with the wrong shape — are few, and are the
 * ones a user can actually act on. The budget is split so truncation can never
 * evict the actionable class in favour of the repetitive one.
 */

/** Which class of problem a diagnostic belongs to. Lower tiers survive first. */
export type DiagnosticTier = 'structural' | 'row';

/** How many messages of each class are retained before truncation begins. */
export const DEFAULT_TIER_LIMITS: Readonly<Record<DiagnosticTier, number>> = {
  // Structural problems are bounded by the schema, not by the data: there is
  // one "data.x must be an array" per section and one profile problem. 20 is
  // generous enough to hold every possible structural message.
  structural: 20,
  // Per-row problems are unbounded in principle. 30 is enough to show the
  // shape of a problem and name a few concrete examples without letting a
  // corrupt file dictate the size of an error message.
  row: 30,
};

/** A diagnostic and the tier it was recorded at (ordering is tier-first). */
export interface RetainedDiagnostic {
  tier: DiagnosticTier;
  message: string;
}

export interface DiagnosticsBudgetOptions {
  tierLimits?: Partial<Record<DiagnosticTier, number>>;
}

/**
 * A bounded, always-counting collector of validation diagnostics.
 *
 * One instance is used per validation pass, so the budget is per-import rather
 * than global: a second import starts with a clean budget and cannot be starved
 * by the first.
 *
 * WHAT IS ACTUALLY BOUNDED, stated precisely so nobody assumes more than is
 * true. A validation pass can see hundreds of thousands of invalid rows, and
 * every call site builds a short template string for its message. Those
 * template strings are transient: one is created, found to be over budget,
 * dropped, and garbage-collected. The unbounded cost this module removes is the
 * RETAINED set — the array that was previously grown without limit and then
 * joined into a single error message of unbounded size, which is what turned a
 * validation failure into an out-of-memory failure on a corrupt 64 MB file.
 *
 * Bounded here: the number of retained messages, the size of the joined
 * report, and the size of the `Error.message` a caller renders into UI or a log
 * line. Not bounded: the transient string per reported problem, which is
 * negligible next to the parsed row that produced it (a parsed session object is
 * orders of magnitude larger than its message).
 */
export class DiagnosticsBudget {
  private readonly limits: Readonly<Record<DiagnosticTier, number>>;
  private readonly retained: RetainedDiagnostic[] = [];
  /** Problems recorded in total, including the ones not retained. */
  private totalCount = 0;
  /** Problems dropped because their tier's budget was exhausted. */
  private readonly droppedByTier: Record<DiagnosticTier, number> = {
    structural: 0,
    row: 0,
  };

  constructor(options: DiagnosticsBudgetOptions = {}) {
    this.limits = { ...DEFAULT_TIER_LIMITS, ...(options.tierLimits ?? {}) };
  }

  /**
   * Record one problem of the given class.
   *
   * Always increments the total. Retains the message only while the matching
   * tier has budget left.
   */
  note(tier: DiagnosticTier, message: string): void {
    this.totalCount += 1;
    if (this.retainedInTier(tier) < this.limits[tier]) {
      this.retained.push({ tier, message });
      return;
    }
    this.droppedByTier[tier] += 1;
  }

  /**
   * Whether `tier` still has room. Exposed so a caller that must do real work
   * to produce a message (not merely a template literal) can skip that work
   * instead of paying for it.
   */
  hasRoom(tier: DiagnosticTier): boolean {
    return this.retainedInTier(tier) < this.limits[tier];
  }

  private retainedInTier(tier: DiagnosticTier): number {
    let count = 0;
    for (const entry of this.retained) if (entry.tier === tier) count += 1;
    return count;
  }

  /** Total problems recorded, retained or not. */
  get total(): number {
    return this.totalCount;
  }

  /** Problems that were counted but not retained. */
  get dropped(): number {
    return this.droppedByTier.structural + this.droppedByTier.row;
  }

  /** True when at least one problem was counted but not retained. */
  get truncated(): boolean {
    return this.dropped > 0;
  }

  /**
   * The retained diagnostics, structural class first, each class in the order it
   * was recorded. Ordering by tier is what guarantees the actionable messages
   * survive truncation.
   */
  entries(): RetainedDiagnostic[] {
    return [
      ...this.retained.filter((entry) => entry.tier === 'structural'),
      ...this.retained.filter((entry) => entry.tier === 'row'),
    ];
  }

  /** The retained messages, ready to hand to an error constructor. */
  messages(): string[] {
    return this.entries().map((entry) => entry.message);
  }

  /**
   * The explicit truncation notice appended to a truncated report.
   *
   * Reports the exact total and the per-class drop counts, because "and N more"
   * without saying which kind of problem was dropped is only half an answer.
   */
  truncationNotice(): string | null {
    if (!this.truncated) return null;
    const parts: string[] = [];
    if (this.droppedByTier.row > 0) parts.push(`${this.droppedByTier.row} more row-level`);
    if (this.droppedByTier.structural > 0) parts.push(`${this.droppedByTier.structural} more structural`);
    return (
      `${this.total} problems found in total; showing the first ${this.retained.length}. ` +
      `Not shown: ${parts.join(' and ')} problem(s).`
    );
  }

  /**
   * The final report: retained messages (structural first) plus the truncation
   * notice when there was one. Returns an empty array when nothing was
   * recorded, so the caller keeps its existing "only throw when non-empty"
   * shape.
   */
  report(): string[] {
    const messages = this.messages();
    const notice = this.truncationNotice();
    return notice ? [...messages, notice] : messages;
  }
}

/**
 * A drop-in replacement for the validator's old unbounded `issues` array.
 *
 * Exists so the 27 `issues.push(...)` call sites keep their shape and their
 * argument evaluation (each is a template literal whose `echoId()` already
 * bounds any attacker-controlled value), while retention and the final report
 * become bounded. `push` is the ROW class; `pushStructural` is the
 * shape-of-a-section class, which is what a user can actually act on and which
 * must therefore survive truncation.
 *
 * Reads as a plain array to the validator, so the diff is the two call sites
 * that need the other tier plus the final construction — not 27 mechanical
 * edits, and no chance of introducing a syntax error into validation logic that
 * every import depends on.
 */
export class IssueRecorder {
  constructor(private readonly budget: DiagnosticsBudget) {}

  /** Record a per-entry problem (the unbounded class). */
  push(message: string): void {
    this.budget.note('row', message);
  }

  /** Record a section-shape problem (the bounded, actionable class). */
  pushStructural(message: string): void {
    this.budget.note('structural', message);
  }

  /** True when at least one problem was recorded. */
  get hasProblems(): boolean {
    return this.budget.total > 0;
  }

  /**
   * The final, bounded report: retained messages (structural first) plus an
   * explicit truncation notice when anything was dropped.
   */
  report(): string[] {
    return this.budget.report();
  }
}
