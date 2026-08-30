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
  '.agents/skills/harden/SKILL.md',
  'openspec/README.md',
  'openspec/project.md'
];

const errors = [];
for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) errors.push(`Missing required file: ${rel}`);
  else if (fs.statSync(p).size === 0) errors.push(`Required file is empty: ${rel}`);
}
// Repository-root hygiene: allowlist of expected top-level entries; reject
// unexpected zero-byte or suspicious shell-residue files (e.g. `'`, `i.startsWith('home')`).
// This is narrowly scoped to the repository root; empty fixtures elsewhere are allowed.
const allowedRootEntries = new Set([
  'README.md', 'AGENTS.md', 'LICENSE', '.editorconfig', '.gitattributes', '.gitignore',
  'apps', 'docs', 'scripts', 'openspec', 'qa-artifacts', 'qa-canaries.log',
  '.agent', '.agents', '.claude', '.git', '.github', '.kimi-code', '.opencode', '.quarantine',
]);
const allowedRootExtensions = new Set(['.md', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.log', '.txt', '.yml', '.yaml', '.toml', '.lock', '.gradle', '.properties', '.xml', '.bat', '.sh', '.exe']);
const rootEntries = fs.readdirSync(root, { withFileTypes: true });
for (const entry of rootEntries) {
  const name = entry.name;
  if (allowedRootEntries.has(name)) continue;
  if (name.startsWith('.') && !allowedRootEntries.has(name)) {
    const ext = path.extname(name);
    if (allowedRootExtensions.has(ext) || ['.env', '.nvmrc', '.npmrc', '.yarnrc', '.DS_Store'].includes(name)) continue;
  }
  const fullPath = path.join(root, name);
  try {
    const stat = fs.statSync(fullPath);
    if (stat.isFile() && stat.size === 0) {
      if (!['.gitkeep', '.npmignore'].includes(name)) {
        errors.push(`Unexpected zero-byte file at repository root: '${name}' — remove shell residue or add to allowlist in scripts/validate-repo-state.mjs`);
      }
    }
    if (/['`$;|&<>]/.test(name) || /^i\./.test(name) || name.includes('=>') || name.includes('startsWith')) {
      errors.push(`Suspicious file name at repository root: '${name}' — likely shell/editor residue, remove it`);
    }
  } catch {}
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

// ——— Deterministic campaign field extraction (3.1 / 1.4) ———
// Each durable document has authoritative machine-readable campaign fields.
// Human prose elsewhere is NOT authoritative and substring presence is NOT
// sufficient. An executable repository has one ACTIVE campaign. A terminal
// repository has no active campaign and records the last VALIDATED campaign so
// a future owner can deliberately open a successor instead of an agent
// mistaking historical state for executable work.
//   GOVERNANCE.json:  .activeCampaign (JSON), or .lastCampaign + status
//   STATE.md:         `**Active campaign:** <id|none>` + terminal last campaign
//   CURRENT_CAMPAIGN.md: `**Campaign id:** `<id>`` + status
//   EXECUTION_PROMPT.md: `**Change:** `<id>`` + status
//   OpenSpec:         change.json .id + .status
//   task-ownership.json: .change
// See STATE.md "Authoritative campaign state" section for the relation between
// these structured fields and surrounding human Markdown.
function parseStateCampaignMd(content) {
  // STATE.md authoritative line: "**Active campaign:** 015-..." or "none".
  const m = content.match(/^\*\*Active campaign:\*\*\s*([^\s*\n]+)/m);
  if (!m) return undefined;
  const value = m[1].trim().replace(/^`|`$/g, '');
  return value.toLowerCase() === 'none' ? null : value;
}
function parseStateLastCampaignMd(content) {
  const m = content.match(/^\*\*Last campaign:\*\*\s*`([^`]+)`/m)
    ?? content.match(/^\*\*Last campaign:\*\*\s*([^\s*\n]+)/m);
  return m ? m[1].trim().replace(/^`|`$/g, '') : null;
}
function parseStateLastCampaignStatus(content) {
  const m = content.match(/^\*\*Last campaign status:\*\*\s*([A-Z]+)/m);
  return m ? m[1].trim() : null;
}
function parseCurrentCampaignId(content) {
  // CURRENT_CAMPAIGN.md: "**Campaign id:** `015-...`"  (backticked) or plain
  let m = content.match(/^\*\*Campaign id:\*\*\s*`([^`]+)`/m);
  if (m) return m[1].trim();
  m = content.match(/^\*\*Campaign id:\*\*\s*([^\s*\n]+)/m);
  return m ? m[1].trim().replace(/^`|`$/g, '') : null;
}
function parseCurrentCampaignStatus(content) {
  const m = content.match(/^\*\*Status:\*\*\s*([A-Z]+)/m);
  return m ? m[1].trim() : null;
}
function parseExecutionPromptChange(content) {
  let m = content.match(/^\*\*Change:\*\*\s*`([^`]+)`/m);
  if (m) return m[1].trim();
  m = content.match(/^\*\*Change:\*\*\s*([^\s*\n(]+)/m);
  return m ? m[1].trim().replace(/^`|`$/g, '') : null;
}
function parseExecutionPromptStatus(content) {
  const m = content.match(/^\*\*Status:\*\*\s*([A-Z]+)/m);
  return m ? m[1].trim() : null;
}

const stateRaw = fs.existsSync(path.join(root, '.agent/STATE.md')) ? fs.readFileSync(path.join(root, '.agent/STATE.md'), 'utf8') : '';
const campaignRaw = fs.existsSync(path.join(root, '.agent/CURRENT_CAMPAIGN.md')) ? fs.readFileSync(path.join(root, '.agent/CURRENT_CAMPAIGN.md'), 'utf8') : '';
const executionRaw = fs.existsSync(path.join(root, '.agent/EXECUTION_PROMPT.md')) ? fs.readFileSync(path.join(root, '.agent/EXECUTION_PROMPT.md'), 'utf8') : '';

const stateCampaign = parseStateCampaignMd(stateRaw);
const stateLastCampaign = parseStateLastCampaignMd(stateRaw);
const stateLastCampaignStatus = parseStateLastCampaignStatus(stateRaw);
const currentCampaignId = parseCurrentCampaignId(campaignRaw);
const currentCampaignStatus = parseCurrentCampaignStatus(campaignRaw);
const executionChange = parseExecutionPromptChange(executionRaw);
const executionStatus = parseExecutionPromptStatus(executionRaw);
const governanceHasActiveField = Object.prototype.hasOwnProperty.call(governance ?? {}, 'activeCampaign');
const activeCampaign = governanceHasActiveField ? governance.activeCampaign : undefined;
const terminalCampaign = governance?.lastCampaign;
const terminalStatus = governance?.lastCampaignStatus;

// 3.2 — Detect contradictions across all authoritative sources.
// Collect identifiers from each source and ensure they agree on one executable
// campaign, or on one explicit terminal campaign. Substring presence in
// historical prose does NOT satisfy this invariant.
if (!governanceHasActiveField) {
  errors.push('GOVERNANCE.activeCampaign field is missing — use a campaign id while active or null in a terminal state');
} else if (typeof activeCampaign === 'string' && activeCampaign.trim()) {
  const campaign = activeCampaign.trim();
  if (!stateCampaign) {
    errors.push('STATE.md missing authoritative field `**Active campaign:** <id>` — deterministic campaign field required (do not rely on substring)');
  } else if (stateCampaign !== campaign) {
    errors.push(`STATE.md active campaign '${stateCampaign}' contradicts GOVERNANCE.activeCampaign '${campaign}'`);
  }
  if (!currentCampaignId) {
    errors.push('CURRENT_CAMPAIGN.md missing authoritative field `**Campaign id:** `<id>``');
  } else if (currentCampaignId !== campaign) {
    errors.push(`CURRENT_CAMPAIGN.md campaign id '${currentCampaignId}' contradicts GOVERNANCE.activeCampaign '${campaign}'`);
  }
  if (currentCampaignStatus && currentCampaignStatus !== 'ACTIVE') {
    errors.push(`CURRENT_CAMPAIGN.md status is '${currentCampaignStatus}', expected 'ACTIVE' for the active campaign`);
  }
  if (!executionChange) {
    errors.push('EXECUTION_PROMPT.md missing authoritative field `**Change:** `<id>``');
  } else if (executionChange !== campaign) {
    errors.push(`EXECUTION_PROMPT.md change '${executionChange}' contradicts GOVERNANCE.activeCampaign '${campaign}'`);
  }
  if (executionStatus && executionStatus !== 'ACTIVE') {
    errors.push(`EXECUTION_PROMPT.md status is '${executionStatus}', expected 'ACTIVE'`);
  }
  // Ownership binding — task-ownership.json .change must agree
  try {
    const ownershipPath = path.join(root, '.agent/task-ownership.json');
    if (fs.existsSync(ownershipPath)) {
      const ownership = JSON.parse(fs.readFileSync(ownershipPath, 'utf8'));
      if (ownership.change !== campaign) {
        errors.push(`task-ownership.json change '${ownership.change}' contradicts GOVERNANCE.activeCampaign '${campaign}'`);
      }
    }
  } catch {}
} else if (activeCampaign === null) {
  if (typeof terminalCampaign !== 'string' || !terminalCampaign.trim()) {
    errors.push('Terminal governance state requires a non-empty lastCampaign');
  }
  if (terminalStatus !== 'VALIDATED') {
    errors.push(`Terminal governance state requires lastCampaignStatus 'VALIDATED', got '${terminalStatus ?? 'missing'}'`);
  }
  const campaign = typeof terminalCampaign === 'string' ? terminalCampaign.trim() : null;
  if (stateCampaign !== null) {
    errors.push(`STATE.md active campaign must be 'none' in terminal state, got '${stateCampaign ?? 'missing'}'`);
  }
  if (stateLastCampaign !== campaign) {
    errors.push(`STATE.md last campaign '${stateLastCampaign ?? 'missing'}' contradicts terminal lastCampaign '${campaign ?? 'missing'}'`);
  }
  if (stateLastCampaignStatus !== terminalStatus) {
    errors.push(`STATE.md last campaign status '${stateLastCampaignStatus ?? 'missing'}' contradicts terminal lastCampaignStatus '${terminalStatus ?? 'missing'}'`);
  }
  if (!currentCampaignId) {
    errors.push('CURRENT_CAMPAIGN.md missing authoritative terminal campaign id');
  } else if (currentCampaignId !== campaign) {
    errors.push(`CURRENT_CAMPAIGN.md campaign id '${currentCampaignId}' contradicts terminal lastCampaign '${campaign}'`);
  }
  if (currentCampaignStatus !== terminalStatus) {
    errors.push(`CURRENT_CAMPAIGN.md status '${currentCampaignStatus ?? 'missing'}' contradicts terminal status '${terminalStatus ?? 'missing'}'`);
  }
  if (!executionChange) {
    errors.push('EXECUTION_PROMPT.md missing authoritative terminal change id');
  } else if (executionChange !== campaign) {
    errors.push(`EXECUTION_PROMPT.md change '${executionChange}' contradicts terminal lastCampaign '${campaign}'`);
  }
  if (executionStatus !== terminalStatus) {
    errors.push(`EXECUTION_PROMPT.md status '${executionStatus ?? 'missing'}' contradicts terminal status '${terminalStatus ?? 'missing'}'`);
  }
  try {
    const ownershipPath = path.join(root, '.agent/task-ownership.json');
    if (fs.existsSync(ownershipPath)) {
      const ownership = JSON.parse(fs.readFileSync(ownershipPath, 'utf8'));
      if (ownership.change !== campaign) {
        errors.push(`task-ownership.json change '${ownership.change}' contradicts terminal lastCampaign '${campaign}'`);
      }
    }
  } catch {}
} else {
  errors.push('GOVERNANCE.activeCampaign must be a non-empty campaign id or null in an explicit terminal state');
}

// Spec-driven campaign integrity. An active or terminal campaign must have a
// matching OpenSpec change directory with a complete execution surface,
// regardless of whether the directory happens to exist. No campaign special
// cases.
const governedCampaign = typeof activeCampaign === 'string' && activeCampaign.trim()
  ? activeCampaign.trim()
  : activeCampaign === null && typeof terminalCampaign === 'string' ? terminalCampaign.trim() : null;
if (governedCampaign) {
  const changeDir = path.join(root, 'openspec', 'changes', governedCampaign);
  const expectedStatus = activeCampaign === null ? terminalStatus : 'ACTIVE';
  if (!fs.existsSync(changeDir)) {
    errors.push(`Missing active OpenSpec change directory (governed campaign): openspec/changes/${governedCampaign}`);
  } else {
    const changeRequired = ['change.json', 'proposal.md', 'design.md', 'tasks.md', 'EXECUTION.md', 'audit-map.md'];
    for (const rel of changeRequired) {
      const p = path.join(changeDir, rel);
      if (!fs.existsSync(p) || fs.statSync(p).size === 0) {
        errors.push(`Governed OpenSpec change missing/empty: openspec/changes/${governedCampaign}/${rel}`);
      }
    }
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(changeDir, 'change.json'), 'utf8'));
      if (meta.id !== governedCampaign) errors.push('OpenSpec change id does not match governance campaign binding');
      if (meta.status !== expectedStatus) errors.push(`Governed OpenSpec change metadata status must be ${expectedStatus}`);
      // 3.2 extended: OpenSpec id/status must also agree with the other sources.
      if (activeCampaign !== null && stateCampaign && meta.id !== stateCampaign) errors.push(`OpenSpec change id '${meta.id}' contradicts STATE.md active campaign '${stateCampaign}'`);
      if (activeCampaign === null && stateLastCampaign && meta.id !== stateLastCampaign) errors.push(`OpenSpec change id '${meta.id}' contradicts STATE.md last campaign '${stateLastCampaign}'`);
      if (currentCampaignId && meta.id !== currentCampaignId) errors.push(`OpenSpec change id '${meta.id}' contradicts CURRENT_CAMPAIGN.md campaign id '${currentCampaignId}'`);
      if (executionChange && meta.id !== executionChange) errors.push(`OpenSpec change id '${meta.id}' contradicts EXECUTION_PROMPT.md change '${executionChange}'`);
      if (!Array.isArray(meta.specOrder) || meta.specOrder.length === 0) errors.push('Active OpenSpec change specOrder must be non-empty');
      for (const spec of meta.specOrder ?? []) {
        const specPath = path.join(changeDir, 'specs', spec, 'spec.md');
        if (!fs.existsSync(specPath) || fs.statSync(specPath).size === 0) {
          errors.push(`Active OpenSpec normative spec missing/empty: ${spec}`);
        }
      }
    } catch (error) {
      errors.push(`Invalid governed OpenSpec change.json: ${error.message}`);
    }
  }
}

if (errors.length) {
  console.error('Repository state validation FAILED:\n');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log('Repository state validation PASS');
if (activeCampaign) console.log(`Active campaign: ${activeCampaign}`);
else console.log(`No active campaign; last campaign: ${terminalCampaign} (${terminalStatus})`);
console.log(`Default coder concurrency: ${governance.swarm.defaultMaxCoderAgents}`);
console.log(`Default Android emulators: ${governance.runtimeQa.defaultAndroidEmulators}`);
