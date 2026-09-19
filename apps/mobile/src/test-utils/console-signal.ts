/**
 * Console signal contract (Campaign 053, tasks 3.1–3.4).
 *
 * The standard suite used to emit uncontrolled console noise — React `act`
 * warnings, animation updates outside `act`, a deprecated `findBy*` timeout
 * option, and expected persistence exceptions printed indistinguishably from
 * real failures. This module makes that signal reviewable:
 *
 * - `installConsoleSignalGuard()` runs from `jest/setup.js` and fails the test
 *   that produced an UNEXPECTED console error/warning;
 * - `expectConsoleNoise(pattern, fn)` marks a deliberately exercised error path
 *   as expected for exactly one test, and asserts the expected message really
 *   occurred (a restored assertion, not a mute);
 * - the baseline below is empty: every known noise class was repaired at the
 *   source (awaited `fireEvent`, `act`-wrapped fake-timer flows, the supported
 *   `findBy*` 3rd-argument option, prototype-preserving repository test
 *   doubles). An entry is only added with a reviewed owner and reason.
 *
 * This is intentionally NOT a global `console.error` mute: the guard replaces
 * the reporter only while asserting, then restores it, and it fails closed on
 * anything not explicitly expected.
 */
import { expect } from '@jest/globals';

/** A reviewed, currently-empty baseline of tolerated console messages. */
export interface ConsoleBaselineEntry {
  /** Substring that must appear in the message to match. */
  readonly match: string;
  /** Owning test file (repo-relative) that is allowed to emit it. */
  readonly owner: string;
  /** Why this message is tolerable and who reviews it. */
  readonly reason: string;
}

export const CONSOLE_BASELINE: readonly ConsoleBaselineEntry[] = [];

interface ConsoleSignalState {
  expected: { pattern: RegExp; matches: number; max: number }[];
  violations: string[];
  active: boolean;
}

const state: ConsoleSignalState = {
  expected: [],
  violations: [],
  active: false,
};

function messageOf(args: unknown[]): string {
  return args
    .map((value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.message;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join(' ');
}

function isExpected(message: string): boolean {
  for (const entry of state.expected) {
    if (entry.pattern.test(message) && entry.matches < entry.max) {
      entry.matches += 1;
      return true;
    }
  }
  const owner = (expect.getState().testPath ?? '').replace(/\\/g, '/');
  return CONSOLE_BASELINE.some(
    (entry) => owner.endsWith(entry.owner) && message.includes(entry.match),
  );
}

/**
 * Install the guard on `console.error`/`console.warn`. Called once from the
 * Jest setup file. Violations accumulate and are asserted by
 * `assertNoUnexpectedConsoleOutput()`, which the setup also wires into
 * `afterEach` so a failing signal is attributed to the test that produced it.
 */
export function installConsoleSignalGuard(): void {
  if (state.active) {
    return;
  }
  state.active = true;

  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const message = messageOf(args);
      if (isExpected(message)) {
        return;
      }
      // React's act() warnings are actionable and therefore violations.
      state.violations.push(`[console.${level}] ${message.slice(0, 400)}`);
      original(...args);
    };
  }
}

/**
 * Mark a console message as expected for the duration of one test and assert
 * it actually occurred. Restores the expectation when `fn` settles, so a
 * message that stops happening fails the test instead of silently passing.
 */
export async function expectConsoleNoise(
  pattern: RegExp,
  fn: () => Promise<void> | void,
  options: { max?: number } = {},
): Promise<void> {
  const entry = { pattern, matches: 0, max: options.max ?? 1 };
  state.expected.push(entry);
  try {
    await fn();
  } finally {
    const index = state.expected.indexOf(entry);
    if (index >= 0) {
      state.expected.splice(index, 1);
    }
  }
  if (entry.matches === 0) {
    throw new Error(
      `expectConsoleNoise: no console message matched ${pattern} — the expected error path was not exercised`,
    );
  }
}

/** Throw when this test emitted console output outside an expected scope. */
export function assertNoUnexpectedConsoleOutput(): void {
  if (state.violations.length === 0) {
    return;
  }
  const violations = state.violations.splice(0, state.violations.length);
  throw new Error(
    `Unexpected console output (${violations.length}). Repair the source or scope it with expectConsoleNoise():\n${violations.join('\n')}`,
  );
}

/** Clear accumulated violations (used between tests by the setup hook). */
export function resetConsoleSignal(): void {
  state.violations.length = 0;
  state.expected.length = 0;
}
