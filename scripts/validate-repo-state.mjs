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
  '.agent/task-ownership.json',
  '.agent/EXECUTION_PROMPT.md',
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

/**
 * Ownership binding: `.agent/task-ownership.json` must be readable, valid JSON
 * and bound to the governed campaign. Parse failures are reported as errors —
 * never silently skipped (campaign 028, task 4.4).
 */
function checkOwnershipBinding(campaign, sourceLabel) {
  const ownershipPath = path.join(root, '.agent/task-ownership.json');
  let raw;
  try {
    raw = fs.readFileSync(ownershipPath, 'utf8');
  } catch (error) {
    errors.push(`Cannot read .agent/task-ownership.json: ${error.message}`);
    return;
  }
  let ownership;
  try {
    ownership = JSON.parse(raw);
  } catch (error) {
    errors.push(`Invalid .agent/task-ownership.json: ${error.message} — ownership binding cannot be verified`);
    return;
  }
  if (ownership.change !== campaign) {
    errors.push(`task-ownership.json change '${ownership.change}' contradicts ${sourceLabel} '${campaign}'`);
  }
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
  checkOwnershipBinding(campaign, 'GOVERNANCE.activeCampaign');
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
  checkOwnershipBinding(campaign ?? '', 'terminal lastCampaign');
} else {
  errors.push('GOVERNANCE.activeCampaign must be a non-empty campaign id or null in an explicit terminal state');
}

