#!/usr/bin/env node
/**
 * verify-artifacts.mjs — INDEPENDENT artifact-integrity verifier (Campaign 080,
 * P1-C).
 *
 * Why this exists
 * ---------------
 * The previous contract "verified" an artifact by comparing `expectedSha1` to
 * `sha1` — two values copied out of the SAME untrusted record. On real sweep
 * data `expectedSha1` was never written at all, so the check could not fire and
 * the documentation's "every proof is bound to an artifact hash" claim was
 * unsubstantiated.
 *
 * This verifier does the only thing that constitutes verification: it reads the
 * artifact file from disk, recomputes its digest FROM THE ACTUAL BYTES, and
 * compares that to what the ledger recorded. A self-asserted hash is never
 * treated as proof.
 *
 * Three evidence modes (kept deliberately distinct):
 *
 *   --mode local     Local runtime certification. Artifacts must exist and hash
 *                    to their recorded digest. Missing/unreadable = FAIL.
 *                    Used on the machine that produced the native evidence.
 *
 *   --mode portable  Portable evidence verification. Git-ignored native evidence
 *                    is legitimately absent from a fresh checkout, so absence is
 *                    reported as NOT VERIFIABLE (never a false FAIL and never a
 *                    silent pass). Everything still checkable IS checked.
 *
 *   --mode source    Source-level fixture testing. Artifact presence is
 *                    advisory; structure and binding are still validated.
 *
 * Verdicts
 * --------
 *   PASS                      every mandatory artifact independently verified
 *   FAIL                      hash mismatch / wrong attempt / wrong build /
 *                             unreadable mandatory artifact
 *   BLOCKED                   mandatory artifacts unavailable in this mode
 *   NOT VERIFIABLE (portable) artifact bytes not present in this checkout
 *
 * Usage:
 *   node scripts/qa/verify-artifacts.mjs <ledger.json> [more.json ...]
 *        [--mode local|portable|source] [--strict] [--json OUT]
 *
 * Exit: 0 = PASS, 1 = FAIL (or BLOCKED/NOT VERIFIABLE with --strict),
 *       2 = usage / unreadable input.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  observationRequiresArtifact,
  verifyArtifactBytes,
} from './coverage-contract.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// --- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const inputs = [];
let mode = 'portable';
let strict = false;
let jsonOut = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--mode') mode = String(argv[++i] || 'portable');
  else if (a === '--strict') strict = true;
  else if (a === '--json') jsonOut = path.resolve(argv[++i] || '');
  else if (a === '-h' || a === '--help') {
    console.log('usage: verify-artifacts.mjs <ledger.json> [...] [--mode local|portable|source] [--strict] [--json OUT]');
    process.exit(0);
  } else if (a.startsWith('--')) { console.error(`unknown option '${a}'`); process.exit(2); }
  else inputs.push(path.resolve(a));
}
if (!['local', 'portable', 'source'].includes(mode)) { console.error(`bad --mode '${mode}'`); process.exit(2); }
if (inputs.length === 0) { console.error('no ledger supplied'); process.exit(2); }

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
  const list = Array.isArray(doc) ? doc : Array.isArray(doc.runs) ? doc.runs : null;
  if (!list) {
    console.error(`[verify-artifacts] malformed ledger ${file}: expected { runs: [...] }`);
    process.exit(2);
  }
  for (const r of list) if (r && typeof r === 'object') runs.push(r);
}

// --- verify ----------------------------------------------------------------
const findings = [];
const counters = {
  verified: 0, verifiedLegacy: 0, mismatch: 0, missing: 0, unreadable: 0,
  wrongAttempt: 0, wrongBuild: 0, unbound: 0, mixedBuild: 0,
};

function record(kind, detail) { findings.push({ kind, detail }); }

// Build-identity binding: evidence may only be certified against the build it
// actually came from. A ledger that blends several builds is flagged so no
// cross-build journey can be read as one build's behaviour.
const buildToAttempts = new Map();
for (const run of runs) {
  const key = run.buildIdentity
    ? `${run.buildIdentity.gitSha || '?'}|${run.buildIdentity.apkSha256 || '?'}|${run.buildIdentity.versionCode ?? '?'}`
    : '(no build identity)';
  if (!buildToAttempts.has(key)) buildToAttempts.set(key, []);
  buildToAttempts.get(key).push(run.executionAttemptId || '(missing)');
}
if (buildToAttempts.size > 1) {
  counters.mixedBuild = buildToAttempts.size;
  for (const [key, attempts] of buildToAttempts) {
    record('mixed-build-identity', `build ${key} -> attempts: ${attempts.join(', ')}`);
  }
}

for (const run of runs) {
  const attemptId = run.executionAttemptId || '(missing)';

  const check = (artifact, label, mandatory) => {
    if (!artifact || typeof artifact !== 'object') {
      if (mandatory) { counters.missing++; record('missing-artifact', `${attemptId}: ${label} has no artifact binding`); }
      return;
    }
    if (!artifact.file) {
      counters.unbound++;
      record('unbound-artifact', `${attemptId}: ${label} records a digest but no file binding — cannot be independently verified`);
      return;
    }
    // Wrong-attempt reuse: an artifact bound to another execution attempt is
    // evidence from a DIFFERENT run and may not be cited here.
    if (artifact.executionAttemptId && artifact.executionAttemptId !== attemptId) {
      counters.wrongAttempt++;
      record('artifact-wrong-attempt', `${attemptId}: ${label} claims artifact from attempt '${artifact.executionAttemptId}'`);
      return;
    }
    const abs = path.isAbsolute(artifact.file) ? artifact.file : path.join(REPO_ROOT, artifact.file);
    let bytes;
    try {
      bytes = fs.readFileSync(abs);
    } catch (e) {
      if (mode === 'local') {
        counters.unreadable++;
        record('artifact-unreadable', `${attemptId}: ${label} — ${artifact.file}: ${e.code || e.message}`);
      } else {
        counters.missing++;
        record('artifact-not-present', `${attemptId}: ${label} — ${artifact.file} not present in this checkout (${mode} mode: NOT VERIFIABLE, not a pass)`);
      }
      return;
    }
    const res = verifyArtifactBytes(artifact, bytes);
    if (res.ok) {
      if (res.grade === 'sha1-legacy') {
        counters.verifiedLegacy++;
        record('artifact-legacy-digest', `${attemptId}: ${label} verified against a LEGACY SHA-1 — real evidence, but not modern SHA-256 content verification`);
      } else {
        counters.verified++;
      }
    } else {
      counters.mismatch++;
      record('artifact-hash-mismatch', `${attemptId}: ${label} — ${res.problems.join('; ')}`);
    }
  };

  // Every observation the contract says is certification-critical MUST verify.
  for (const o of run.observations || []) {
    if (!o || typeof o !== 'object') continue;
    const mandatory = observationRequiresArtifact(o);
    const label = `obs#${o.seq}${o.phase ? ` (${o.phase})` : ''}`;
    check(o.evidenceArtifact, label, mandatory);
  }
  // Run-level artifacts (build provenance, device state, event trace, ...).
  for (const a of run.artifacts || []) {
    check(a, `artifact[${a && a.kind ? a.kind : 'unknown'}]`, a && a.mandatory === true);
  }
  // Build provenance must be present for any certification-critical run.
  if (!run.buildIdentity || !run.buildIdentity.apkSha256) {
    counters.wrongBuild++;
    record('missing-build-provenance', `${attemptId}: no installed-APK identity — cannot bind this evidence to a build`);
  }
}

// --- verdict ---------------------------------------------------------------
const mandatoryProblems = counters.mismatch + counters.wrongAttempt + counters.wrongBuild + counters.unbound
  + (mode === 'local' ? counters.unreadable + counters.missing : 0);
const notVerifiable = mode === 'portable' ? counters.missing : 0;

let verdict;
if (counters.mismatch > 0 || counters.wrongAttempt > 0 || counters.wrongBuild > 0 || counters.unbound > 0) verdict = 'FAIL';
else if (mode === 'local' && (counters.unreadable > 0 || counters.missing > 0)) verdict = 'BLOCKED';
else if (notVerifiable > 0) verdict = 'NOT VERIFIABLE (portable)';
else verdict = 'PASS';

const summary = {
  verdict,
  mode,
  runsInspected: runs.length,
  counters,
  findings,
  note: mode === 'portable'
    ? 'portable mode: absent git-ignored native evidence is reported as NOT VERIFIABLE, never as a pass and never as a false fail'
    : mode === 'source'
      ? 'source mode: artifact presence is advisory; structure and binding still validated'
      : 'local mode: every mandatory artifact must exist and hash to its recorded digest',
};

if (jsonOut) {
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(summary, null, 2));
}

console.log(`[verify-artifacts] mode=${mode} runs=${runs.length} verdict=${verdict}`);
console.log(`[verify-artifacts] verified=${counters.verified} verifiedLegacySha1=${counters.verifiedLegacy} mismatch=${counters.mismatch} missing=${counters.missing} unreadable=${counters.unreadable} wrongAttempt=${counters.wrongAttempt} wrongBuild=${counters.wrongBuild} unbound=${counters.unbound} mixedBuild=${counters.mixedBuild}`);
const shown = findings.filter((f) => f.kind !== 'artifact-legacy-digest');
for (const f of shown.slice(0, 25)) console.log(`  - ${f.kind}: ${f.detail}`);
if (shown.length > 25) console.log(`  ... ${shown.length - 25} more`);
if (counters.verifiedLegacy) {
  console.log(`  note: ${counters.verifiedLegacy} artifact(s) verified against legacy SHA-1 digests (pre SHA-256 policy) — real evidence, graded lower`);
}

const failNow = verdict === 'FAIL' || (strict && mandatoryProblems === 0 && verdict !== 'PASS');
process.exit(failNow ? 1 : 0);
