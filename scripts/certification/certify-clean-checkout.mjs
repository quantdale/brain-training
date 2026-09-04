#!/usr/bin/env node
/**
 * Reproducible clean-checkout certification for Campaign 016.
 *
 * Run from the repository root after creating a fresh checkout/worktree:
 *   node scripts/certification/certify-clean-checkout.mjs
 *
 * The repository has no root package manifest/lockfile. The Expo app is the
 * install boundary, so npm ci and app commands deliberately run in
 * apps/mobile. Root governance/content validators run from the repository
 * root. A full Jest failure is never silently converted to PASS; use
 * --allow-jest-not-validated only when the host-level SIGSEGV limitation is
 * already evidenced and must be recorded as NOT VALIDATED.
 */

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const app = path.join(root, 'apps', 'mobile');
const allowJestNotValidated = process.argv.includes('--allow-jest-not-validated');
const skipInstall = process.argv.includes('--skip-install');
// These switches are useful for diagnostics on constrained hosts, but they
// deliberately make this invocation non-certifying. A release gate must not
// report PASS when a required boundary was skipped or could not be validated.
const nonCertifyingOptions = allowJestNotValidated || skipInstall;

function fail(message) {
  console.error(`certify-clean-checkout: FAIL — ${message}`);
  process.exitCode = 1;
}

function run(label, command, args, cwd = root, options = {}) {
  console.log(`\n== ${label} ==`);
  console.log(`$ (cd ${path.relative(root, cwd) || '.'} && ${command} ${args.join(' ')})`);
  const isWin = process.platform === 'win32';
  const resolvedCommand = isWin && (command === 'npm' || command === 'npx') ? `${command}.cmd` : command;
  const result = spawnSync(resolvedCommand, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: isWin,
    ...options,
  });
  if (result.error) {
    fail(`${label}: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`certify-clean-checkout: ${label} exited ${result.status ?? 'unknown'}`);
    return false;
  }
  return true;
}

function assertCleanPrerequisites() {
  const required = [
    '.agent/GOVERNANCE.json',
    'openspec/changes',
    'scripts/validate-repo-state.mjs',
    'apps/mobile/package.json',
    'apps/mobile/package-lock.json',
  ];
  for (const relative of required) {
    if (!existsSync(path.join(root, relative))) {
      fail(`missing clean-checkout prerequisite: ${relative}`);
      return false;
    }
  }

  // Native folders and dependency trees must not be inherited by this run.
  const forbidden = [
    'node_modules',
    '.expo',
    'coverage',
    'apps/mobile/node_modules',
    'apps/mobile/.expo',
    'apps/mobile/android',
    'apps/mobile/ios',
  ];
  const present = forbidden.filter((relative) => existsSync(path.join(root, relative)));
  if (present.length > 0 && !skipInstall) {
    fail(`checkout is not clean; remove inherited/generated paths: ${present.join(', ')}`);
    return false;
  }
  return true;
}

function trackedMutation() {
  const result = spawnSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    fail('could not inspect tracked-file mutation with git status');
    return false;
  }
  const lines = result.stdout.trim();
  if (lines) {
    console.error('certify-clean-checkout: tracked/generated mutation detected:');
    console.error(lines);
    fail('clean certification mutated the checkout');
    return false;
  }
  console.log('tracked_mutation_after_clean_run=PASS');
  return true;
}

if (root !== path.resolve(root)) {
  fail('unexpected non-absolute working directory');
} else if (!assertCleanPrerequisites()) {
  // Keep the failure message above as the actionable result.
} else {
  const results = [];
  if (skipInstall) {
    console.warn('app npm ci=NOT_VALIDATED (--skip-install is diagnostic-only)');
  }
  if (!skipInstall) results.push(run('app npm ci', 'npm', ['ci', '--ignore-scripts'], app));
  results.push(run('repository state', 'node', ['scripts/validate-repo-state.mjs']));
  results.push(run('task ownership', 'node', ['scripts/validate-task-ownership.cjs']));
  results.push(run('OpenSpec', 'npx', ['--yes', '@fission-ai/openspec@1.6.0', 'validate', '--all']));
  results.push(run('registry', 'node', ['scripts/generate-game-registry.mjs', '--check']));
  results.push(run('provenance', 'node', ['scripts/validate-provenance.mjs', '--check']));
  results.push(run('offline boundary', 'node', ['scripts/validate-offline.mjs', '--check']));
  results.push(run('QA self-test', 'node', ['scripts/qa/autobot.mjs', '--self-test']));
  results.push(run('typecheck', 'npm', ['run', 'typecheck'], app));
  results.push(run('lint', 'npm', ['run', 'lint'], app));
  results.push(run('web export', 'npx', ['expo', 'export', '--platform', 'web'], app));
  results.push(run('Expo Doctor', 'npx', ['expo-doctor'], app));

  const jestOk = run('full Jest', 'npm', ['run', 'test:ci'], app);
  if (!jestOk) {
    if (allowJestNotValidated) {
      console.warn('full_jest=NOT_VALIDATED (explicitly allowed; inspect and record the failure evidence)');
    }
    // An explicitly allowed NOT VALIDATED result is still a failed
    // certification gate; the flag only lets the remaining diagnostics run.
    results.push(false);
  } else {
    results.push(true);
  }
  results.push(trackedMutation());

  if (nonCertifyingOptions || results.some((result) => !result)) {
    fail('clean-checkout certification did not pass all required gates');
  } else {
    console.log('\ncertify-clean-checkout: PASS');
  }
}

if (process.exitCode) process.exit(process.exitCode);
