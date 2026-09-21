/**
 * Jest configuration coverage guard (campaign 064).
 *
 * `testMatch` is the only discovery mechanism for this package. A test file
 * that uses an unlisted naming convention or lives outside `__tests__` would
 * silently never run — the exact failure class this guard exists to prevent.
 * It reads the real package.json and walks the real source tree, so removing
 * a pattern or adding an undiscoverable test file fails here.
 */
import { describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';

const appRoot = path.resolve(__dirname, '..', '..');

function walkTestFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') stack.push(full);
      } else if (/\.(test|spec)\.tsx?$/.test(entry.name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

describe('jest testMatch coverage', () => {
  it('matches both .test and .spec naming for ts and tsx', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')) as {
      jest?: { testMatch?: string[] };
    };
    const match = pkg.jest?.testMatch ?? [];
    for (const ext of ['ts', 'tsx']) {
      expect(match).toContain(`**/__tests__/**/*.test.${ext}`);
      expect(match).toContain(`**/__tests__/**/*.spec.${ext}`);
    }
  });

  it('keeps every test file discoverable (inside __tests__)', () => {
    const files = walkTestFiles(path.join(appRoot, 'src'));
    expect(files.length).toBeGreaterThan(0);
    const undiscoverable = files
      .filter((file) => !file.split(path.sep).includes('__tests__'))
      .map((file) => path.relative(appRoot, file).split(path.sep).join('/'));
    expect(undiscoverable).toEqual([]);
  });
});
