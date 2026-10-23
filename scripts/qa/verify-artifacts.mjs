#!/usr/bin/env node
/**
 * verify-artifacts.mjs — INDEPENDENT artifact-integrity verifier CLI
 * (Campaign 080, P1-C + F-080-NEW-001 + F-080-NEW-002).
 *
 * This file is deliberately THIN. All verification semantics, the build-scope
 * policy and — critically — the exit contract live in `artifact-integrity.mjs`,
 * which is a pure, unit-tested module. The CLI parses arguments, reads ledgers,
 * prints, and calls `process.exit(deriveVerificationExitCode(...))`. There is no
 * second, divergent verdict/exit expression anywhere (the historical defect was
 * exactly such a second expression).
 *
 * Why independent verification exists: the old contract "verified" an artifact
 * by comparing `expectedSha1` to `sha1` — two values copied out of the SAME
 * untrusted record — and `expectedSha1` was never written, so the check could
 * not fire. This verifier reads each artifact from disk, recomputes its digest
 * FROM THE REAL BYTES, and compares that to what the ledger recorded.
 *
 * Evidence modes
 * --------------
 *   --mode local     Local runtime certification. Mandatory artifacts must
 *                    exist and hash to their recorded digest. Missing or
 *                    unreadable mandatory evidence = BLOCKED (nonzero exit).
 *   --mode portable  Portable evidence verification (DEFAULT). Git-ignored
 *                    native evidence is legitimately absent from a fresh
 *                    checkout, so absence is NOT_VERIFIABLE — never a pass and
 *                    never a false failure. Everything checkable is checked.
 *   --mode source    Source-level fixture testing. Artifact presence is
 *                    advisory; structure, binding and digests of present
 *                    artifacts are still validated. A source-mode pass is NEVER
 *                    native certification and must not be cited as such.
 *
 * Build scope
 * -----------
 *   --build-scope single   (DEFAULT) Single-build certification. Every
 *                          certifying run must belong to ONE actual build, bound
 *                          by source SHA + APK SHA-256 + package identity +
 *                          versionName + versionCode. Mixed-build evidence FAILS.
 *   --build-scope archive  Multi-build archive verification. Runs are
 *                          partitioned by build identity and every partition is
 *                          verified; the result explicitly does NOT describe the
 *                          current application revision.
 *
 * Exit contract (authoritative definition: deriveVerificationExitCode)
 * ------------------------------------------------------------------
 *   0  PASS and nothing else. A strict request cannot loosen this.
 *   1  FAIL, BLOCKED, NOT_VERIFIABLE, NO_EVIDENCE, or any non-PASS verdict —
 *      with or without --strict. A verification tool never reports process
 *      success for an unverified mandatory certification requirement.
 *   2  usage error or malformed/unreadable input ledger.
 *
 * Usage:
 *   node scripts/qa/verify-artifacts.mjs <ledger.json> [more.json ...]
 *        [--mode local|portable|source] [--build-scope single|archive]
 *        [--capture-receipts INDEX] [--build-manifest FILE]
 *        [--expected-git-sha SHA] [--expected-apk-sha256 SHA256]
 *        [--strict] [--json OUT] [--verbose]
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isQuarantinedLedger } from './artifact-policy.mjs';
import {
  BUILD_SCOPES,
  EVIDENCE_MODES,
  EvidenceMode,
  BuildScope,
  VerificationVerdict,
  deriveVerificationExitCode,
  loadBuildManifest,
  verifyArtifactLedger,
} from './artifact-integrity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const USAGE = 'usage: verify-artifacts.mjs <ledger.json> [...] [--mode local|portable|source] [--build-scope single|archive] [--capture-receipts INDEX] [--build-manifest FILE] [--expected-git-sha SHA] [--expected-apk-sha256 SHA256] [--strict] [--json OUT] [--verbose]';

/** Print usage to stderr and exit 2 (usage/malformed-input class). */
function usageError(message) {
  if (message) console.error(`[verify-artifacts] ${message}`);
  console.error(USAGE);
  process.exit(2);
}

// --- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const inputs = [];
let mode = EvidenceMode.PORTABLE;
let buildScope = BuildScope.SINGLE;
let strict = false;
let jsonOut = null;
let captureReceipts = null;
let buildManifestFile = null;
let expectedGitSha;
let expectedApkSha256;
let verbose = false;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--mode') {
    mode = String(argv[++i] ?? '');
    if (!EVIDENCE_MODES.includes(mode)) usageError(`bad --mode '${mode}'`);
  } else if (a === '--build-scope') {
    buildScope = String(argv[++i] ?? '');
    if (!BUILD_SCOPES.includes(buildScope)) usageError(`bad --build-scope '${buildScope}'`);
  } else if (a === '--capture-receipts') {
    const index = argv[++i];
    if (!index || index.startsWith('-')) usageError('--capture-receipts requires a path');
    captureReceipts = path.resolve(index);
  } else if (a === '--build-manifest') {
    const file = argv[++i];
    if (!file || file.startsWith('-')) usageError('--build-manifest requires a path');
    buildManifestFile = path.resolve(file);
  } else if (a === '--expected-git-sha') {
    expectedGitSha = argv[++i];
    if (!expectedGitSha || expectedGitSha.startsWith('-')) usageError('--expected-git-sha requires a SHA');
  } else if (a === '--expected-apk-sha256') {
    expectedApkSha256 = argv[++i];
    if (!expectedApkSha256 || expectedApkSha256.startsWith('-')) usageError('--expected-apk-sha256 requires a SHA-256');
  } else if (a === '--strict') strict = true;
  else if (a === '--verbose') verbose = true;
  else if (a === '--json') {
    const out = argv[++i];
    if (!out) usageError('--json requires a path');
    jsonOut = path.resolve(out);
  } else if (a === '-h' || a === '--help') {
    console.log(USAGE);
    process.exit(0);
  } else if (a.startsWith('-')) usageError(`unknown option '${a}'`);
  else inputs.push(path.resolve(a));
}
if (inputs.length === 0) usageError('no ledger supplied');

