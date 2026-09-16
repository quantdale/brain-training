#!/usr/bin/env node
/**
 * Reproducible clean-checkout certification for Campaign 016, extended by
 * Campaign 028 to mirror the CI gate set (secrets boundary, workflow hygiene,
 * production dependency audit, affected-area map sync, Jest signal integrity).
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

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const app = path.join(root, 'apps', 'mobile');
const allowJestNotValidated = process.argv.includes('--allow-jest-not-validated');
const skipInstall = process.argv.includes('--skip-install');
// These switches are useful for diagnostics on constrained hosts, but they
// deliberately make this invocation non-certifying. A release gate must not
// report PASS when a required boundary was skipped or could not be validated.
const nonCertifyingOptions = allowJestNotValidated || skipInstall;
const selfTestMode = process.argv.includes('--self-test');

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

/**
 * Resolve a non-HEAD provenance base (frontier audit `certify-provenance-parity`).
 *
 * `validate-provenance` defaults to `origin/main`; immediately after a push
 * that ref IS HEAD, so `git diff` is empty and the gate passed without doing
 * any work. App CI resolves the real pre-change SHA (`github.event.before` / PR
 * base). Certify mirrors that policy: an explicit `PROVENANCE_BASE_REF` wins,
 * else `origin/main` when it differs from HEAD, else the parent commit; an
 * orphan history with no parent fails closed instead of passing vacuously.
 */
function resolveProvenanceBase({ envRef = process.env.PROVENANCE_BASE_REF, cwd = root } = {}) {
  const rev = (ref) => {
    const result = spawnSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.status === 0 ? result.stdout.trim() : null;
  };
  if (envRef) {
    return rev(envRef)
      ? { base: envRef, source: 'PROVENANCE_BASE_REF' }
      : { base: null, source: `unresolvable PROVENANCE_BASE_REF '${envRef}'` };
  }
  const head = rev('HEAD');
  const origin = rev('origin/main');
  if (origin && (!head || origin !== head)) {
    return { base: 'origin/main', source: 'origin/main differs from HEAD' };
  }
  if (rev('HEAD^')) {
    return { base: 'HEAD^', source: 'origin/main equals HEAD' };
  }
  return { base: null, source: 'no non-HEAD base resolvable (no parent commit)' };
}

/**
 * Offline self-test for the provenance-base policy (no repository state
 * required): single-commit history fails closed, `origin/main == HEAD` falls
 * back to the parent, a diverged `origin/main` is preferred, and an explicit
 * env ref wins.
 */
