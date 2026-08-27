import { describe, expect, it } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../../..');
const script = path.join(repoRoot, 'scripts/validate-affected.mjs');

type AreaMatch = { impact: string; name: string; checks: string[] };
type PlanJson = { areas: AreaMatch[]; unmatched: string[] };

function runStrict(paths: string[]) {
  const r = spawnSync(process.execPath, [script, '--strict', '--json', ...paths], { cwd: repoRoot, encoding: 'utf8' });
  const json = r.stdout ? (JSON.parse(r.stdout) as PlanJson) : null;
  return { status: r.status ?? 1, json, stdout: r.stdout, stderr: r.stderr };
}

describe('validate-affected strict mapping (3.5)', () => {
  it('maps workout paths to checks', () => {
    const r = runStrict(['apps/mobile/src/workout/today.ts']);
    expect(r.status).toBe(0);
    expect(r.json?.unmatched).toEqual([]);
    expect(r.json?.areas.some((m) => m.impact === 'workout')).toBe(true);
  });
  it('maps personalization/mastery/spotlight paths', () => {
    const r = runStrict(['apps/mobile/src/personalization/signals.ts', 'apps/mobile/src/mastery/engine.ts', 'apps/mobile/src/spotlight/spotlight.ts']);
    expect(r.status).toBe(0);
    expect(r.json?.unmatched).toEqual([]);
  });
  it('maps sync/data-portability paths', () => {
    const r = runStrict(['apps/mobile/src/sync/engine.ts', 'apps/mobile/src/data-portability/apply.ts']);
    expect(r.status).toBe(0);
    expect(r.json?.unmatched).toEqual([]);
  });
  it('maps content/registry/provenance paths', () => {
    const r = runStrict(['apps/mobile/src/content/registry.ts', 'scripts/generate-game-registry.mjs']);
    expect(r.status).toBe(0);
    expect(r.json?.unmatched).toEqual([]);
  });
  it('maps OpenSpec/governance paths', () => {
    const r = runStrict(['openspec/changes/015-governance-depth-convergence/tasks.md', '.agent/STATE.md']);
    expect(r.status).toBe(0);
    expect(r.json?.unmatched).toEqual([]);
  });
  it('still maps game modules and does not require full catalog for localized content edit (risk-based)', () => {
    const r = runStrict(['apps/mobile/src/games/language-word-chain/content.ts']);
    expect(r.status).toBe(0);
    // Localized content edit must map to game/content checks, not demand full 42-game certify
    const impacts = r.json?.areas.map((m) => m.impact) ?? [];
    expect(impacts).toEqual(expect.arrayContaining([expect.stringMatching(/game module|content/)]));
  });
});
