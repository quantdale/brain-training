import { describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../../..');
const script = path.join(repoRoot, 'scripts/generate-game-registry.mjs');

function runGenerator(...args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

describe('registry generator contract (SDK parity)', () => {
  it('self-check pins the generatorVersion/description/contentVersion rejections', () => {
    const r = runGenerator('--self-check');
    // The self-check runs parseGameJson against in-memory fixtures; a failing
    // fixture exits 1 with the failure on stderr.
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/self-check: 4 cases passed/);
  });

  it('keeps the generated registry in sync with the shipped games', () => {
    const r = runGenerator('--check');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/up to date/);
  });
});
