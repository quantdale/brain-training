#!/usr/bin/env node
/**
 * Production dependency-audit gate (Campaign 027, spec `tooling-ci` R2).
 *
 * Runs `npm audit --json --omit=dev` in the mobile app package and fails
 * (exit 1) on any advisory affecting a production-tree dependency at
 * moderate+ severity that is not explicitly accepted in the reviewed
 * allowlist (scripts/certification/dependency-audit-allowlist.json).
 *
 * Why an allowlist at all: the `--omit=dev` tree still contains Expo's
 * Node-side CLI/prebuild/Metro toolchain (it hangs off the `expo` runtime
 * package), so tree membership alone cannot distinguish "ships in the app
 * bundle" from "executes on developer/CI machines only". Every accepted
 * entry names one package + one advisory id and carries a rationale and a
 * classification; a NEW advisory on the same package does NOT inherit the
 * acceptance and still fails.
 *
 * Fail-closed contract (never a silent pass):
 *   - exit 0  PASS    — no unallowlisted moderate+ production advisories
 *   - exit 1  FAIL    — at least one unallowlisted moderate+ advisory
 *   - exit 2  BLOCKED — audit or allowlist cannot be read/parsed, or an
 *                       advisories' dependency chain cannot be resolved
 *
 * `--self-test` exercises the classifier offline with synthetic audit JSON
 * (no network). `--offline` skips the network but still classifies BLOCKED.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PACKAGE_DIR = path.join(ROOT, 'apps', 'mobile');
const DEFAULT_ALLOWLIST = path.join(ROOT, 'scripts', 'certification', 'dependency-audit-allowlist.json');
const MODERATE_PLUS = new Set(['moderate', 'high', 'critical']);

/** Extract a GHSA id from either an allowlist entry or an advisory URL. */
export function advisoryId(value) {
  const m = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i.exec(String(value ?? ''));
  return m ? m[0].toLowerCase() : null;
}

/**
 * Classifications the allowlist policy recognizes (campaign 028). Any other
 * string is a schema error: an unclassified waiver is exactly the silent
 * acceptance the reviewed-allowlist policy exists to prevent.
 */
export const KNOWN_CLASSIFICATIONS = new Set([
  'build-dev-toolchain',
  'runtime-accepted-debt',
]);

function parseIsoDate(value) {
  if (typeof value !== 'string' || !value.trim()) return NaN;
  return Date.parse(value);
}

/**
 * True when a `runtime-accepted-debt` entry's acceptance has expired (or its
 * expiry is unparseable/absent — the schema gate rejects those separately).
 * Expired acceptance never matches an advisory: the entry must be renewed or
 * the advisory fixed. `nowMs` is injectable so self-tests are deterministic.
 */
export function isExpiredAcceptance(entry, nowMs = Date.now()) {
  if (!entry || entry.classification !== 'runtime-accepted-debt') return false;
  const expiry = parseIsoDate(entry.expires);
  return !Number.isFinite(expiry) || expiry <= nowMs;
}

/**
 * Parse raw `npm audit --json` stdout. Malformed, empty, error-only, or
 * vulnerabilities-missing payloads are BLOCKED by the caller, never PASS.
 */
export function parseAuditJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, reason: 'npm audit produced no output' };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: `npm audit output is not JSON (${err.message})` };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'npm audit output is not an object' };
  }
  if (data.error) {
    return { ok: false, reason: `npm audit error: ${data.error.code || data.error.summary || 'unknown'}` };
  }
  if (!data.vulnerabilities || typeof data.vulnerabilities !== 'object' || Array.isArray(data.vulnerabilities)) {
    return { ok: false, reason: 'audit JSON has no "vulnerabilities" map (malformed or unsupported npm audit version)' };
  }
  return { ok: true, audit: data };
}

