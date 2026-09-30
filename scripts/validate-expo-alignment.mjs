#!/usr/bin/env node
/**
 * validate-expo-alignment.mjs — hermetic Expo-family dependency alignment gate
 * (Change 069, `dependency-gate-integrity` R1).
 *
 * WHY THIS EXISTS
 * ---------------
 * `npx expo-doctor` is a *time-dependent* gate. It resolves the expected
 * version of every Expo package from `https://api.expo.dev/v2/versions/latest`
 * (a network fetch), not from the repository. That makes it structurally
 * incapable of being a per-push gate: it turns red with ZERO repository
 * changes the moment Expo publishes a patch, and the durable state then
 * disagrees with CI. This repository already decided that principle once —
 * Change 064 moved the network-dependent `npm audit` gate out of hermetic App
 * CI for exactly the same reason — and then added `expo-doctor` to App CI
 * anyway, reintroducing the failure mode.
 *
 * The question an alignment gate actually needs to answer is narrower, and it
 * is answerable offline: *does the app declare the Expo-family versions the
 * installed SDK requires?* The answer is authoritative, hermetic, and stable:
 * the installed SDK ships `expo/bundledNativeModules.json`, which is the exact
 * set of native-module versions that SDK release was built and tested against.
 * A repository defect is a declared range that does not *accept* the version
 * its own installed SDK mandates (a drifted pin, a wrong major, a stale range
 * that excludes the bundled version). Upstream "Expo has a newer patch"
 * drift is a different thing and belongs in the scheduled observation lane.
 *
 * The check
 * ---------
 * For every Expo-family runtime dependency (the `expo` / `expo-*` / `react*`
 * family) that the installed SDK's bundled manifest covers:
 *   declared range MUST satisfy the bundled range.
 *
 * "Satisfies the bundled range" = the declared range accepts every version the
 * bundled range accepts, i.e. `semver subset` semantics. Implemented directly
 * here over the range interval algebra rather than by shelling out to a
 * semver package, so the push path needs no extra dependency and no network.
 *
 * Fail-closed contract (never a silent pass):
 *   exit 0  PASS    — every covered Expo-family pin accepts its bundled range
 *   exit 1  FAIL    — at least one declared pin does not accept its bundled range
 *   exit 2  BLOCKED — manifest, bundled manifest, or a declared range cannot be
 *                     read/parsed, or a package is in a family the range parser
 *                     does not understand. A gate that cannot evaluate a pin
 *                     must not report success.
 *
 * Usage (from the repo root):
 *   node scripts/validate-expo-alignment.mjs
 *   node scripts/validate-expo-alignment.mjs --self-test
 *   node scripts/validate-expo-alignment.mjs --package-dir=<dir> \
 *        --bundled-manifest=<path>   # injected fixtures, used by the self-test
 *
 * No dependencies: plain ESM over node:fs / node:path / node:url. Deterministic
 * output (findings sorted by package name).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_PACKAGE_DIR = path.join(ROOT, 'apps', 'mobile');

/**
 * Expo-family runtime dependencies this gate owns. Membership is what makes a
 * package in scope; the bundled manifest then decides which of them are
 * actually checkable (the `expo` package itself is the SDK root and is NOT in
 * its own bundled manifest, so it is deliberately out of the checkable set).
 */
export function isExpoFamily(name) {
  if (typeof name !== 'string' || !name) return false;
  return (
    name === 'expo' ||
    name.startsWith('expo-') ||
    name === 'react' ||
    name === 'react-dom' ||
    name === 'react-native' ||
    name === 'react-native-web' ||
    name.startsWith('react-native-')
  );
}

// ——— Semver range interval algebra (offline, dependency-free) ———

/** Parse `1.2.3` / `1.2` / `1` into a comparable triple, or null. */
export function parseVersion(value) {
  if (typeof value !== 'string') return null;
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
  };
}

function cmpVersion(a, b) {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  // A prerelease sorts below its own release (semver §11).
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
}

const bumpMajor = (v) => ({ major: v.major + 1, minor: 0, patch: 0, prerelease: null });
const bumpMinor = (v) => ({ major: v.major, minor: v.minor + 1, patch: 0, prerelease: null });
const bumpPatch = (v) => ({ major: v.major, minor: v.minor, patch: v.patch + 1, prerelease: null });