// ——— Owner-authorized multi-change program (065) ———
// A program runs several numbered OpenSpec changes sequentially on top of a
// terminal campaign. Governance must name it, the prompt/ledger must exist,
// the current change must be a real IN_PROGRESS change, and STATE.md must
// mention the program so a fresh session cannot mistake the repository for
// idle. A program and an active campaign are mutually exclusive.
const activeProgram = governance?.activeProgram;
if (activeProgram !== undefined) {
  if (!activeProgram || typeof activeProgram !== 'object' || Array.isArray(activeProgram)) {
    errors.push('GOVERNANCE.activeProgram must be an object when present');
  } else {
    const programId = typeof activeProgram.id === 'string' ? activeProgram.id.trim() : '';
    if (!programId) {
      errors.push('GOVERNANCE.activeProgram.id must be a non-empty string');
    } else if (!stateRaw.includes(programId)) {
      errors.push(`STATE.md does not mention the active program '${programId}'`);
    }
    for (const field of ['prompt', 'ledger']) {
      const rel = activeProgram[field];
      if (typeof rel !== 'string' || !rel.trim()) {
        errors.push(`GOVERNANCE.activeProgram.${field} must be a non-empty string`);
      } else if (!fs.existsSync(path.join(root, rel))) {
        errors.push(`GOVERNANCE.activeProgram.${field} references missing path '${rel}'`);
      }
    }
    if (typeof activeProgram.currentChange !== 'string' || !activeProgram.currentChange.trim()) {
      errors.push('GOVERNANCE.activeProgram.currentChange must be a change id string');
    }
    if (typeof activeCampaign === 'string' && activeCampaign.trim()) {
      errors.push('GOVERNANCE cannot declare both an activeCampaign and an activeProgram');
    }
    if (!['ACTIVE', 'PHASE_2_HARDENING', 'COMPLETE'].includes(activeProgram.state)) {
      errors.push(`GOVERNANCE.activeProgram.state must be one of ACTIVE, PHASE_2_HARDENING, COMPLETE, got '${activeProgram.state ?? 'missing'}'`);
    } else {
      const currentChange =
        typeof activeProgram.currentChange === 'string' ? activeProgram.currentChange.trim() : '';
      // The ledger is the program's durable cursor; it must agree with the
      // governance binding (campaign 065 closure: a stale ledger otherwise
      // passes while the two sources drift).
      if (typeof activeProgram.ledger === 'string' && fs.existsSync(path.join(root, activeProgram.ledger))) {
        const ledgerRaw = fs.readFileSync(path.join(root, activeProgram.ledger), 'utf8');
        const ledgerMatch = ledgerRaw.match(/^\*\*Current change:\*\*\s*`([^`]+)`/m);
        const ledgerChange = ledgerMatch ? ledgerMatch[1].trim() : null;
        if (!ledgerChange) {
          errors.push(`active program ledger '${activeProgram.ledger}' is missing its machine-readable Current change field`);
        } else if (currentChange && ledgerChange !== currentChange) {
          errors.push(`active program ledger current change '${ledgerChange}' contradicts GOVERNANCE.activeProgram.currentChange '${currentChange}'`);
        }
      }
      if (currentChange) {
        const changeDir = path.join(root, 'openspec', 'changes', currentChange);
        if (!fs.existsSync(changeDir)) {
          errors.push(`GOVERNANCE.activeProgram.currentChange '${currentChange}' has no openspec/changes directory`);
        } else {
          try {
            const meta = JSON.parse(fs.readFileSync(path.join(changeDir, 'change.json'), 'utf8'));
            if (meta.id !== currentChange) {
              errors.push('activeProgram.currentChange change.json id does not match the program binding');
            }
            if (activeProgram.state === 'ACTIVE' && !['IN_PROGRESS', 'ACTIVE'].includes(meta.status)) {
              errors.push(`activeProgram.currentChange '${currentChange}' must be IN_PROGRESS while the program runs, got '${meta.status}'`);
            }
            if (activeProgram.state !== 'ACTIVE' && meta.status !== 'VALIDATED') {
              errors.push(`activeProgram.currentChange '${currentChange}' must be VALIDATED in state ${activeProgram.state}, got '${meta.status}'`);
            }
          } catch (error) {
            errors.push(`cannot read activeProgram.currentChange change.json: ${error.message}`);
          }
        }
      }
      // Phase 2 (post-067 hardening) must name its evidence root, and the
      // directory must exist so the phase cannot start without a home for
      // its evidence.
      if (activeProgram.state === 'PHASE_2_HARDENING') {
        const evidenceRoot = activeProgram.hardeningEvidenceRoot;
        if (typeof evidenceRoot !== 'string' || !evidenceRoot.trim()) {
          errors.push('GOVERNANCE.activeProgram.hardeningEvidenceRoot must be a non-empty path in PHASE_2_HARDENING');
        } else if (!fs.existsSync(path.join(root, evidenceRoot))) {
          errors.push(`GOVERNANCE.activeProgram.hardeningEvidenceRoot references missing path '${evidenceRoot}'`);
        }
      }
    }
  }
}

// Workflow-referenced script existence (campaign 028, task 4.4): every
// repo-relative `node <script>` invocation in .github/workflows/** must point
// at an existing file, so a rename cannot turn a CI gate into a silent no-op.
// Inline `node -e` snippets and `npx` invocations are ignored.
function workflowScriptRefs() {
  const dir = path.join(root, '.github/workflows');
  if (!fs.existsSync(dir)) return [];
  const refs = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) continue;
    const lines = fs.readFileSync(path.join(dir, entry.name), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const re = /\bnode\s+(?:--[A-Za-z0-9=_-]+\s+)*([^\s"'`;|&()]+\.(?:mjs|cjs|js|ts))/g;
      for (const m of line.matchAll(re)) {
        const ref = m[1].replace(/^\.\//, '');
        if (/\.(?:test|spec)\./.test(ref)) continue;
        refs.push({ file: `.github/workflows/${entry.name}`, line: i + 1, ref });
      }
    });
  }
  return refs;
}

for (const { file, line, ref } of workflowScriptRefs()) {
  if (!/^(?:scripts|apps|packages)\//.test(ref)) continue;
  if (!fs.existsSync(path.join(root, ref))) {
    errors.push(`${file}:${line} references missing script '${ref}'`);
  }
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
if (activeProgram && typeof activeProgram === 'object') {
  console.log(`Active program: ${activeProgram.id} — current change: ${activeProgram.currentChange}`);
}
console.log(`Default coder concurrency: ${governance.swarm.defaultMaxCoderAgents}`);
console.log(`Default Android emulators: ${governance.runtimeQa.defaultAndroidEmulators}`);