/** Parse and schema-check the reviewed allowlist. Returns `{ok, entries|reason}`. */
export function parseAllowlist(raw) {
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (err) {
      return { ok: false, reason: `allowlist is not valid JSON (${err.message})` };
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.allowlist)) {
    return { ok: false, reason: 'allowlist must be an object with an "allowlist" array' };
  }
  if (!Number.isInteger(data.version) || data.version < 1) {
    return { ok: false, reason: 'allowlist is missing a positive integer "version"' };
  }
  if (!Number.isFinite(parseIsoDate(data.reviewedAt))) {
    return { ok: false, reason: 'allowlist is missing a valid ISO "reviewedAt" date' };
  }
  for (const [i, entry] of data.allowlist.entries()) {
    const label = `allowlist[${i}] ("${entry && typeof entry.package === 'string' ? entry.package : '?'}")`;
    if (!entry || typeof entry.package !== 'string' || !entry.package.trim()) {
      return { ok: false, reason: `allowlist[${i}] is missing a non-empty "package"` };
    }
    if (typeof entry.advisory !== 'string' || !advisoryId(entry.advisory)) {
      return { ok: false, reason: `${label} is missing a "GHSA-..." advisory id` };
    }
    if (typeof entry.classification !== 'string' || !entry.classification.trim()) {
      return { ok: false, reason: `${label} is missing a "classification"` };
    }
    if (!KNOWN_CLASSIFICATIONS.has(entry.classification)) {
      return {
        ok: false,
        reason: `${label} has unknown classification "${entry.classification}" (expected one of: ${[...KNOWN_CLASSIFICATIONS].join(', ')})`,
      };
    }
    if (typeof entry.rationale !== 'string' || !entry.rationale.trim()) {
      return { ok: false, reason: `${label} is missing a non-empty "rationale"` };
    }
    if (entry.expires !== undefined && !Number.isFinite(parseIsoDate(entry.expires))) {
      return { ok: false, reason: `${label} has an unparseable "expires" value` };
    }
    if (entry.classification === 'runtime-accepted-debt') {
      if (typeof entry.expires !== 'string' || !entry.expires.trim()) {
        return { ok: false, reason: `${label} is runtime-accepted-debt but has no "expires" date` };
      }
      if (typeof entry.tracking !== 'string' || !entry.tracking.trim()) {
        return { ok: false, reason: `${label} is runtime-accepted-debt but has no "tracking" follow-up reference` };
      }
    }
  }
  return { ok: true, entries: data.allowlist };
}

/**
 * Classify a parsed audit against the allowlist. Advisories are resolved
 * through `via` chain strings so a transitive dependent (e.g. `metro` via
 * `image-size`) is accepted only when the root advisory it resolves to is
 * itself allowlisted. A `runtime-accepted-debt` match whose expiry has passed
 * is a VIOLATION, never an acceptance (campaign 028). Returns
 * `{status: 'pass'|'fail'|'blocked', ...}`.
 */
