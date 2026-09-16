/**
 * Frontier audit (2026-09-14) — proposals applied 2026-09-14, archived
 * 2026-09-14.
 *
 * Originally this file pinned the planning-only state (PROPOSED, tasks
 * unchecked, GOVERNANCE unbound). The owner then instructed: apply every
 * pending proposal, validate, ensure all tasks are done, archive, and push.
 * This test now pins the FINAL state: every change is archived with terminal
 * metadata, zero unchecked tasks, and implementation evidence living in
 * shipped source. It also permits a later, owner-authorized successor
 * campaign to be bound, while ensuring none of these archived proposals is
 * rebound.
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd(), '../..');
const changesRoot = path.join(repoRoot, 'openspec', 'changes');
const archiveRoot = path.join(changesRoot, 'archive');
const ARCHIVED_AT = '2026-09-14';

const APPLIED = [
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

/** Archived location for these changes; falls back if a fixture re-activates one. */
function changeDir(id: string): string {
  const archived = path.join(archiveRoot, `${ARCHIVED_AT}-${id}`);
  return fs.existsSync(archived) ? archived : path.join(changesRoot, id);
}

describe('frontier-audit OpenSpec proposals (applied + archived)', () => {
  it('keeps archived proposals unbound from the active campaign', () => {
    const governance = JSON.parse(read('.agent/GOVERNANCE.json')) as {
      activeCampaign: string | null;
    };
    expect(governance.activeCampaign).not.toBe(APPLIED[0]);
    expect(
      governance.activeCampaign === null || typeof governance.activeCampaign === 'string',
    ).toBe(true);
  });

  it.each(APPLIED)('%s is archived, applied, with every task complete', (id) => {
    const dir = changeDir(id);
    // The 2026-09-14 wave was archived under its application date.
    expect(fs.existsSync(path.join(archiveRoot, `${ARCHIVED_AT}-${id}`))).toBe(true);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'change.json'), 'utf8')) as {
      id: string;
      status: string;
      appliedAt?: string;
    };
    expect(meta.id).toBe(id);
    expect(meta.status).toBe('VALIDATED');
    expect(meta.appliedAt).toBe('2026-09-14');
    for (const file of ['proposal.md', 'design.md', 'tasks.md', 'audit-map.md']) {
      expect(fs.existsSync(path.join(dir, file))).toBe(true);
    }
    expect(fs.existsSync(path.join(dir, 'specs'))).toBe(true);
    const tasks = fs.readFileSync(path.join(dir, 'tasks.md'), 'utf8');
    expect(tasks).not.toMatch(/- \[ \]/);
    expect(tasks).toMatch(/- \[x\]/);
  });

  it('useTheme resolves the persisted theme id (settings-driven-color-theme evidence)', () => {
    const src = read('apps/mobile/src/hooks/use-theme.ts');
    expect(src).toMatch(/resolveThemeMode/);
    expect(src).toMatch(/themeId/);
  });

  it('GameResults offers Next Game (in-game-workout-next-leg evidence)', () => {
    const src = read('apps/mobile/src/components/game-host/results.tsx');
    expect(src).toMatch(/onNextGame/);
    expect(src).toMatch(/next-game/);
    expect(src).toMatch(/advanceWorkoutForSession/);
  });

  it('the game route injects the persistent tutorial store (persistent-game-tutorials evidence)', () => {
    const route = read('apps/mobile/src/app/game/[id].tsx');
    expect(route).toMatch(/usePersistentTutorialStore/);
    expect(route).toMatch(/tutorialStore/);
    const hook = read('apps/mobile/src/hooks/use-persistent-tutorial-store.ts');
    expect(hook).toMatch(/createWriteThroughTutorialStore/);
  });

  it('claimable surfaces refresh progression first (progression-refresh-on-surfaces evidence)', () => {
    for (const rel of [
      'apps/mobile/src/app/(tabs)/index.tsx',
      'apps/mobile/src/app/rewards.tsx',
      'apps/mobile/src/app/(tabs)/profile.tsx',
      'apps/mobile/src/app/data-management.tsx',
    ]) {
      expect(read(rel)).toMatch(/refreshProgression/);
    }
  });

  it('user failures are surfaced and retryable (residual-user-surface-honesty evidence)', () => {
    expect(read('apps/mobile/src/app/(tabs)/index.tsx')).toMatch(/workout reroll failed/);
    expect(read('apps/mobile/src/app/(tabs)/progress.tsx')).toMatch(/progress-error/);
    expect(read('apps/mobile/src/app/(tabs)/profile.tsx')).toMatch(/profile-error/);
    expect(read('apps/mobile/src/app/_layout.tsx')).toMatch(/Couldn't save your settings/);
  });

  it('terminal prose matches terminal governance (terminal-durable-state-truth evidence)', () => {
    const state = read('.agent/STATE.md');
    const governance = JSON.parse(read('.agent/GOVERNANCE.json')) as {
      activeCampaign: string | null;
    };
    if (governance.activeCampaign === null) {
      expect(state).toMatch(/There is no active campaign/);
    } else {
      expect(state).toMatch(/\*\*Active campaign:\*\* `[^`]+`/);
      expect(APPLIED).not.toContain(governance.activeCampaign as (typeof APPLIED)[number]);
    }
    expect(state).not.toMatch(/Campaign 028.*is active/);
    expect(read('docs/PROJECT_CONSTITUTION.md')).toMatch(/Campaigns 001–028 closed/);
  });

  it('certify resolves a non-tautological provenance base (certify-provenance-parity evidence)', () => {
    const src = read('scripts/certification/certify-clean-checkout.mjs');
    expect(src).toMatch(/PROVENANCE_BASE_REF/);
    expect(src).toMatch(/resolveProvenanceBase/);
    expect(read('scripts/certification/validate-jest-signal.mjs')).toMatch(/findOrphanEntries/);
  });

  it('Color Stroop persists an absent fastest sample as null (null-absent-performance-metrics evidence)', () => {
    const src = read('apps/mobile/src/games/flexibility-color-stroop/session.ts');
    expect(src).toMatch(/Number\.isFinite/);
    expect(src).toMatch(/fastestResponseMs/);
    expect(src).not.toMatch(/POSITIVE_INFINITY[\s\S]{0,40}\? 0/);
    const types = read('apps/mobile/src/games/flexibility-color-stroop/types.ts');
    expect(types).toMatch(/fastestResponseMs: number \| null/);
  });
});
