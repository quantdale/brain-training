/**
 * Frontier audit (2026-09-14) — planning-only OpenSpec proposals.
 *
 * Proves the proposed change folders exist with required artifacts, stay
 * PROPOSED (governance unbound), and that the cited product evidence still
 * lives in shipped source. Does not implement the proposals.
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const changesRoot = path.join(repoRoot, 'openspec', 'changes');

const PROPOSED = [
  'in-game-workout-next-leg',
  'settings-driven-color-theme',
  'persistent-game-tutorials',
  'progression-refresh-on-surfaces',
  'residual-user-surface-honesty',
  'terminal-durable-state-truth',
  'certify-provenance-parity',
  'null-absent-performance-metrics',
] as const;

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

describe('frontier-audit OpenSpec proposals', () => {
  it('does not bind GOVERNANCE.activeCampaign', () => {
    const governance = JSON.parse(read('.agent/GOVERNANCE.json')) as {
      activeCampaign: string | null;
    };
    expect(governance.activeCampaign).toBeNull();
  });

  it.each(PROPOSED)('%s has planning artifacts and PROPOSED status', (id) => {
    const dir = path.join(changesRoot, id);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'change.json'), 'utf8')) as {
      id: string;
      status: string;
    };
    expect(meta.id).toBe(id);
    expect(meta.status).toBe('PROPOSED');
    for (const file of ['proposal.md', 'design.md', 'tasks.md', 'audit-map.md']) {
      expect(fs.existsSync(path.join(dir, file))).toBe(true);
    }
    expect(fs.existsSync(path.join(dir, 'specs'))).toBe(true);
    const tasks = fs.readFileSync(path.join(dir, 'tasks.md'), 'utf8');
    expect(tasks).toMatch(/- \[ \]/);
    expect(tasks).not.toMatch(/^- \[x\]/m);
  });

  it('useTheme still follows the OS scheme only (settings-driven-color-theme evidence)', () => {
    const src = read('apps/mobile/src/hooks/use-theme.ts');
    expect(src).toMatch(/useColorScheme/);
    expect(src).not.toMatch(/themeId/);
    expect(src).not.toMatch(/resolveThemeMode/);
  });

  it('GameResults still has no Next Game prop (in-game-workout-next-leg evidence)', () => {
    const src = read('apps/mobile/src/components/game-host/results.tsx');
    expect(src).toMatch(/onQuit/);
    expect(src).not.toMatch(/onNextGame/);
    expect(src).not.toMatch(/nextGameId/);
  });

  it('memory tutorial defaults to in-memory store (persistent-game-tutorials evidence)', () => {
    const src = read('apps/mobile/src/games/memory/hooks.ts');
    expect(src).toMatch(/createInMemoryTutorialStore/);
  });

  it('Color Stroop still maps Infinity fastest to 0 (null-absent-performance-metrics evidence)', () => {
    const src = read('apps/mobile/src/games/flexibility-color-stroop/session.ts');
    expect(src).toMatch(/POSITIVE_INFINITY/);
    expect(src).toMatch(/fastestResponseMs/);
  });

  it('certify provenance still omits PROVENANCE_BASE_REF (certify-provenance-parity evidence)', () => {
    const src = read('scripts/certification/certify-clean-checkout.mjs');
    expect(src).toMatch(/validate-provenance\.mjs/);
    expect(src).not.toMatch(/PROVENANCE_BASE_REF/);
  });
});