export function classifyAudit(audit, entries, options = {}) {
  const nowMs = options.now ?? Date.now();
  if (!audit || typeof audit !== 'object' || !audit.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
    return { status: 'blocked', reason: 'audit payload is missing the vulnerabilities map', accepted: [], violations: [] };
  }
  const vulnerabilities = audit.vulnerabilities;
  // Reachability is a fixed point over the `via` graph, not per-path DFS:
  // npm reports real cycles (`metro` -> `metro-config` -> `metro`), so a
  // path-scoped traversal both truncates siblings and poisons memoized
  // results. Sets only grow toward a finite union, so this terminates.
  const advisoryKey = (a) => `${a.package}@${a.id}`;
  const reachable = new Map();
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    reachable.set(
      name,
      (Array.isArray(vuln?.via) ? vuln.via : [])
        .filter((via) => via && typeof via === 'object')
        .map((via) => ({
          package: via.name || name,
          id: advisoryId(via.url),
          severity: via.severity || vuln.severity,
          title: via.title || '',
        })),
    );
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const [name, vuln] of Object.entries(vulnerabilities)) {
      const set = reachable.get(name);
      for (const via of Array.isArray(vuln?.via) ? vuln.via : []) {
        if (typeof via !== 'string' || !reachable.has(via)) continue;
        for (const adv of reachable.get(via)) {
          if (!set.some((x) => advisoryKey(x) === advisoryKey(adv))) {
            set.push(adv);
            changed = true;
          }
        }
      }
    }
  }

  const accepted = [];
  const violations = [];
  const unresolved = [];
  const seenAdvisory = new Set();
  const seenViolation = new Set();
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    if (!vuln || !MODERATE_PLUS.has(vuln.severity)) continue;
    const advisories = reachable.get(name) || [];
    if (advisories.length === 0) {
      unresolved.push(`${name} (${vuln.severity})`);
      continue;
    }
    for (const adv of advisories) {
      if (!MODERATE_PLUS.has(adv.severity)) continue; // below the gate threshold
      if (!adv.id) {
        unresolved.push(`${name} -> ${adv.package} (advisory has no GHSA id)`);
        continue;
      }
      const key = `${adv.package}@${adv.id}`;
      const match = entries.find(
        (entry) => entry.package === adv.package && advisoryId(entry.advisory) === adv.id,
      );
      if (match && isExpiredAcceptance(match, nowMs)) {
        // The waiver itself has expired: the advisory is effectively
        // unallowlisted. Fail closed and name the expired acceptance.
        if (!seenViolation.has(key)) {
          seenViolation.add(key);
          violations.push({
            ...adv,
            viaPackage: name,
            expiredAcceptance: true,
            tracking: typeof match.tracking === 'string' ? match.tracking : null,
          });
        }
      } else if (match) {
        if (!seenAdvisory.has(key)) {
          seenAdvisory.add(key);
          accepted.push({ ...adv, rationale: match.rationale, classification: match.classification });
        }
      } else if (!seenViolation.has(key)) {
        seenViolation.add(key);
        violations.push({ ...adv, viaPackage: name });
      }
    }
  }
  if (unresolved.length) {
    return {
      status: 'blocked',
      reason: `cannot resolve advisory metadata for: ${unresolved.join(', ')}`,
      accepted,
      violations: [],
    };
  }
  return { status: violations.length ? 'fail' : 'pass', accepted, violations, reason: null };
}

/** Run the real network audit. Never throws; failures are BLOCKED data. */
export function runNpmAudit(packageDir) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['audit', '--json', '--omit=dev'], {
    cwd: packageDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180000,
    shell: process.platform === 'win32',
  });
  if (result.error) {
    return { ok: false, reason: `could not run npm audit: ${result.error.message}` };
  }
  const parsed = parseAuditJson(result.stdout || '');
  if (!parsed.ok) {
    const stderr = (result.stderr || '').trim().split(/\r?\n/).slice(-3).join(' ');
    return { ok: false, reason: `${parsed.reason}${stderr ? ` (stderr: ${stderr})` : ''}` };
  }
  return parsed;
}

export function statusToExit(status) {
  if (status === 'pass') return 0;
  if (status === 'fail') return 1;
  return 2; // blocked
}

function loadAllowlist(file) {
  if (!fs.existsSync(file)) return { ok: false, reason: `allowlist not found at ${path.relative(ROOT, file)}` };
  return parseAllowlist(fs.readFileSync(file, 'utf8'));
}

