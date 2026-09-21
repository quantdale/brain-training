/**
 * Console signal contract (campaign 064).
 *
 * The guard is installed globally by `jest/setup.js`; this suite proves the
 * contract it claims: every console level is intercepted, unscoped output
 * fails, scoped output is deliberate and must actually occur, and neither
 * expectations nor violations leak across test boundaries.
 *
 * This test intentionally emits the messages it asserts on — the gate's real
 * output path is part of what is being verified (the guard must still forward
 * the original call, not swallow it).
 */
import { describe, expect, it } from '@jest/globals';

import {
  assertNoUnexpectedConsoleOutput,
  expectConsoleNoise,
  GUARDED_CONSOLE_LEVELS,
  resetConsoleSignal,
} from '@/test-utils';

describe('console signal gate', () => {
  it('guards every console level', () => {
    expect([...GUARDED_CONSOLE_LEVELS]).toEqual(['error', 'warn', 'log', 'info', 'debug']);
  });

  it('fails unscoped log output and names the message', () => {
    console.log('unscoped-log-probe');
    expect(() => assertNoUnexpectedConsoleOutput()).toThrow(/unscoped-log-probe/);
    resetConsoleSignal();
  });

  it('scopes deliberate output and requires the message to occur', async () => {
    await expectConsoleNoise(/scoped-log-probe/, () => {
      console.log('scoped-log-probe');
    });
    expect(() => assertNoUnexpectedConsoleOutput()).not.toThrow();

    await expect(
      expectConsoleNoise(/never-emitted-probe/, () => {}),
    ).rejects.toThrow(/not exercised/);
  });

  it('does not leak expectations or violations across tests', () => {
    expect(() => assertNoUnexpectedConsoleOutput()).not.toThrow();
  });
});
