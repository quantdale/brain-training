/**
 * Console signal contract (Campaign 053, tasks 3.1–3.4; all-level coverage
 * added by Campaign 064).
 *
 * The standard suite used to emit uncontrolled console noise — React `act`
 * warnings, animation updates outside `act`, a deprecated `findBy*` timeout
 * option, and expected persistence exceptions printed indistinguishably from
 * real failures. This module makes that signal reviewable:
 *
 * - `installConsoleSignalGuard()` runs from `jest/setup.js` and fails the test
 *   that produced an UNEXPECTED console output on ANY guarded level
 *   (`error`, `warn`, `log`, `info`, `debug`);
 * - `expectConsoleNoise(pattern, fn)` marks a deliberately exercised output
 *   path as expected for exactly one test, asserts the expected message
 *   really occurred (a restored assertion, not a mute), and still forwards
 *   the message to the real console — expectations classify output, they do
 *   not suppress it;
 * - the baseline below is empty: every known noise class was repaired at the
 *   source (awaited `fireEvent`, `act`-wrapped fake-timer flows, the supported
 *   `findBy*` 3rd-argument option, prototype-preserving repository test
 *   doubles). An entry is only added with a reviewed owner and reason.
 *
 * This is intentionally NOT a global `console.*` mute: the guard wraps the
 * reporters for the whole run (violations are asserted per test by
 * `assertNoUnexpectedConsoleOutput()`), expected output is still emitted, and
 * anything not explicitly expected fails closed. Limitation: an emission that
 * arrives after the producing test has settled (an unawaited async callback)
 * cannot be attributed back to its test; such output is treated as a
 * violation of whatever test is current when it lands.
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

/**
 * Console levels the guard intercepts. `error`/`warn` were the campaign-053
 * boundary; campaign 064 extended the gate to every level on the theory that
 * any unscoped output in a passing test is unreviewed signal. A deliberate
 * emitter is scoped with `expectConsoleNoise`, never muted.
 */
export const GUARDED_CONSOLE_LEVELS = ['error', 'warn', 'log', 'info', 'debug'] as const;

interface ConsoleSignalState {
  expected: { pattern: RegExp; matches: number; max: number }[];
  violations: string[];
  active: boolean;
  /** The wrappers installed by the guard, for replacement detection. */
  installed: Partial<Record<(typeof GUARDED_CONSOLE_LEVELS)[number], (...args: unknown[]) => void>>;
}

const state: ConsoleSignalState = {
  expected: [],
  violations: [],
  active: false,
  installed: {},
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
 * Install the guard on every guarded console level. Called once from the
 * Jest setup file. Violations accumulate and are asserted by
 * `assertNoUnexpectedConsoleOutput()`, which the setup also wires into
 * `afterEach` so a failing signal is attributed to the test that produced it.
 */
export function installConsoleSignalGuard(): void {
  if (state.active) {
    return;
  }
  state.active = true;

  for (const level of GUARDED_CONSOLE_LEVELS) {
    const original = console[level].bind(console);
    const wrapper = (...args: unknown[]) => {
      const message = messageOf(args);
      if (isExpected(message)) {
        // Expected output is classified, not muted: the probe markers and
        // deliberate error paths still reach the real console.
        original(...args);
        return;
      }
      // React's act() warnings are actionable and therefore violations.
      state.violations.push(`[console.${level}] ${message.slice(0, 400)}`);
      original(...args);
    };
    console[level] = wrapper;
    state.installed[level] = wrapper;
    // Lock the property: a test-level `jest.spyOn(console, level)` would
    // otherwise replace the gate with a swallowing mock and silently hide
    // unexpected output. Deliberate output uses `expectConsoleNoise`.
    Object.defineProperty(console, level, { configurable: false, writable: false });
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
  // Defense in depth: if anything re-defined a guarded method, the gate was
  // bypassed for the duration. Report it before checking recorded violations.
  for (const level of GUARDED_CONSOLE_LEVELS) {
    const installed = state.installed[level];
    if (installed && console[level] !== installed) {
      state.violations.push(
        `[console.${level}] guarded console method was replaced — deliberate output must use expectConsoleNoise()`,
      );
    }
  }
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