/**
 * Turn a single npm range comparator set into `{min, minInclusive, max, maxInclusive}`
 * plus `exact` when it is a pinned version. Only the forms this repository's
 * manifest actually uses are understood (`*`/`x`/empty, exact, `~`, `^`, and
 * the `>=`-style comparators Expo manifests occasionally carry). Anything else
 * returns `{unsupported: reason}` so the caller can BLOCK rather than guess.
 */
export function parseRange(range) {
  if (typeof range !== 'string') return { unsupported: 'range is not a string' };
  const raw = range.trim();
  if (raw === '' || raw === '*' || raw === 'x' || raw === 'X' || raw === 'latest') {
    return { min: { major: 0, minor: 0, patch: 0, prerelease: null }, minInclusive: true, max: null, maxInclusive: false };
  }

  // Union (`||`) is out of scope for this gate; an Expo manifest that uses it
  // must be handled explicitly rather than silently mis-evaluated.
  if (raw.includes('||')) return { unsupported: 'union ranges (||) are not supported' };
  if (/\s-\s/.test(raw)) return { unsupported: 'hyphen ranges are not supported' };

  const m = /^(\^|~>|~|>=|>|<=|<|=)?\s*v?(\d+|x|X|\*)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(raw);
  if (!m) return { unsupported: `unparseable range "${raw}"` };
  const op = m[1] ?? '=';
  const [majRaw, minRaw, patRaw] = [m[2], m[3], m[4]];
  const wildcard = (part) => part === undefined || part === 'x' || part === 'X' || part === '*';

  if (wildcard(majRaw)) {
    if (op !== '=' ) return { unsupported: `operator "${op}" with a wildcard major` };
    return { min: { major: 0, minor: 0, patch: 0, prerelease: null }, minInclusive: true, max: null, maxInclusive: false };
  }
  const major = Number(majRaw);
  const minor = wildcard(minRaw) ? 0 : Number(minRaw);
  const patch = wildcard(patRaw) ? 0 : Number(patRaw);
  const base = { major, minor, patch, prerelease: m[5] ?? null };
  const hasMinor = !wildcard(minRaw);
  const hasPatch = !wildcard(patRaw);

  if (op === '^') {
    // Caret keeps the left-most non-zero component stable (semver §11.1).
    let upper;
    if (major !== 0) upper = bumpMajor(base);
    else if (!hasMinor) upper = bumpMajor(base);
    else if (minor !== 0) upper = bumpMinor(base);
    else if (!hasPatch) upper = bumpMinor(base);
    else upper = bumpPatch(base);
    return { min: base, minInclusive: true, max: upper, maxInclusive: false };
  }
  if (op === '~' || op === '~>') {
    // Tilde allows patch-level drift when a minor is pinned, minor-level when not.
    const upper = hasMinor ? bumpMinor(base) : bumpMajor(base);
    return { min: base, minInclusive: true, max: upper, maxInclusive: false };
  }
  if (op === '=') {
    if (!hasPatch) return { min: base, minInclusive: true, max: bumpMinor(base), maxInclusive: false };
    return { exact: base };
  }
  if (op === '>=') return { min: base, minInclusive: true, max: null, maxInclusive: false };
  if (op === '>') return { min: base, minInclusive: false, max: null, maxInclusive: false };
  if (op === '<=') return { min: null, minInclusive: false, max: base, maxInclusive: true };
  if (op === '<') return { min: null, minInclusive: false, max: base, maxInclusive: false };
  return { unsupported: `unsupported operator "${op}"` };
}

function intervalEmpty(iv) {
  if (iv.exact) return false;
  if (iv.min === null || iv.max === null) return false;
  const c = cmpVersion(iv.min, iv.max);
  if (c > 0) return true;
  if (c === 0 && !(iv.minInclusive && iv.maxInclusive)) return true;
  return false;
}

/**
 * `a ⊇ b` (a accepts everything b accepts) over the parsed interval algebra.
 * The gate's central predicate: a declared pin must ACCEPT the bundled range,
 * not merely overlap it. An overlapping-but-narrower pin is a real defect —
 * it silently pins away versions the SDK requires.
 */