// --- load ------------------------------------------------------------------
const runs = [];
for (const file of inputs) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`[verify-artifacts] unreadable input ${file}: ${e.message}`);
    process.exit(2);
  }
  // A ledger is either a bare run array or `{ runs: [...] }`. Anything else is
  // malformed input (exit 2) rather than a verdict — the verifier must not
  // invent an empty-but-successful evidence set out of a wrong document shape.
  let list = null;
  if (Array.isArray(doc)) list = doc;
  else if (doc !== null && typeof doc === 'object' && Array.isArray(doc.runs)) list = doc.runs;
  if (!list) {
    console.error(`[verify-artifacts] malformed ledger ${file}: expected { runs: [...] }`);
    process.exit(2);
  }
  const quarantinedLedger = isQuarantinedLedger(file, doc);
  for (const r of list) {
    // Keep malformed entries intact for explicit rejection by run-shape policy;
    // never filter null/primitive entries into a partial successful ledger.
    runs.push(quarantinedLedger && r && typeof r === 'object' && !Array.isArray(r)
      ? { ...r, _quarantined: true }
      : r);
  }
}

// --- verify ----------------------------------------------------------------
let result;
try {
  if (buildManifestFile) {
    const manifest = loadBuildManifest(buildManifestFile, REPO_ROOT);
    if ((expectedGitSha && expectedGitSha.toLowerCase() !== manifest.sourceSha)
        || (expectedApkSha256 && expectedApkSha256.toLowerCase() !== manifest.apkSha256)) {
      usageError('explicit expected identity conflicts with --build-manifest');
    }
    expectedGitSha = manifest.sourceSha;
    expectedApkSha256 = manifest.apkSha256;
  }
  result = verifyArtifactLedger(runs, {
    mode, strict, buildScope, repoRoot: REPO_ROOT,
    captureReceipts, expectedGitSha, expectedApkSha256,
  });
} catch (e) {
  console.error(`[verify-artifacts] verifier error: ${e.message}`);
  process.exit(2);
}

if (jsonOut) {
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2));
}

const c = result.counters;
console.log(`[verify-artifacts] mode=${mode} buildScope=${buildScope} strict=${strict} runs=${result.runsInspected} builds=${result.buildsInspected}`);
console.log(`[verify-artifacts] verdict=${result.verdict} exit=${result.exitCode}`);
console.log(`[verify-artifacts] verified=${c.verified} verifiedLegacySha1=${c.verifiedLegacy} mismatch=${c.mismatch} missing=${c.missing} unreadable=${c.unreadable} wrongAttempt=${c.wrongAttempt} wrongBuild=${c.wrongBuild} unbound=${c.unbound} unsafePath=${c.unsafePath} reused=${c.reusedEvidence} duplicateAttempt=${c.duplicateAttempt} badContent=${c.badContent} capabilityUnbound=${c.capabilityUnbound} mixedBuild=${c.mixedBuild} invalidRun=${c.invalidRun} quarantinedRun=${c.quarantinedRun} noMeaningfulArtifact=${c.noMeaningfulArtifact} captureReceiptInvalid=${c.captureReceiptInvalid} captureReceiptUnindexed=${c.captureReceiptUnindexed} currentIdentityMissing=${c.currentIdentityMissing}`);
console.log(`[verify-artifacts] scope: ${result.scope}`);
console.log(`[verify-artifacts] certifiesNativeEvidence=${result.certifiesNativeEvidence} — ${result.note}`);
console.log(`[verify-artifacts] capture receipt trust boundary: ${result.captureReceiptTrustBoundary}`);

const shown = result.findings.filter((f) => f.kind !== 'artifact-legacy-digest');
const limit = verbose ? shown.length : 25;
for (const f of shown.slice(0, limit)) console.log(`  - ${f.kind}: ${f.detail}`);
if (shown.length > limit) console.log(`  ... ${shown.length - limit} more (use --verbose)`);
if (c.verifiedLegacy) {
  console.log(`  note: ${c.verifiedLegacy} artifact(s) verified against legacy SHA-1 digests (pre SHA-256 policy) — real evidence, graded lower`);
}

// Strict mode is a *statement of intent*, not the only failing path: the exit
// code is derived by the single authoritative function and is nonzero for every
// verdict except a genuine PASS.
if (strict && result.verdict !== VerificationVerdict.PASS) {
  console.error(`[verify-artifacts] strict certification requested — '${result.verdict}' is not certification success`);
}

process.exit(deriveVerificationExitCode(result.verdict, { mode, strict, buildScope }));
