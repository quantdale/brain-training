/**
 * Campaign 053 (task 3.5) — opt-in performance probe contract.
 *
 * The standard CI command intentionally omits four expensive measurement
 * probes. `scripts/certification/validate-jest-signal.mjs` classifies those
 * skips against `jest-skip-allowlist.json`, so CI output names the owning
 * test and its enable condition instead of reporting a silent functional
 * skip. This contract pins the other half: every allowlisted probe file must
 * still gate on its declared environment variable, and the probe must remain
 * a measurement rather than an ordinary functional guarantee.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface AllowlistEntry {
  file: string;
  testPattern: string;
  enableWith: string;
}

interface Allowlist {
  schemaVersion: number;
  entries: AllowlistEntry[];
}

const ROOT = path.resolve(__dirname, '../../../..');
const ALLOWLIST = path.join(ROOT, 'scripts', 'certification', 'jest-skip-allowlist.json');

function loadAllowlist(): Allowlist {
  return JSON.parse(readFileSync(ALLOWLIST, 'utf8')) as Allowlist;
}

describe('opt-in performance probe enable conditions', () => {
  it('gates every allowlisted probe on its declared environment variable', () => {
    const allowlist = loadAllowlist();
    expect(allowlist.entries.length).toBeGreaterThan(0);

    for (const entry of allowlist.entries) {
      const source = readFileSync(path.join(ROOT, entry.file), 'utf8');
      // The probe must read its declared env var and select describe/skip from
      // it, so the skip cannot become unconditional (hiding a removed probe)
      // or unconditional (turning a measurement into a blocking gate).
      expect(source).toContain(entry.enableWith.split('=')[0]);
      expect(source).toMatch(/describe\.skip/);
    }
  });

  it('keeps the probe roster explicit in the reviewed allowlist', () => {
    const allowlist = loadAllowlist();
    // Each entry names one owning file and one enable condition; a new probe
    // must be reviewed and added here rather than appearing as an unclassified
    // skip in CI.
    const keys = allowlist.entries.map((entry) => `${entry.file}\n${entry.testPattern}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of allowlist.entries) {
      expect(entry.enableWith).toMatch(/^[A-Z0-9_]+=1$/);
    }
  });
});