export function rangeAccepts(outer, inner) {
  if (outer.unsupported || inner.unsupported) return { ok: false, reason: outer.unsupported || inner.unsupported };
  if (outer.exact && inner.exact) {
    return { ok: cmpVersion(outer.exact, inner.exact) === 0 };
  }
  if (outer.exact) {
    if (inner.exact) return { ok: false };
    if (cmpVersion(outer.exact, inner.min) < 0) return { ok: false };
    if (inner.minInclusive && cmpVersion(outer.exact, inner.min) === 0) return { ok: false };
    if (inner.max !== null) {
      const c = cmpVersion(outer.exact, inner.max);
      if (c > 0) return { ok: false };
      if (c === 0 && !inner.maxInclusive) return { ok: false };
    }
    return { ok: true };
  }
  // outer is a range, inner is exact: the range must contain the exact version.
  if (inner.exact) {
    if (outer.min !== null) {
      const c = cmpVersion(inner.exact, outer.min);
      if (c < 0 || (c === 0 && !outer.minInclusive)) return { ok: false };
    }
    if (outer.max !== null) {
      const c = cmpVersion(inner.exact, outer.max);
      if (c > 0 || (c === 0 && !outer.maxInclusive)) return { ok: false };
    }
    return { ok: true };
  }
  // Lower edge: an outer bound of null means -infinity, which covers any inner
  // lower bound. An inner bound of null with a bounded outer does not.
  if (outer.min !== null) {
    if (inner.min === null) return { ok: false };
    const c = cmpVersion(outer.min, inner.min);
    if (c > 0) return { ok: false };
    if (c === 0 && outer.minInclusive && !inner.minInclusive) return { ok: false };
  }
  // Upper edge: symmetric. An unbounded outer covers any inner upper bound.
  if (outer.max !== null) {
    if (inner.max === null) return { ok: false };
    const c = cmpVersion(outer.max, inner.max);
    if (c < 0) return { ok: false };
    if (c === 0 && outer.maxInclusive && !inner.maxInclusive) return { ok: false };
  }
  return { ok: true };
}

// ——— Gate logic ———

/**
 * Evaluate alignment from already-read inputs. Returns
 * `{status: 'pass'|'fail'|'blocked', findings, checked, skipped, reason}`.
 * Extracted from IO so the self-test can drive it with synthetic fixtures.
 */
export function checkAlignment(packageJson, bundled) {
  if (!packageJson || typeof packageJson !== 'object' || Array.isArray(packageJson)) {
    return { status: 'blocked', reason: 'package manifest is not an object', findings: [], checked: [], skipped: [] };
  }
  const deps = packageJson.dependencies;
  if (!deps || typeof deps !== 'object' || Array.isArray(deps)) {
    return { status: 'blocked', reason: 'package manifest has no "dependencies" map', findings: [], checked: [], skipped: [] };
  }
  if (!bundled || typeof bundled !== 'object' || Array.isArray(bundled)) {
    return { status: 'blocked', reason: 'bundled native-module manifest is not an object', findings: [], checked: [], skipped: [] };
  }

  const findings = [];
  const checked = [];
  const skipped = [];
  const family = Object.keys(deps).filter(isExpoFamily).sort();

  for (const name of family) {
    const declared = deps[name];
    const required = bundled[name];
    if (required === undefined) {
      // The installed SDK does not pin this package (e.g. the `expo` root).
      skipped.push({ name, declared, reason: 'not covered by the installed SDK bundled manifest' });
      continue;
    }
    const declaredIv = parseRange(declared);
    if (declaredIv.unsupported) {
      findings.push({ name, declared, required, kind: 'blocked', reason: `declared range: ${declaredIv.unsupported}` });
      continue;
    }
    const requiredIv = parseRange(required);
    if (requiredIv.unsupported) {
      findings.push({ name, declared, required, kind: 'blocked', reason: `bundled range: ${requiredIv.unsupported}` });
      continue;
    }
    if (intervalEmpty(declaredIv) || intervalEmpty(requiredIv)) {
      findings.push({ name, declared, required, kind: 'blocked', reason: 'range is empty' });
      continue;
    }
    const verdict = rangeAccepts(declaredIv, requiredIv);
    if (!verdict.ok) {
      findings.push({
        name,
        declared,
        required,
        kind: 'mismatch',
        reason: `declared range "${declared}" does not accept the bundled range "${required}" required by the installed Expo SDK`,
      });
      continue;
    }
    checked.push({ name, declared, required });
  }

  findings.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const blocked = findings.filter((f) => f.kind === 'blocked');
  if (blocked.length) {
    return {
      status: 'blocked',
      reason: `cannot evaluate ${blocked.length} Expo-family pin(s): ${blocked.map((f) => `${f.name} (${f.reason})`).join('; ')}`,
      findings,
      checked,
      skipped,
    };
  }
  if (findings.length) return { status: 'fail', reason: null, findings, checked, skipped };
  return { status: 'pass', reason: null, findings, checked, skipped };
}

