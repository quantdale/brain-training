#!/usr/bin/env node
/**
 * Reproducible clean-checkout certification for Campaign 016, extended by
 * Campaign 028 to mirror the CI gate set (secrets boundary, workflow hygiene,
 * production dependency audit, affected-area map sync, Jest signal integrity).
 *
 * Run from the repository root after creating a fresh checkout/worktree:
 *   node scripts/certification/certify-clean-checkout.mjs
 *
 * 076-f campaign prompt section 6.1: the Expo step runs the DECLARED hermetic
 * gate (`scripts/validate-expo-alignment.mjs`). It used to run the network
 * `npx expo-doctor` as a hard gate while `.agent/GOVERNANCE.json` classifies
 * that command as network-dependent, weekly-schedule-only and advisory — "NOT a
 * repository-defect signal; the hermetic expo-alignment gate is the push-path
 * equivalent" — so the composite certified a harsher check than the gate the
 * project declares and could not run offline. The self-test gained four checks
 * that fail closed in both directions (hermetic gate present; network doctor
 * NOT a composite gate; governance classification unchanged; App CI still runs
 * the hermetic gate). No threshold was lowered.
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

/**
 * Declared governance/CI OpenSpec gate.
 *
 * This MUST stay byte-identical to the command in `.agent/GOVERNANCE.json`
 * (`openspec-validate-strict`) and `.github/workflows/repository-integrity.yml`.
 * 076-f task 7.2: an older pin here reported a weaker validation than the
 * declared CI gate, so the composite and the gate disagreed. The self-test
 * below asserts the three stay aligned; thresholds are never lowered.
 */
const OPENSPEC_GATE_LABEL = '@fission-ai/openspec@1.9.0 validate --all --strict';
const OPENSPEC_GATE_PKG = '@fission-ai/openspec@1.9.0';
const OPENSPEC_GATE_ARGS = ['validate', '--all', '--strict'];

/**
 * Declared governance/CI Expo gate.
 *
 * 076-f campaign prompt section 6.1: the composite used to run the NETWORK
 * `npx expo-doctor` as a hard gate while the declared CI gate set explicitly
 * does NOT. `.agent/GOVERNANCE.json` puts `expo-doctor` in
 * `networkDependentGates` ("needs https://api.expo.dev/v2/versions/latest;
 * weekly schedule only, tolerated and classified as upstream drift. NOT a
 * repository-defect signal") and in `advisoryOnlyGates`, and its
 * `notACiGate.expo-doctor-21/21` entry says: "Never record `Expo Doctor 21/21`
 * as a push-path result ... Record scripts/validate-expo-alignment.mjs
 * instead."
 *
 * The consequence was that the composite went FAIL on upstream patch drift
 * while the repository-owned Expo gate passed, certifying a different (and
 * harsher) check than the gate the project declares. The composite now runs
 * the HERMETIC declared gate, which answers the repository-owned question
 * ("does the app declare the Expo-family versions its own installed SDK
 * requires?") and cannot go red on an upstream patch release.
 *
 * This is an alignment, not a relaxation: the hermetic gate is strictly the
 * declared one, and the network doctor is recorded as the separate,
 * advisory, weekly-only result it actually is. Jest, audit and OpenSpec
 * thresholds are untouched.
 */