// ——— Self-test: classifier semantics on synthetic audits (no network)
function selfTest() {
  let pass = 0;
  let fail = 0;
  const expect = (cond, name) => {
    if (cond) { pass++; } else { fail++; console.error(`SELF-TEST FAIL: ${name}`); }
  };
  const adv = (id, name, severity, title = 'synthetic advisory') => ({
    source: 1, name, dependency: name, title, severity,
    url: `https://github.com/advisories/${id}`, range: '<=0.0.0',
  });
  const auditOf = (vulnerabilities) => ({ auditReportVersion: 2, vulnerabilities, metadata: {} });
  const DEV = 'GHSA-aaaa-bbbb-cccc';
  const NEW = 'GHSA-zzzz-yyyy-xxxx';
  const devEntry = { package: 'devpkg', advisory: DEV, classification: 'build-dev-toolchain', rationale: 'fixture dev toolchain' };
  const allow = [devEntry];

  // Production advisory => FAIL.
  const prod = classifyAudit(auditOf({
    prodpkg: { severity: 'moderate', via: [adv('GHSA-dddd-eeee-ffff', 'prodpkg', 'moderate')] },
  }), allow);
  expect(prod.status === 'fail' && prod.violations.length === 1, 'production advisory fails');
  expect(statusToExit(prod.status) === 1, 'production advisory exit 1');

  // Allowlisted dev advisory => PASS, with the acceptance recorded.
  const dev = classifyAudit(auditOf({
    devpkg: { severity: 'moderate', via: [adv(DEV, 'devpkg', 'moderate')] },
  }), allow);
  expect(dev.status === 'pass' && dev.accepted.length === 1, 'allowlisted dev advisory passes');
  expect(dev.accepted[0].rationale === 'fixture dev toolchain', 'acceptance carries rationale');
  expect(statusToExit(dev.status) === 0, 'pass exit 0');

  // Transitive via chain resolves to the allowlisted root advisory.
  const chain = classifyAudit(auditOf({
    rootpkg: { severity: 'high', via: [adv(DEV, 'rootpkg', 'high')] },
    childpkg: { severity: 'high', via: ['rootpkg'] },
  }), [{ ...devEntry, package: 'rootpkg' }]);
  expect(chain.status === 'pass' && chain.accepted.length === 1, 'allowlisted root covers its via-chain dependents');

  // Precision: a NEW advisory on an allowlisted package still fails.
  const newAdv = classifyAudit(auditOf({
    devpkg: { severity: 'moderate', via: [adv(NEW, 'devpkg', 'moderate')] },
  }), allow);
  expect(newAdv.status === 'fail' && newAdv.violations.length === 1, 'new advisory on allowlisted package still fails');

  // One unallowlisted advisory in a mixed via list still fails the package.
  const mixed = classifyAudit(auditOf({
    devpkg: { severity: 'high', via: [adv(DEV, 'devpkg', 'moderate'), adv(NEW, 'devpkg', 'high')] },
  }), allow);
  expect(mixed.status === 'fail' && mixed.violations.length === 1, 'partially allowlisted via list fails');

  // Below-threshold severities pass without an allowlist entry.
  const low = classifyAudit(auditOf({
    lowpkg: { severity: 'low', via: [adv('GHSA-1111-2222-3333', 'lowpkg', 'low')] },
  }), []);
  expect(low.status === 'pass' && low.violations.length === 0, 'low severity is below the gate threshold');

  // Malformed / absent / error audits are BLOCKED, never silently passed.
  expect(parseAuditJson('').ok === false, 'empty audit output blocked');
  expect(parseAuditJson('npm ERR! network').ok === false, 'non-JSON audit output blocked');
  expect(parseAuditJson('null').ok === false, 'null audit JSON blocked');
  expect(parseAuditJson(JSON.stringify({ error: { code: 'ENETUNREACH' } })).ok === false, 'audit error payload blocked');
  expect(parseAuditJson(JSON.stringify({ auditReportVersion: 2 })).ok === false, 'missing vulnerabilities map blocked');
  expect(classifyAudit({ metadata: {} }, allow).status === 'blocked', 'classifier blocks absent vulnerabilities');
  expect(classifyAudit(null, allow).status === 'blocked', 'classifier blocks null audit');
  expect(statusToExit('blocked') === 2, 'blocked exit 2');
  const unresolvedChain = classifyAudit(auditOf({
    brokenpkg: { severity: 'high', via: ['ghostpkg'] },
  }), allow);
  expect(unresolvedChain.status === 'blocked', 'unresolvable via chain blocks');

  // Allowlist schema: version + reviewedAt at the top level; every entry needs
  // package + GHSA + a KNOWN classification + rationale; runtime-accepted-debt
  // additionally requires a future expiry and a tracking follow-up.
  const allowDoc = (entries) => JSON.stringify({ version: 1, reviewedAt: '2026-09-13', allowlist: entries });
  const debtEntry = (over = {}) => ({
    package: 'debtpkg',
    advisory: 'GHSA-dddd-dddd-dddd',
    classification: 'runtime-accepted-debt',
    rationale: 'accepted debt fixture',
    expires: '2026-12-31T00:00:00.000Z',
    tracking: '.agent/KNOWN_ISSUES.md',
    ...over,
  });
  expect(parseAllowlist('not json').ok === false, 'malformed allowlist blocked');
  expect(parseAllowlist('{}').ok === false, 'allowlist without array blocked');
  expect(parseAllowlist(allowDoc([{ package: 'x', advisory: DEV, classification: 'build-dev-toolchain' }])).ok === false, 'missing rationale blocked');
  expect(parseAllowlist(allowDoc([{ package: 'x', advisory: DEV, rationale: 'r' }])).ok === false, 'missing classification blocked');
  expect(parseAllowlist(allowDoc([{ package: 'x', advisory: 'not-a-ghsa', classification: 'build-dev-toolchain', rationale: 'r' }])).ok === false, 'non-GHSA advisory id blocked');
  expect(parseAllowlist(JSON.stringify({ reviewedAt: '2026-09-13', allowlist: [devEntry] })).ok === false, 'missing version blocked');
  expect(parseAllowlist(JSON.stringify({ version: 1, allowlist: [devEntry] })).ok === false, 'missing reviewedAt blocked');
  expect(parseAllowlist(JSON.stringify({ version: 1, reviewedAt: 'not-a-date', allowlist: [devEntry] })).ok === false, 'unparseable reviewedAt blocked');
  expect(parseAllowlist(allowDoc([{ ...devEntry, classification: 'whatever-i-say' }])).ok === false, 'unknown classification blocked');
  expect(parseAllowlist(allowDoc([debtEntry({ expires: undefined })])).ok === false, 'accepted debt without expiry blocked');
  expect(parseAllowlist(allowDoc([debtEntry({ tracking: undefined })])).ok === false, 'accepted debt without tracking blocked');
  expect(parseAllowlist(allowDoc([debtEntry({ expires: 'soon' })])).ok === false, 'unparseable expiry blocked');
  expect(parseAllowlist(allowDoc([devEntry])).ok === true, 'well-formed allowlist ok');
  expect(parseAllowlist(allowDoc([debtEntry()])).ok === true, 'well-formed accepted-debt allowlist ok');

  // Expiry semantics: an unexpired waiver accepts; an expired waiver is a
  // violation (never an acceptance), so the gate fails closed after expiry.
  const debtAdv = auditOf({
    debtpkg: { severity: 'moderate', via: [adv('GHSA-dddd-dddd-dddd', 'debtpkg', 'moderate')] },
  });
  const beforeExpiry = classifyAudit(debtAdv, [debtEntry()], { now: Date.parse('2026-12-30T00:00:00.000Z') });
  expect(beforeExpiry.status === 'pass' && beforeExpiry.accepted.length === 1, 'unexpired accepted debt passes');
  const afterExpiry = classifyAudit(debtAdv, [debtEntry()], { now: Date.parse('2027-01-01T00:00:00.000Z') });
  expect(afterExpiry.status === 'fail' && afterExpiry.violations.length === 1, 'expired accepted debt fails');
  expect(afterExpiry.violations[0].expiredAcceptance === true, 'expired violation is flagged as expired acceptance');
  expect(afterExpiry.violations[0].tracking === '.agent/KNOWN_ISSUES.md', 'expired violation carries the tracking reference');
  expect(isExpiredAcceptance(debtEntry(), Date.parse('2026-12-31T00:00:01.000Z')) === true, 'isExpiredAcceptance at instant');
  expect(isExpiredAcceptance(debtEntry(), Date.parse('2026-12-30T00:00:00.000Z')) === false, 'isExpiredAcceptance before expiry');
  expect(isExpiredAcceptance(devEntry) === false, 'dev-toolchain entries have no expiry semantics');

  // The shipped allowlist itself must always be schema-valid.
  const shipped = loadAllowlist(DEFAULT_ALLOWLIST);
  expect(shipped.ok, `shipped allowlist parses (${shipped.reason || 'ok'})`);
  if (shipped.ok) {
    const ids = new Set(shipped.entries.map((e) => `${e.package}@${advisoryId(e.advisory)}`));
    expect(ids.size === shipped.entries.length, 'shipped allowlist has no duplicate entries');
  }

  console.log(`Dependency audit self-test: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

function printAccepted(accepted) {
  for (const a of accepted) {
    console.log(`  accepted: ${a.package} ${a.id} (${a.severity}, ${a.classification}) — ${a.rationale}`);
  }
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
}

const dirArg = args.find((a) => a.startsWith('--package-dir='));
const packageDir = dirArg ? path.resolve(ROOT, dirArg.split('=')[1]) : DEFAULT_PACKAGE_DIR;
const allowlistFile = DEFAULT_ALLOWLIST;

if (args.includes('--offline')) {
  console.error('Dependency audit BLOCKED: --offline requested; npm audit was not run (never a silent pass)');
  process.exit(2);
}
if (!fs.existsSync(path.join(packageDir, 'package.json')) || !fs.existsSync(path.join(packageDir, 'package-lock.json'))) {
  console.error(`Dependency audit BLOCKED: no package.json/package-lock.json under ${path.relative(ROOT, packageDir)}`);
  process.exit(2);
}
const allowlist = loadAllowlist(allowlistFile);
if (!allowlist.ok) {
  console.error(`Dependency audit BLOCKED: ${allowlist.reason}`);
  process.exit(2);
}
const audit = runNpmAudit(packageDir);
if (!audit.ok) {
  console.error(`Dependency audit BLOCKED: ${audit.reason}`);
  process.exit(2);
}
const result = classifyAudit(audit.audit, allowlist.entries);
if (result.status === 'blocked') {
  console.error(`Dependency audit BLOCKED: ${result.reason}`);
  process.exit(2);
}
if (result.status === 'fail') {
  console.error(`Dependency audit FAILED: ${result.violations.length} unallowlisted moderate+ production advisories`);
  for (const v of result.violations) {
    if (v.expiredAcceptance) {
      console.error(
        `  - ${v.package} ${v.id} (${v.severity}) via ${v.viaPackage}: acceptance EXPIRED${v.tracking ? ` (tracking: ${v.tracking})` : ''}`,
      );
    } else {
      console.error(`  - ${v.package} ${v.id} (${v.severity}) via ${v.viaPackage}: ${v.title}`);
    }
  }
  const expired = result.violations.filter((v) => v.expiredAcceptance).length;
  if (expired > 0) {
    console.error(
      `  ${expired} waiver(s) expired: fix the advisory or renew the allowlist entry (expires + tracking) after review.`,
    );
  }
  console.error('  If an advisory is genuinely build/dev-toolchain-only, add it to scripts/certification/dependency-audit-allowlist.json with a rationale.');
  process.exit(1);
}
console.log(`Dependency audit PASS (${result.accepted.length} accepted advisories, no unallowlisted moderate+ production findings)`);
printAccepted(result.accepted);