function readJsonFile(file, label) {
  if (!fs.existsSync(file)) return { ok: false, reason: `${label} not found at ${path.relative(ROOT, file)}` };
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (err) {
    return { ok: false, reason: `${label} is unreadable (${err.message})` };
  }
  try {
    return { ok: true, json: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, reason: `${label} is not valid JSON (${err.message})` };
  }
}

function resolvePaths(args) {
  const dirArg = args.find((a) => a.startsWith('--package-dir='));
  const pkgDir = dirArg ? path.resolve(ROOT, dirArg.split('=')[1]) : DEFAULT_PACKAGE_DIR;
  const manifestArg = args.find((a) => a.startsWith('--bundled-manifest='));
  const bundledFile = manifestArg
    ? path.resolve(ROOT, manifestArg.split('=')[1])
    : path.join(pkgDir, 'node_modules', 'expo', 'bundledNativeModules.json');
  return { pkgDir, manifestFile: path.join(pkgDir, 'package.json'), bundledFile };
}

// ——— Self-test: offline fixtures, no network, no repository dependency ———

function selfTest() {
  let pass = 0;
  let fail = 0;
  const expect = (cond, name) => {
    if (cond) pass++;
    else {
      fail++;
      console.error(`SELF-TEST FAIL: ${name}`);
    }
  };

  // Version parsing + ordering.
  expect(parseVersion('1.2.3') !== null, 'parses a three-part version');
  expect(parseVersion('1.2.3-beta.1')?.prerelease === 'beta.1', 'parses a prerelease tag');
  expect(parseVersion('57.0.24') !== null, 'parses an Expo-style version');
  expect(parseVersion('~57.0.24') === null, 'rejects a range as a version');
  expect(parseVersion('') === null, 'rejects an empty version');
  expect(cmpVersion(parseVersion('1.0.0'), parseVersion('2.0.0')) === -1, 'major ordering');
  expect(cmpVersion(parseVersion('1.2.0'), parseVersion('1.10.0')) === -1, 'minor ordering is numeric, not lexical');
  expect(cmpVersion(parseVersion('1.0.0-rc.1'), parseVersion('1.0.0')) === -1, 'prerelease sorts below release');

  // Range parsing.
  const tilde = parseRange('~57.0.24');
  expect(!tilde.unsupported && tilde.min.major === 57 && tilde.min.minor === 0 && tilde.max.major === 57 && tilde.max.minor === 1, 'tilde pins the minor and allows patch drift only');
  const caret = parseRange('^1.2.3');
  expect(!caret.unsupported && caret.max.major === 2, 'caret on a non-zero major allows the next major');
  const caretZero = parseRange('^0.4.2');
  expect(!caretZero.unsupported && caretZero.max.minor === 5, 'caret on 0.x allows the next minor');
  const caretZeroMinor = parseRange('^0.0.3');
  expect(!caretZeroMinor.unsupported && caretZeroMinor.max.patch === 4, 'caret on 0.0.x allows the next patch');
  const exact = parseRange('19.2.3');
  expect(!exact.unsupported && exact.exact?.major === 19, 'bare version is an exact pin');
  const gte = parseRange('>=1.0.0');
  expect(!gte.unsupported && gte.minInclusive && gte.max === null, '>= is an open-ended lower bound');
  expect(parseRange('*').unsupported === undefined, '* is unconstrained');
  expect(parseRange('1.0.0 || 2.0.0').unsupported !== undefined, 'union range is rejected, not mis-evaluated');
  expect(parseRange('1.0.0 - 2.0.0').unsupported !== undefined, 'hyphen range is rejected, not mis-evaluated');
  expect(parseRange('workspace:*').unsupported !== undefined, 'unsupported protocol range is rejected');
  expect(parseRange(null).unsupported !== undefined, 'non-string range is rejected');
  expect(parseRange('~=1.2').unsupported !== undefined, 'unsupported tilde-slash operator is rejected');

  // rangeAccepts: the central subset predicate.
  expect(rangeAccepts(parseRange('~57.0.24'), parseRange('~57.0.24')).ok === true, 'identical ranges accept');
  expect(rangeAccepts(parseRange('~57.0.24'), parseRange('~57.0.26')).ok === true, 'a tilde pin accepts a newer bundled patch inside the same minor');
  expect(rangeAccepts(parseRange('~57.0.24'), parseRange('~57.1.0')).ok === false, 'a tilde pin excludes a bundled minor outside its range');
  expect(rangeAccepts(parseRange('~57.0.2'), parseRange('~57.0.4')).ok === true, 'wider tilde accepts a narrower bundled tilde (real repo case)');
  expect(rangeAccepts(parseRange('57.0.2'), parseRange('57.0.2')).ok === true, 'identical exact pins accept');
  expect(rangeAccepts(parseRange('57.0.2'), parseRange('57.0.3')).ok === false, 'a stale exact pin rejects the bundled patch');
  expect(rangeAccepts(parseRange('~57.0.2'), parseRange('57.0.2')).ok === true, 'range contains the bundled exact version');
  expect(rangeAccepts(parseRange('~57.0.2'), parseRange('57.1.9')).ok === false, 'range excludes an out-of-range bundled version');
  expect(rangeAccepts(parseRange('>=57.0.1'), parseRange('~57.0.2')).ok === true, 'an open-ended lower bound covers an upper-bounded bundled range above it');
  expect(rangeAccepts(parseRange('>=57.0.1'), parseRange('~56.0.2')).ok === false, 'an open-ended lower bound does not cover a bundled range below it');
  expect(rangeAccepts(parseRange('~57.0.2'), parseRange('>=57.0.1')).ok === false, 'a bounded range does not cover an unbounded bundled range');
  expect(rangeAccepts(parseRange('^57.0.0'), parseRange('~57.0.2')).ok === true, 'caret covers a tilde within the same major');
  expect(rangeAccepts(parseRange('^56.0.0'), parseRange('~57.0.2')).ok === false, 'a wrong-major caret does not cover the bundled range');
  expect(rangeAccepts(parseRange('*'), parseRange('~57.0.2')).ok === true, 'an unconstrained pin accepts anything');

  // Family membership.
  expect(isExpoFamily('expo') && isExpoFamily('expo-router') && isExpoFamily('react-native-screens'), 'expo family membership');
  expect(isExpoFamily('react') && isExpoFamily('react-native'), 'react family membership');
  expect(isExpoFamily('jest') === false && isExpoFamily('@testing-library/react-native') === false, 'dev tooling is out of scope');
  expect(isExpoFamily('') === false && isExpoFamily(null) === false, 'non-strings are not family members');

  // Gate semantics on synthetic manifests.
  const manifest = (deps) => ({ dependencies: deps });
  const clean = checkAlignment(
    manifest({ expo: '~57.0.24', 'expo-router': '~57.0.22', react: '19.2.3', lodash: '4.17.21' }),
    { 'expo-router': '~57.0.22', react: '19.2.3' },
  );
  expect(clean.status === 'pass' && clean.checked.length === 2, 'aligned manifest passes');
  expect(clean.skipped.some((s) => s.name === 'expo' && /bundled manifest/.test(s.reason)), 'the expo root is skipped, not silently ignored');
  expect(clean.checked.every((c) => c.name !== 'lodash'), 'non-expo deps are out of scope');

  const drift = checkAlignment(manifest({ 'expo-router': '~57.0.20' }), { 'expo-router': '~57.1.0' });
  expect(drift.status === 'fail' && drift.findings.length === 1 && drift.findings[0].kind === 'mismatch', 'stale pin fails');
  expect(drift.findings[0].reason.includes('~57.1.0'), 'the failure names the bundled range');

  // A narrower-but-still-accepting pin is NOT drift: that is the normal shape of
  // a `~x.y.z` pin that the SDK has already patch-bumped past.
  const notDrift = checkAlignment(manifest({ 'expo-router': '~57.0.20' }), { 'expo-router': '~57.0.22' });
  expect(notDrift.status === 'pass', 'a same-minor bundled patch bump is not drift');

  const wrongMajor = checkAlignment(manifest({ 'expo-router': '^56.0.0' }), { 'expo-router': '~57.0.22' });
  expect(wrongMajor.status === 'fail', 'wrong-major pin fails');

  // Fail-closed paths.
  expect(checkAlignment(null, {}).status === 'blocked', 'missing manifest blocks');
  expect(checkAlignment({ dependencies: [] }, {}).status === 'blocked', 'non-object dependencies block');
  expect(checkAlignment(manifest({ 'expo-router': '~57.0.22' }), null).status === 'blocked', 'missing bundled manifest blocks');
  expect(checkAlignment(manifest({ 'expo-router': 'latest@' }), { 'expo-router': '~57.0.22' }).status === 'blocked', 'unparseable declared range blocks');
  expect(checkAlignment(manifest({ 'expo-router': '~57.0.22' }), { 'expo-router': 'workspace:*' }).status === 'blocked', 'unparseable bundled range blocks');
  const blockedReason = checkAlignment(manifest({ 'expo-router': 'workspace:*' }), { 'expo-router': '~57.0.22' });
  expect(blockedReason.status === 'blocked' && /cannot evaluate/.test(blockedReason.reason), 'blocked reason is explicit');

  // The detector must actually detect: a self-test whose detector cannot see
  // the injected fault is a false green, so assert the fault is visible in the
  // finding itself (not just in the status).
  const injected = checkAlignment(manifest({ 'expo-file-system': '~56.0.1' }), { 'expo-file-system': '~57.0.7' });
  expect(injected.status === 'fail', 'injected drift is detected');
  expect(
    injected.findings.some((f) => f.name === 'expo-file-system' && f.declared === '~56.0.1' && f.required === '~57.0.7'),
    'the injected fault is named in the finding',
  );

  // The REAL repository state must be self-consistent with the shipped gate:
  // running the shipped fixtures through the shipped checker must not BLOCK.
  const { manifestFile, bundledFile } = resolvePaths([]);
  if (fs.existsSync(manifestFile) && fs.existsSync(bundledFile)) {
    const realPkg = readJsonFile(manifestFile, 'package manifest');
    const realBundled = readJsonFile(bundledFile, 'bundled native-module manifest');
    if (realPkg.ok && realBundled.ok) {
      const real = checkAlignment(realPkg.json, realBundled.json);
      expect(real.status !== 'blocked', `shipped manifests are evaluable (${real.reason || real.status})`);
      if (real.status === 'fail') {
        console.error(`  NOTE: shipped manifests report ${real.findings.length} misalignment(s):`);
        for (const f of real.findings) console.error(`    - ${f.name}: ${f.reason}`);
      }
    } else {
      expect(true, 'shipped manifests absent — skipped real-state assertion');
    }
  } else {
    expect(true, 'shipped manifests absent — skipped real-state assertion');
  }

  console.log(`Expo alignment self-test: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) process.exit(selfTest() ? 0 : 1);

const { manifestFile, bundledFile } = resolvePaths(args);
const pkg = readJsonFile(manifestFile, 'app package manifest');
if (!pkg.ok) {
  console.error(`Expo alignment BLOCKED: ${pkg.reason}`);
  process.exit(2);
}
const bundled = readJsonFile(bundledFile, 'bundled native-module manifest');
if (!bundled.ok) {
  console.error(`Expo alignment BLOCKED: ${bundled.reason}`);
  process.exit(2);
}
const result = checkAlignment(pkg.json, bundled.json);
if (result.status === 'blocked') {
  console.error(`Expo alignment BLOCKED: ${result.reason}`);
  process.exit(2);
}
if (result.status === 'fail') {
  console.error(`Expo alignment FAILED: ${result.findings.length} Expo-family pin(s) do not accept the installed SDK's required range`);
  for (const f of result.findings) {
    console.error(`  - ${f.name}: declared "${f.declared}" vs bundled "${f.required}" — ${f.reason}`);
  }
  console.error('  Fix by declaring a range that accepts the installed SDK bundled version (node_modules/expo/bundledNativeModules.json).');
  process.exit(1);
}
console.log(
  `Expo alignment PASS (${result.checked.length} Expo-family pin(s) accept the installed SDK bundled ranges; ` +
    `${result.skipped.length} not covered by the bundled manifest)`,
);
for (const c of result.checked) console.log(`  aligned: ${c.name} declared ${c.declared} ⊇ bundled ${c.required}`);
for (const s of result.skipped) console.log(`  not checked: ${s.name} (${s.reason})`);