const EXPO_HERMETIC_GATE = ['node', 'scripts/validate-expo-alignment.mjs'];
const EXPO_HERMETIC_GATE_LABEL = 'scripts/validate-expo-alignment.mjs';
const EXPO_NETWORK_GATE_LABEL = 'expo-doctor';

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

  // 076-f task 7.2: the OpenSpec pin must equal the declared governance/CI
  // gate, or the composite certifies a different (weaker) validation than the
  // gate the project claims to run. Checked against this file's own source,
  // `.agent/GOVERNANCE.json` and the Repository Integrity workflow so a drift
  // in any one of the three fails closed instead of passing vacuously.
  try {
    const selfSource = readFileSync(new URL(import.meta.url), 'utf8');
    check(
      'self source pins the declared OpenSpec gate',
      selfSource.includes(OPENSPEC_GATE_LABEL),
      `expected to contain ${OPENSPEC_GATE_LABEL}`,
    );
    check(
      'self source has no superseded OpenSpec pin',
      // Built at runtime so this guard does not match its own literal.
      !selfSource.includes(`@fission-ai/openspec@${'1.6.0'}`),
      'found the superseded pre-076-f pin',
    );
    const governancePath = path.join(root, '.agent', 'GOVERNANCE.json');
    if (existsSync(governancePath)) {
      const governance = readFileSync(governancePath, 'utf8');
      check(
        'governance declares the same OpenSpec gate',
        governance.includes(OPENSPEC_GATE_LABEL),
        `governance does not contain ${OPENSPEC_GATE_LABEL}`,
      );
    }
    const workflowPath = path.join(root, '.github', 'workflows', 'repository-integrity.yml');
    if (existsSync(workflowPath)) {
      const workflow = readFileSync(workflowPath, 'utf8');
      check(
        'Repository Integrity workflow runs the same OpenSpec gate',
        workflow.includes(OPENSPEC_GATE_LABEL),
        `workflow does not contain ${OPENSPEC_GATE_LABEL}`,
      );
    }
  } catch (error) {
    failures.push(`OpenSpec pin alignment check failed — ${error.message}`);
  }

  // 076-f campaign prompt section 6.1: the composite must run the DECLARED
  // hermetic Expo gate and must NOT hard-gate the network `expo-doctor`.
  // This is the same class of script-versus-declared-gate contradiction that
  // the OpenSpec checks above close, and the guard has to fail closed in BOTH
  // directions: the hermetic gate present, the network doctor absent as a
  // composite gate. Without the second half the script can silently drift back
  // to the pre-076-f behaviour that produced a 19/20 composite on upstream
  // patch drift.
  try {
    const selfSource = readFileSync(new URL(import.meta.url), 'utf8');
    check(
      'self source runs the declared hermetic Expo gate',
      selfSource.includes(`'expo alignment', ...EXPO_HERMETIC_GATE`)
        && selfSource.includes(EXPO_HERMETIC_GATE_LABEL),
      `expected a gate running ${EXPO_HERMETIC_GATE_LABEL}`,
    );
    check(
      'self source does not hard-gate the network expo-doctor',
      !selfSource.includes(`run('Expo Doctor', 'npx', ['${EXPO_NETWORK_GATE_LABEL}']`),
      'the composite still hard-gates the network expo-doctor',
    );
    const governancePath = path.join(root, '.agent', 'GOVERNANCE.json');
    if (existsSync(governancePath)) {
      const governance = readFileSync(governancePath, 'utf8');
      check(
        'governance declares expo-doctor as advisory/network-only',
        governance.includes('"expo-doctor-upstream-drift"')
          && governance.includes('"advisoryOnlyGates"'),
        'governance no longer classifies expo-doctor as an advisory/network gate',
      );
      check(
        'governance declares the hermetic expo-alignment gate on the push path',
        governance.includes('expo-alignment (scripts/validate-expo-alignment.mjs)'),
        'governance no longer lists the hermetic expo-alignment gate',
      );
    }
    const appCiPath = path.join(root, '.github', 'workflows', 'app-ci.yml');
    if (existsSync(appCiPath)) {
      const appCi = readFileSync(appCiPath, 'utf8');
      check(
        'App CI runs the hermetic expo-alignment gate',
        appCi.includes('node scripts/validate-expo-alignment.mjs'),
        'App CI no longer runs the hermetic expo-alignment gate',
      );
    }
  } catch (error) {
    failures.push(`Expo gate alignment check failed — ${error.message}`);
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`certify self-test FAIL: ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('certify-clean-checkout self-test: PASS (14 checks)');
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
  results.push(run('OpenSpec', 'npx', ['--yes', OPENSPEC_GATE_PKG, ...OPENSPEC_GATE_ARGS]));
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
  // 076-f campaign prompt section 6.1: run the DECLARED hermetic Expo gate,
  // not the network doctor. The network doctor remains a weekly-only advisory
  // CI gate per GOVERNANCE.json; running it here as a hard gate certified a
  // harsher check than the project declares.
  results.push(run('expo alignment', ...EXPO_HERMETIC_GATE));

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
