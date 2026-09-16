#!/usr/bin/env node
/**
 * Offline contract check for the Android runtime-QA boundary.
 *
 * ARTEMIS is installed outside this repository, so CI cannot (and must not)
 * require a device, model credential, or network service. This check guards
 * the repository-side handoff: the former custom driver is absent, the
 * authoritative setup documentation names the external ARTEMIS location and
 * MCP surface, and the app's semantic/deep-link seams remain available to the
 * runtime agent.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function absolute(relative) {
  return path.join(ROOT, relative);
}

function read(relative) {
  return fs.readFileSync(absolute(relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(absolute(relative));
}

const failures = [];

function requireFile(relative) {
  if (!exists(relative)) failures.push(`missing required file: ${relative}`);
}

function requireText(relative, needle) {
  if (!exists(relative)) {
    failures.push(`cannot inspect missing file: ${relative}`);
    return;
  }
  if (!read(relative).includes(needle)) {
    failures.push(`missing '${needle}' in ${relative}`);
  }
}

// The custom orchestrator was intentionally removed. Historical campaign
// records may still mention its name, but no executable or lockfile may remain.
if (exists('scripts/qa/autobot.mjs')) failures.push('obsolete custom QA driver still exists: scripts/qa/autobot.mjs');
if (read('.gitignore').includes('scripts/qa/.autobot.lock')) {
  failures.push('obsolete custom QA lock is still ignored: scripts/qa/.autobot.lock');
}

[
  'docs/ARTEMIS_ANDROID_QA.md',
  'docs/ANDROID_AUTOMATION.md',
  'scripts/qa/README.md',
  'scripts/qa/validate-runtime-qa-contract.mjs',
].forEach(requireFile);

requireText('docs/ARTEMIS_ANDROID_QA.md', 'D:\\Tools\\artemis');
requireText('docs/ARTEMIS_ANDROID_QA.md', 'mobile_run_task');
requireText('docs/ARTEMIS_ANDROID_QA.md', 'mobile_diagnose');
requireText('docs/ARTEMIS_ANDROID_QA.md', '--profile flash');
requireText('docs/ARTEMIS_ANDROID_QA.md', '--profile pro');
requireText('docs/ARTEMIS_ANDROID_QA.md', 'braintraining-ui35');
requireText('AGENTS.md', 'ARTEMIS');
requireText('README.md', 'ARTEMIS');

// These are product instrumentation seams, not driver implementation. Their
// presence is the minimum contract required for resilient natural-language QA.
requireText('apps/mobile/app.json', '"scheme": "braintraining"');
requireFile('apps/mobile/src/sdk/testid.ts');

if (failures.length > 0) {
  console.error('Runtime QA contract: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Runtime QA contract: PASS');
}
