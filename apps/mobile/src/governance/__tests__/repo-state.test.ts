/**
 * Governance repository-state tests for 015 tasks 1.3-1.5, 3.2-3.3, 4.2-4.3.
 *
 * These are mutation-visible: each test targets a specific guard that
 * validate-repo-state.mjs must enforce, so removing the guard makes the test fail.
 */
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(__dirname, '../../../../..');
const validateRepoState = path.join(repoRoot, 'scripts/validate-repo-state.mjs');

function runValidator(cwd: string) {
  const r = spawnSync(process.execPath, [validateRepoState], { cwd, encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function makeFixture(overrides: {
  governanceActive?: string | null;
  stateCampaign?: string | null;
  currentId?: string | null;
  currentStatus?: string | null;
  execChange?: string | null;
  execStatus?: string | null;
  changeId?: string | null;
  changeStatus?: string | null;
  removeChangeDir?: boolean;
  removeSpec?: boolean;
  removeExec?: boolean;
  historicalProseWithOtherId?: string | null;
  zeroByteRoot?: string | null;
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-state-fixture-'));
  // Minimal required files for validator to reach campaign checks
  const govActive = overrides.governanceActive === null ? null : (overrides.governanceActive ?? '015-governance-depth-convergence');
  const stateCamp = overrides.stateCampaign === null ? null : (overrides.stateCampaign ?? govActive);
  const curId = overrides.currentId === null ? null : (overrides.currentId ?? govActive);
  const curStatus = overrides.currentStatus === null ? null : (overrides.currentStatus ?? 'ACTIVE');
  const execCh = overrides.execChange === null ? null : (overrides.execChange ?? govActive);
  const execStatus = overrides.execStatus === null ? null : (overrides.execStatus ?? 'ACTIVE');
  const changeId = overrides.changeId === null ? null : (overrides.changeId ?? govActive);
  const changeStatus = overrides.changeStatus === null ? null : (overrides.changeStatus ?? 'ACTIVE');

  // Governance
  fs.mkdirSync(path.join(dir, '.agent'), { recursive: true });
  if (govActive !== null) {
    fs.writeFileSync(path.join(dir, '.agent/GOVERNANCE.json'), JSON.stringify({
      canonicalBranch: 'main',
      activeCampaign: govActive,
      swarm: { defaultMaxCoderAgents: 7 },
      runtimeQa: { defaultAndroidEmulators: 1, hostMouseKeyboardAutomationAllowed: false },
      git: { autonomousForcePushMainAllowed: false },
      hardening: { automaticFullHardening: false },
    }, null, 2));
  } else {
    fs.writeFileSync(path.join(dir, '.agent/GOVERNANCE.json'), JSON.stringify({ canonicalBranch: 'main' }));
  }
  let stateContent = '# Durable Project State\n';
  if (stateCamp !== null) stateContent += `**Active campaign:** ${stateCamp}\n`;
  if (overrides.historicalProseWithOtherId) stateContent += `\nHistorical note: campaign ${overrides.historicalProseWithOtherId} was once active.\n`;
  stateContent += '\n## Current status\nplaceholder\n';
  fs.writeFileSync(path.join(dir, '.agent/STATE.md'), stateContent);
  let curContent = '# Campaign\n';
  if (curId !== null) curContent += `**Campaign id:** \`${curId}\`\n`;
  if (curStatus !== null) curContent += `**Status:** ${curStatus}\n`;
  fs.writeFileSync(path.join(dir, '.agent/CURRENT_CAMPAIGN.md'), curContent);
  let execContent = '# Execution\n';
  if (execCh !== null) execContent += `**Change:** \`${execCh}\`\n`;
  if (execStatus !== null) execContent += `**Status:** ${execStatus}\n`;
  fs.writeFileSync(path.join(dir, '.agent/EXECUTION_PROMPT.md'), execContent);
  // Other required files (empty but non-zero? need non-empty)
  const reqFiles = ['README.md','AGENTS.md','docs/PROJECT_CONSTITUTION.md','docs/MASTER_PLAN.md','docs/PARITY_MATRIX.md','docs/ARCHITECTURE.md','docs/GAME_SDK.md','docs/DEFERRED_DECISIONS.md','.agent/GOAL.md','.agent/BACKLOG.md','.agent/KNOWN_ISSUES.md','.agent/VALIDATION.md','.agent/IMPACT_MAP.md','.agent/DECISIONS.md','.agent/modes/DAY.md','.agent/modes/NIGHT.md','.agents/skills/continue-development/SKILL.md','.agents/skills/harden/SKILL.md','openspec/README.md','openspec/project.md'];
  for (const f of reqFiles) {
    fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), 'placeholder');
  }
  fs.writeFileSync(path.join(dir, '.agent/task-ownership.json'), JSON.stringify({ change: govActive ?? '015-governance-depth-convergence', parallelPackets: [], orchestratorOnlySurfaces: [], generatedFilePatterns: [] }));
  if (!overrides.removeChangeDir && govActive) {
    const changeDir = path.join(dir, 'openspec/changes', govActive);
    fs.mkdirSync(path.join(changeDir, 'specs/campaign-governance'), { recursive: true });
    if (changeId !== null) {
      fs.writeFileSync(path.join(changeDir, 'change.json'), JSON.stringify({ id: changeId, status: changeStatus ?? 'ACTIVE', specOrder: ['campaign-governance'] }));
    }
    const execFile = overrides.removeExec ? null : 'EXECUTION.md';
    for (const name of ['proposal.md','design.md','tasks.md','audit-map.md', execFile].filter(Boolean) as string[]) {
      fs.writeFileSync(path.join(changeDir, name), 'placeholder');
    }
    if (!overrides.removeSpec) {
      fs.writeFileSync(path.join(changeDir, 'specs/campaign-governance/spec.md'), 'placeholder');
    }
  }
  if (overrides.zeroByteRoot) {
    fs.writeFileSync(path.join(dir, overrides.zeroByteRoot), '');
  }
  return dir;
}

describe('repo-state validator (015 1.3-1.5, 3.2-3.3, 4.2-4.3)', () => {
  it('passes for the real repository (015 ACTIVE)', () => {
    const r = runValidator(repoRoot);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/PASS/);
  });

  it('fails when the active change directory is missing (1.3/1.5)', () => {
    const dir = makeFixture({ removeChangeDir: true });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Missing active OpenSpec change directory/);
  });

  it('fails when change id does not match governance (wrong change ID)', () => {
    const dir = makeFixture({ changeId: '999-wrong' });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/does not match governance/);
  });

  it('fails when change status is PROPOSED vs ACTIVE mismatch', () => {
    const dir = makeFixture({ changeStatus: 'PROPOSED' });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/must be ACTIVE/);
  });

  it('fails when execution artifact is missing (EXECUTION.md)', () => {
    const dir = makeFixture({ removeExec: true });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/EXECUTION\.md/);
  });

  it('fails when normative spec is missing', () => {
    const dir = makeFixture({ removeSpec: true });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/normative spec/);
  });

  it('fails when STATE campaign contradicts GOVERNANCE (structured, not substring)', () => {
    const dir = makeFixture({ stateCampaign: '014-experience-depth-replayability' });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/STATE\.md.*contradicts GOVERNANCE/);
  });

  it('fails when historical prose contains the active id but structured field does not match (do not use substring)', () => {
    // Gov 015, STATE structured says 013, but historical prose mentions 015 — validator must still fail
    const dir = makeFixture({ stateCampaign: '013-old', historicalProseWithOtherId: '015-governance-depth-convergence' });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/STATE\.md.*contradicts/);
  });

  it('fails when CURRENT_CAMPAIGN id contradicts GOVERNANCE', () => {
    const dir = makeFixture({ currentId: '013-old' });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/CURRENT_CAMPAIGN/);
  });

  it('fails when EXECUTION_PROMPT change contradicts GOVERNANCE', () => {
    const dir = makeFixture({ execChange: '013-old' });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/EXECUTION_PROMPT/);
  });

  it('regression: 014/013 contradiction fixture fails with both references identified', () => {
    // G-04: STATE header says 014 active while later sections say 013 authoritative
    // We model as STATE structured = 014 but CURRENT_CAMPAIGN structured = 013
    const dir = makeFixture({ stateCampaign: '014-experience-depth-replayability', currentId: '013-old' });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/contradicts/);
  });

  it('fails on unexpected zero-byte root residue (4.3)', () => {
    const dir = makeFixture({ zeroByteRoot: "'" });
    const r = runValidator(dir);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/zero-byte|Unexpected zero-byte|Suspicious file/);
  });

  it('passes when zero-byte is an allowed fixture elsewhere (not root)', () => {
    const dir = makeFixture();
    fs.mkdirSync(path.join(dir, 'apps/mobile/src/foo'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'apps/mobile/src/foo/empty.fixture'), '');
    const r = runValidator(dir);
    expect(r.status).toBe(0);
  });
});