function selfTest() {
  const failures = [];
  const check = (name, condition, detail) => {
    if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  };
  const dir = mkdtempSync(path.join(tmpdir(), 'certify-base-'));
  const git = (args) => execFileSync('git', args, { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
  const commit = (message) => {
    writeFileSync(path.join(dir, 'file.txt'), `${message}\n`, { flag: 'a' });
    git(['add', '.']);
    git(['commit', '-q', '-m', message]);
  };
  try {
    git(['init', '-q']);
    git(['config', 'user.email', 'self-test@example.com']);
    git(['config', 'user.name', 'certify self-test']);
    commit('first');

    // Orphan history (no parent, no origin/main) → fail closed.
    let resolved = resolveProvenanceBase({ envRef: null, cwd: dir });
    check('single commit fails closed', resolved.base === null, JSON.stringify(resolved));

    commit('second');
    // No origin/main ref: the parent is the only non-HEAD base.
    resolved = resolveProvenanceBase({ envRef: null, cwd: dir });
    check('no origin/main falls back to HEAD^', resolved.base === 'HEAD^', JSON.stringify(resolved));

    // origin/main == HEAD after a push: must still diff against HEAD^.
    git(['update-ref', 'refs/remotes/origin/main', 'HEAD']);
    resolved = resolveProvenanceBase({ envRef: null, cwd: dir });
    check('origin/main == HEAD falls back to HEAD^', resolved.base === 'HEAD^', JSON.stringify(resolved));

    // origin/main behind HEAD (local commits not pushed): prefer origin/main.
    commit('third');
    resolved = resolveProvenanceBase({ envRef: null, cwd: dir });
    check('diverged origin/main is preferred', resolved.base === 'origin/main', JSON.stringify(resolved));

    // Explicit env ref wins even when it equals HEAD.
    resolved = resolveProvenanceBase({ envRef: 'HEAD', cwd: dir });
    check('explicit base wins', resolved.base === 'HEAD', JSON.stringify(resolved));
    resolved = resolveProvenanceBase({ envRef: 'does-not-exist', cwd: dir });
    check('unresolvable explicit base fails', resolved.base === null, JSON.stringify(resolved));
  } catch (error) {
    failures.push(`self-test setup failed — ${error.message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`certify self-test FAIL: ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('certify-clean-checkout self-test: PASS (6 checks)');
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

if (selfTestMode) {
  selfTest();
} else if (root !== path.resolve(root)) {
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
  // Provenance must diff against a real pre-change base: on a clean pushed
  // `main`, `origin/main` IS HEAD and the default invocation did no work
  // (frontier audit `certify-provenance-parity`). Resolve the same class of
  // base App CI uses, or fail closed when none exists.
  const provenanceBase = resolveProvenanceBase();
  if (!provenanceBase.base) {
    fail(`provenance base unresolved: ${provenanceBase.source}`);
  } else {
    console.log(`\nprovenance base: ${provenanceBase.base} (${provenanceBase.source})`);
    results.push(run('provenance', 'node', ['scripts/validate-provenance.mjs', '--check', `--base=${provenanceBase.base}`]));
  }
  results.push(run('provenance self-test', 'node', ['scripts/validate-provenance.mjs', '--self-test']));
  results.push(run('jest signal self-test', 'node', ['scripts/certification/validate-jest-signal.mjs', '--self-test']));
  results.push(run('offline boundary', 'node', ['scripts/validate-offline.mjs', '--check']));
  results.push(run('secret boundary', 'node', ['scripts/validate-secrets.mjs', '--check']));
  results.push(run('workflow hygiene', 'node', ['scripts/validate-workflows.mjs']));
  results.push(run('dependency audit', 'node', ['scripts/validate-dependency-audit.mjs']));
  results.push(run('affected-area map sync', 'node', ['scripts/validate-affected.mjs', '--check-sync']));
  results.push(run('runtime QA contract', 'node', ['scripts/qa/validate-runtime-qa-contract.mjs']));
  results.push(run('typecheck', 'npm', ['run', 'typecheck'], app));
  results.push(run('lint', 'npm', ['run', 'lint'], app));
  results.push(run('web export', 'npx', ['expo', 'export', '--platform', 'web'], app));
  results.push(run('Expo Doctor', 'npx', ['expo-doctor'], app));

  // Mirror app-ci: emit the machine-readable summary and validate the skip
  // signal against the reviewed allowlist (stale entries fail closed).
  const jestOk = run('full Jest', 'npm', ['run', 'test:ci', '--', '--json', '--outputFile=jest-summary.json'], app);
  if (!jestOk) {
    if (allowJestNotValidated) {
      console.warn('full_jest=NOT_VALIDATED (explicitly allowed; inspect and record the failure evidence)');
    }
    // An explicitly allowed NOT VALIDATED result is still a failed
    // certification gate; the flag only lets the remaining diagnostics run.
    results.push(false);
  } else {
    results.push(true);
    results.push(run('jest signal', 'node', ['scripts/certification/validate-jest-signal.mjs', '--summary', 'apps/mobile/jest-summary.json']));
  }
  results.push(trackedMutation());

  if (nonCertifyingOptions || results.some((result) => !result)) {
    fail('clean-checkout certification did not pass all required gates');
  } else {
    console.log('\ncertify-clean-checkout: PASS');
  }
}

if (process.exitCode) process.exit(process.exitCode);
