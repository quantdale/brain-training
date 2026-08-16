import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'README.md',
  'AGENTS.md',
  'docs/PROJECT_CONSTITUTION.md',
  'docs/MASTER_PLAN.md',
  'docs/PARITY_MATRIX.md',
  'docs/ARCHITECTURE.md',
  'docs/GAME_SDK.md',
  'docs/DEFERRED_DECISIONS.md',
  '.agent/GOVERNANCE.json',
  '.agent/GOAL.md',
  '.agent/STATE.md',
  '.agent/CURRENT_CAMPAIGN.md',
  '.agent/BACKLOG.md',
  '.agent/KNOWN_ISSUES.md',
  '.agent/VALIDATION.md',
  '.agent/IMPACT_MAP.md',
  '.agent/DECISIONS.md',
  '.agent/modes/DAY.md',
  '.agent/modes/NIGHT.md',
  '.agents/skills/continue-development/SKILL.md',
  '.agents/skills/harden/SKILL.md'
];

const errors = [];
for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) errors.push(`Missing required file: ${rel}`);
  else if (fs.statSync(p).size === 0) errors.push(`Required file is empty: ${rel}`);
}

let governance;
try {
  governance = JSON.parse(fs.readFileSync(path.join(root, '.agent/GOVERNANCE.json'), 'utf8'));
} catch (error) {
  errors.push(`Invalid .agent/GOVERNANCE.json: ${error.message}`);
}

if (governance) {
  if (governance.canonicalBranch !== 'main') errors.push('canonicalBranch must be main');
  if (governance.swarm?.defaultMaxCoderAgents !== 7) errors.push('defaultMaxCoderAgents must currently be 7');
  if (governance.runtimeQa?.defaultAndroidEmulators !== 1) errors.push('defaultAndroidEmulators must currently be 1');
  if (governance.runtimeQa?.hostMouseKeyboardAutomationAllowed !== false) errors.push('host mouse/keyboard automation must be disabled');
  if (governance.git?.autonomousForcePushMainAllowed !== false) errors.push('autonomous force-push to main must be disabled');
  if (governance.hardening?.automaticFullHardening !== false) errors.push('automatic full hardening must be disabled');
}

const state = fs.existsSync(path.join(root, '.agent/STATE.md')) ? fs.readFileSync(path.join(root, '.agent/STATE.md'), 'utf8') : '';
const campaign = fs.existsSync(path.join(root, '.agent/CURRENT_CAMPAIGN.md')) ? fs.readFileSync(path.join(root, '.agent/CURRENT_CAMPAIGN.md'), 'utf8') : '';
if (governance?.activeCampaign && !state.includes(governance.activeCampaign)) errors.push('STATE.md does not reference governance activeCampaign');
// CURRENT_CAMPAIGN.md must reference the governance-active campaign number
// (e.g. "Campaign 004 — ..."), not a hardcoded id.
const activeNumber = governance?.activeCampaign?.match(/^(\d+)/)?.[1];
if (governance?.activeCampaign && activeNumber && !campaign.toLowerCase().includes(`campaign ${activeNumber}`)) {
  errors.push(`CURRENT_CAMPAIGN.md does not appear to match active campaign ${activeNumber}`);
}

if (errors.length) {
  console.error('Repository state validation FAILED:\n');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('Repository state validation PASS');
console.log(`Active campaign: ${governance.activeCampaign}`);
console.log(`Default coder concurrency: ${governance.swarm.defaultMaxCoderAgents}`);
console.log(`Default Android emulators: ${governance.runtimeQa.defaultAndroidEmulators}`);
