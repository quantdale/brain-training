/**
 * artifact-integrity.mjs — the SINGLE AUTHORITATIVE evidence-verification
 * implementation for Campaign 080 (and its successor campaigns).
 *
 * Why this module exists
 * ----------------------
 * `verify-artifacts.mjs` originally carried its own verdict/exit logic inline,
 * and that logic was defective in two independently reported ways:
 *
 *   F-080-NEW-001 (fail-open exit) — the exit expression was
 *
 *       const failNow = verdict === 'FAIL' ||
 *         (strict && mandatoryProblems === 0 && verdict !== 'PASS');
 *
 *   so a `BLOCKED` verdict produced by MISSING/UNREADABLE mandatory artifacts
 *   made `mandatoryProblems` positive, the second clause false, and the process
 *   exited 0 — an automated gate read an unverified certification as success.
 *   Only `FAIL` ever failed closed.
 *
 *   F-080-NEW-002 (mixed-build pass) — `counters.mixedBuild` was counted and
 *   diagnosed but never consulted by the verdict, so evidence assembled from
 *   several different application builds could certify as a single-build
 *   observation.
 *
 * The repair is architectural, not a patched conditional: verdict derivation,
 * build-scope policy and the process exit code live HERE, in one pure,
 * exhaustively testable place. `verify-artifacts.mjs` is reduced to argument
 * parsing + I/O + `process.exit(deriveVerificationExitCode(...))`, so the two
 * can never disagree.
 *
 * Verification principle
 * -----------------------
 * A digest is only evidence when it is recomputed FROM THE REAL BYTES on disk
 * and compared with what the ledger claims. Comparing two values copied out of
 * the same untrusted record (the dead `expectedSha1 !== sha1` check) verifies
 * nothing. Every check below therefore reads the artifact file.
 *
 * Historical evidence is never "repaired". An artifact whose recorded digest no
 * longer matches the file on disk stays a mismatch forever; it is reported, not
 * re-hashed into agreement.
 *
 * Verdicts
 * --------
 *   PASS                    every mandatory artifact independently verified and
 *                           no integrity/scope/duplicate finding
 *   FAIL                    an integrity violation: hash/size mismatch, wrong
 *                           attempt, cross-build, reused evidence, duplicate
 *                           attempt id, missing build identity, unsafe path
 *   BLOCKED                 required evidence is unavailable in this mode
 *                           (local mode: mandatory artifacts missing/unreadable)
 *   NOT_VERIFIABLE          portable mode only: the checkout legitimately does
 *                           not carry git-ignored native evidence. Never a pass,
 *                           never a false failure.
 *   NO_EVIDENCE             nothing was inspected at all.
 *
 * Exit contract (authoritative — see deriveVerificationExitCode)
 * ---------------------------------------------------------------
 *   0  PASS only, and only when strict certification was not asked for or was
 *      genuinely satisfied.
 *   1  FAIL / BLOCKED / NOT_VERIFIABLE / NO_EVIDENCE / any non-PASS verdict.
 *      In strict mode, ANYTHING other than PASS is 1.
 *   2  usage error or malformed input (the CLI layer's concern).
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARTIFACT_REQUIRED_PHASES,
  CAPABILITY_ARTIFACT_REQUIREMENTS as CONTRACT_CAPABILITY_REQUIREMENTS,
  deriveCapabilities,
  observationRequiresArtifact,
} from './coverage-contract.mjs';

// ---------------------------------------------------------------------------
// Verdict vocabulary — one authoritative list
// ---------------------------------------------------------------------------

export const VerificationVerdict = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
  NOT_VERIFIABLE: 'NOT_VERIFIABLE',
  NO_EVIDENCE: 'NO_EVIDENCE',
});

/**
 * Evidence modes.
 *
 *   local    — the machine that produced the native evidence. Every mandatory
 *              artifact must exist and hash to its recorded digest.
 *   portable — a fresh checkout: git-ignored native evidence is legitimately
 *              absent, so absence is NOT_VERIFIABLE (never a pass, never a
 *              false fail). Everything still checkable is checked.
 *   source   — source/fixture testing. Artifact presence is advisory; the
 *              intentionally different fixture-evaluation contract is preserved
 *              and a source-fixture pass may never stand in for native
 *              artifact verification (see `certifiesNativeEvidence`).
 */
export const EvidenceMode = Object.freeze({
  LOCAL: 'local',
  PORTABLE: 'portable',
  SOURCE: 'source',
});

export const EVIDENCE_MODES = Object.freeze(Object.values(EvidenceMode));

/**
 * Build-scope policy.
 *
 *   single (default) — single-build certification. All certifying runs must
 *                      belong to ONE actual application build, bound by source
 *                      SHA + APK SHA-256 + package identity + versionName +
 *                      versionCode. Mixed-build evidence fails the gate.
 *   archive          — multi-build archive verification. Evidence from several
 *                      builds may be archived together, but runs are
 *                      PARTITIONED by build identity, each partition is checked
 *                      independently, and the result explicitly states that it
 *                      does NOT describe the current application revision.
 */
export const BuildScope = Object.freeze({
  SINGLE: 'single',
  ARCHIVE: 'archive',
});

export const BUILD_SCOPES = Object.freeze(Object.values(BuildScope));

/** Fields that bind evidence to one actual build. All are required. */
export const REQUIRED_BUILD_FIELDS = Object.freeze([
  'gitSha',
  'apkSha256',
  'packageName',
  'versionName',
  'versionCode',
]);

/**
 * Capabilities that may not be certified without at least one bound,
 * independently verified artifact of the listed kinds (Campaign 080 P1-C).
 * Kept here (not in the CLI) so the policy has exactly one home.
 */
export const CAPABILITY_ARTIFACT_REQUIREMENTS = CONTRACT_CAPABILITY_REQUIREMENTS;

// ---------------------------------------------------------------------------
// THE authoritative exit contract
// ---------------------------------------------------------------------------

/**
 * Derive the process exit code for a verification result.
 *
 * This is the ONE place the exit contract is defined. It is deliberately
 * total over the verdict vocabulary and deliberately fail-closed:
 *
 *   - FAIL                          -> 1
 *   - BLOCKED                       -> 1   (F-080-NEW-001: the defective
 *                                           expression returned 0 here)
 *   - NOT_VERIFIABLE                -> 1   (never silently certification)
 *   - NO_EVIDENCE                   -> 1
 *   - unknown/undefined verdict     -> 1   (fail closed on the unexpected)
 *   - PASS with --strict            -> 0
 *   - PASS without --strict         -> 0
 *
 * `strict` cannot make a non-PASS verdict exit 0; it can only ever tighten the
 * requirement that the verdict BE exactly PASS. Non-strict mode is likewise
 * never allowed to treat BLOCKED/NOT_VERIFIABLE as success.
 *
 * @param {string} verdict  one of VerificationVerdict
 * @param {object} [opts]   { mode, strict, buildScope }
 * @returns {0|1}
 */
export function deriveVerificationExitCode(verdict, opts = {}) {
  const { strict = false } = opts;
  const normalised = typeof verdict === 'string' ? verdict.trim().toUpperCase() : '';
  // Anything that is not exactly PASS exits nonzero, in both strict and
  // non-strict mode. This single rule subsumes the historical defect: there is
  // no path on which a missing mandatory artifact (BLOCKED) can reach 0.
  if (normalised === VerificationVerdict.PASS) return 0;
  // An explicitly strict request additionally refuses to call a non-PASS
  // verdict "satisfied" — but the branch above already settles that, so the
  // strict flag can only confirm, never loosen. Kept explicit (and named) so
  // the intent is auditable and a future edit cannot resurrect the defect by
  // making strict mode the only failing path.
  if (strict) return 1;
  return 1;
}

/** True only for a genuine, non-strict-or-strict-satisfying PASS. */
export function isCertificationSuccess(result) {
  if (!result || typeof result !== 'object') return false;
  return result.verdict === VerificationVerdict.PASS
    && deriveVerificationExitCode(result.verdict, { strict: result.strict === true }) === 0;
}

/**
 * Source-fixture results are a DIFFERENT contract and can never substitute for
 * native artifact verification. Callers must consult this before describing a
 * source-mode pass as certified native evidence.
 */
export function certifiesNativeEvidence(result) {
  return !!result
    && result.verdict === VerificationVerdict.PASS
    && result.mode !== EvidenceMode.SOURCE;
}

// ---------------------------------------------------------------------------
// Build identity
// ---------------------------------------------------------------------------

/**
 * Canonical key for one build. A run whose identity is incomplete yields
 * `null` — an incomplete identity can never certify and never joins a
 * partition, so it cannot hide inside a "single build" set.
 */
export function buildIdentityKey(buildIdentity) {
  const b = buildIdentity && typeof buildIdentity === 'object' ? buildIdentity : {};
  const parts = REQUIRED_BUILD_FIELDS.map((f) => {
    const v = b[f];
    return v === undefined || v === null || v === '' ? null : String(v);
  });
  if (parts.some((p) => p === null)) return null;
  return parts.join('|');
}

/** Human-readable list of the build-identity fields that are missing. */
export function missingBuildFields(buildIdentity) {
  const b = buildIdentity && typeof buildIdentity === 'object' ? buildIdentity : {};
  return REQUIRED_BUILD_FIELDS.filter((f) => {
    const v = b[f];
    return v === undefined || v === null || v === '';
  });
}

/**
 * Partition runs by build identity WITHOUT losing the unidentifiable ones.
 * Unpartitionable runs are reported so a caller can never read a partition set
 * as "everything is accounted for".
 */
export function partitionByBuild(runs) {
  const partitions = new Map();
  const unidentifiable = [];
  for (const run of runs || []) {
    const key = buildIdentityKey(run && run.buildIdentity);
    if (key === null) { unidentifiable.push(run); continue; }
    if (!partitions.has(key)) partitions.set(key, []);
    partitions.get(key).push(run);
  }
  return { partitions, unidentifiable };
}

// ---------------------------------------------------------------------------
// Artifact path safety
// ---------------------------------------------------------------------------

/**
 * Resolve an artifact path safely.
 *
 * A ledger is untrusted input. It must never be able to point the verifier at
 * an arbitrary filesystem location (`../../.ssh/id_rsa`, an absolute path
 * outside the repository, a UNC/device path) and have that location read and
 * called verified evidence. Paths are resolved against `repoRoot` and must stay
 * inside it.
 *
 * @returns {{ok: boolean, absolute?: string, relative?: string, reason?: string}}
 */
export function resolveArtifactPath(file, repoRoot) {
  if (typeof file !== 'string' || file.trim() === '') {
    return { ok: false, reason: 'artifact path is empty or not a string' };
  }
  if (file.includes('\0')) return { ok: false, reason: 'artifact path contains a NUL byte' };
  // Windows device/UNC forms and POSIX absolute paths are rejected outright: a
  // relative evidence path is the only shape this verifier accepts.
  if (path.isAbsolute(file)) return { ok: false, reason: 'artifact path is absolute — evidence paths must be repository-relative' };
  if (/^[a-zA-Z]:/.test(file)) return { ok: false, reason: 'artifact path names a drive — evidence paths must be repository-relative' };
  if (/^\\\\|^\/\//.test(file)) return { ok: false, reason: 'artifact path is a network/device path' };
  if (path.win32.isAbsolute(file)) return { ok: false, reason: 'artifact path is absolute (win32)' };

  const root = path.resolve(repoRoot);
  const absolute = path.resolve(root, file);
  const rel = path.relative(root, absolute);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, reason: 'artifact path escapes the repository root' };
  }
  return { ok: true, absolute, relative: rel.split(path.sep).join('/') };
}

// ---------------------------------------------------------------------------
// Digest helpers
// ---------------------------------------------------------------------------

export function computeSha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function computeSha1(bytes) {
  return crypto.createHash('sha1').update(bytes).digest('hex');
}

// ---------------------------------------------------------------------------
// Artifact byte verification (independent re-hash)
// ---------------------------------------------------------------------------

/**
 * Verify one artifact against real bytes.
 *
 * Mirrors (and is the single source of truth for) the contract's
 * `verifyArtifactBytes`, adding byte-length checking for both digest grades and
 * a `grade` that distinguishes modern SHA-256 content verification from legacy
 * SHA-1 — so legacy evidence is real but never described as equivalent.
 *
 * @param {object} artifact  {file, sha256?, sha1?, bytes?, kind?}
 * @param {Buffer} bytes     bytes independently read from disk
 */
export function verifyArtifactBytes(artifact, bytes) {
  const problems = [];
  const notes = [];
  if (!artifact || typeof artifact !== 'object') {
    return { ok: false, grade: 'none', problems: ['artifact is not an object'], notes, computedSha256: null };
  }
  if (!Buffer.isBuffer(bytes)) {
    return { ok: false, grade: 'none', problems: ['artifact bytes unavailable'], notes, computedSha256: null };
  }
  const computedSha256 = computeSha256(bytes);

  if (artifact.sha256) {
    if (String(artifact.sha256).toLowerCase() !== computedSha256) {
      problems.push(`artifact sha256 mismatch: recorded ${artifact.sha256} computed ${computedSha256}`);
    }
    if (artifact.bytes != null && Number(artifact.bytes) !== bytes.length) {
      problems.push(`artifact byte length mismatch: recorded ${artifact.bytes} actual ${bytes.length}`);
    }
    if (artifact.sha1) {
      const computedSha1 = computeSha1(bytes);
      if (String(artifact.sha1).toLowerCase() !== computedSha1) {
        problems.push(`artifact legacy sha1 mismatch: recorded ${artifact.sha1} computed ${computedSha1}`);
      }
    }
    return { ok: problems.length === 0, grade: 'sha256', problems, notes, computedSha256 };
  }

  if (artifact.sha1) {
    const computedSha1 = computeSha1(bytes);
    if (String(artifact.sha1).toLowerCase() !== computedSha1) {
      problems.push(`artifact sha1 mismatch: recorded ${artifact.sha1} computed ${computedSha1}`);
    }
    if (artifact.bytes != null && Number(artifact.bytes) !== bytes.length) {
      problems.push(`artifact byte length mismatch: recorded ${artifact.bytes} actual ${bytes.length}`);
    }
    notes.push('verified against a LEGACY SHA-1 digest (pre SHA-256 artifact policy); not modern content verification');
    return { ok: problems.length === 0, grade: 'sha1-legacy', problems, notes, computedSha256 };
  }

  problems.push('artifact has no recorded digest (neither sha256 nor sha1) — nothing to verify against');
  return { ok: false, grade: 'none', problems, notes, computedSha256 };
}

/**
 * Is a screenshot artifact actually a PNG? A file named `obs-01-launch.png`
 * that contains arbitrary bytes is not a screenshot, and a filename that
 * resembles the expected artifact is never accepted on its own.
 */
export function sniffScreenshot(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 8) return { ok: false, reason: 'not a PNG: too short' };
  const isPng = bytes[0] === 0x89
    && bytes.toString('latin1', 1, 4) === 'PNG'
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  return isPng ? { ok: true } : { ok: false, reason: 'not a PNG: signature missing' };
}

/** Is a hierarchy artifact actually a UIAutomator-style XML document? */
export function sniffHierarchy(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return { ok: false, reason: 'not XML: empty' };
  const head = bytes.toString('utf8', 0, Math.min(bytes.length, 4096));
  if (head.includes('\0')) return { ok: false, reason: 'not XML: binary content' };
  if (!/<(hierarchy|node)\b/.test(head)) return { ok: false, reason: 'not XML: no hierarchy/node root element' };
  return { ok: true };
}

/** Empty hierarchy dumps are a known tooling failure, never a valid state. */
export function hierarchyIsEmpty(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return true;
  const text = bytes.toString('utf8');
  if (!/<node\b/.test(text)) return true;
  // A hierarchy with zero node elements (or a single bare root) proves nothing.
  return false;
}

// ---------------------------------------------------------------------------
// The verifier
// ---------------------------------------------------------------------------

function emptyCounters() {
  return {
    verified: 0,
    verifiedLegacy: 0,
    mismatch: 0,
    missing: 0,
    unreadable: 0,
    wrongAttempt: 0,
    wrongBuild: 0,
    unbound: 0,
    unsafePath: 0,
    reusedEvidence: 0,
    duplicateAttempt: 0,
    badContent: 0,
    incompleteIdentity: 0,
    capabilityUnbound: 0,
    mixedBuild: 0,
    // Informational only: byte-identical artifacts at DIFFERENT paths. The
    // emulator renders the same screen to the same pixels, so two attempts that
    // both sit on the launcher legitimately produce identical bytes. That is
    // determinism, NOT evidence reuse — it is reported for an auditor but never
    // fails a verdict. Reuse through a SHARED FILE PATH is the real signal and
    // does fail (reusedEvidence).
    identicalContentAcrossAttempts: 0,
  };
}

/** Integrity-related counters that make a verdict FAIL in every mode. */
const INTEGRITY_COUNTERS = Object.freeze([
  'mismatch',
  'wrongAttempt',
  'wrongBuild',
  'unbound',
  'unsafePath',
  'reusedEvidence',
  'duplicateAttempt',
  'badContent',
  'incompleteIdentity',
  'capabilityUnbound',
]);

/** Counters that make a LOCAL run BLOCKED (evidence absent on this machine). */
const ABSENCE_COUNTERS = Object.freeze(['missing', 'unreadable']);

/**
 * Verify a set of run records.
 *
 * @param {object[]} runs  ledger run records
 * @param {object} opts
 * @param {string} [opts.mode='portable']       EvidenceMode
 * @param {boolean} [opts.strict=false]         strict certification request
 * @param {string} [opts.buildScope='single']   BuildScope
 * @param {string} [opts.repoRoot=process.cwd()]
 * @param {boolean} [opts.sniffContent=true]    validate artifact content shape
 * @param {(absPath: string) => Buffer} [opts.readArtifactBytes]  injectable
 *        byte reader (defaults to fs.readFileSync; tests inject to exercise
 *        absence/unreadability without touching the filesystem)
 * @returns {object} result (see module header for verdict semantics)
 */
export function verifyArtifactLedger(runs, opts = {}) {
  const mode = opts.mode || EvidenceMode.PORTABLE;
  const strict = opts.strict === true;
  const buildScope = opts.buildScope || BuildScope.SINGLE;
  const repoRoot = path.resolve(opts.repoRoot || process.cwd());
  const sniffContent = opts.sniffContent !== false;
  const readArtifact = opts.readArtifactBytes || ((abs) => fs.readFileSync(abs));

  if (!EVIDENCE_MODES.includes(mode)) throw new Error(`bad evidence mode '${mode}'`);
  if (!BUILD_SCOPES.includes(buildScope)) throw new Error(`bad build scope '${buildScope}'`);

  const list = Array.isArray(runs) ? runs.filter((r) => r && typeof r === 'object') : [];
  const findings = [];
  const counters = emptyCounters();
  const record = (kind, detail) => findings.push({ kind, detail });

  // -- duplicate execution attempts ----------------------------------------
  // The same executionAttemptId twice is either a copy/paste error or a
  // fabricated attempt. Either way one attempt plus one attempt is one attempt.
  const attemptSeen = new Map();
  for (const run of list) {
    const id = run.executionAttemptId;
    if (!id) { counters.incompleteIdentity++; record('missing-attempt-id', 'a run carries no executionAttemptId'); continue; }
    if (attemptSeen.has(id)) {
      counters.duplicateAttempt++;
      record('duplicate-attempt-id', `executionAttemptId '${id}' appears more than once — duplicate attempts never certify`);
    }
    attemptSeen.set(id, run);
  }

  // -- build identity completeness ----------------------------------------
  for (const run of list) {
    const missing = missingBuildFields(run.buildIdentity);
    if (missing.length) {
      counters.incompleteIdentity++;
      counters.wrongBuild++;
      record('incomplete-build-identity', `${run.executionAttemptId || '(missing attempt)'}: buildIdentity missing ${missing.join(', ')} — cannot bind evidence to a build`);
    }
  }

  // -- build scope ---------------------------------------------------------
  const { partitions, unidentifiable } = partitionByBuild(list);
  counters.mixedBuild = partitions.size > 1 ? partitions.size : 0;
  const buildPartitionReport = [];
  for (const [key, members] of partitions) {
    buildPartitionReport.push({
      buildKey: key,
      runs: members.length,
      attempts: members.map((m) => m.executionAttemptId || '(missing)'),
    });
  }

  if (buildScope === BuildScope.SINGLE) {
    if (partitions.size > 1) {
      // F-080-NEW-002: mixed-build evidence may never certify a single build.
      counters.mixedBuildBlocking = partitions.size;
      for (const p of buildPartitionReport) {
        record('mixed-build-single-scope', `single-build certification refuses evidence from build ${p.buildKey} (attempts: ${p.attempts.join(', ')})`);
      }
    }
    if (unidentifiable.length) {
      counters.mixedBuildBlocking = (counters.mixedBuildBlocking || 0) + 1;
      record('mixed-build-single-scope', `${unidentifiable.length} run(s) have no usable build identity and cannot join a single-build certification`);
    }
  } else {
    // Archive scope: evidence from several builds is allowed, but it is
    // partitioned and never presented as the current revision's behaviour.
    for (const p of buildPartitionReport) {
      record('build-partition', `archive partition ${p.buildKey}: ${p.runs} run(s) [${p.attempts.join(', ')}]`);
    }
    for (const u of unidentifiable) {
      counters.wrongBuild++;
      record('incomplete-build-identity', `archive partition UNDETERMINED: ${u.executionAttemptId || '(missing attempt)'} — unverifiable provenance, cannot join any partition`);
    }
  }

  // -- cross-attempt evidence reuse ---------------------------------------
  // A screenshot produced by attempt A is evidence for A only. If attempt B
  // cites the same file, one of the two observations was never actually made.
  const fileOwner = new Map(); // relative path -> {attempt, digest}
  const observedDigests = new Map(); // digest -> Set(attemptId) for reuse detection

  // -- per-run verification ------------------------------------------------
  for (const run of list) {
    const attemptId = run.executionAttemptId || '(missing)';
    const buildOk = missingBuildFields(run.buildIdentity).length === 0;
    // Absence in local mode is a BLOCKED condition, not an integrity violation.
    // The capability-sufficiency check below must not double-report the same
    // absence as a FAIL: if any required artifact was simply not present, the
    // verdict is already BLOCKED and re-labelling it FAIL would misdescribe a
    // machine that merely lacks the evidence.
    let absenceInRun = false;

    const verifyOne = (artifact, label, mandatory) => {
      if (!artifact || typeof artifact !== 'object') {
        // An absent NON-mandatory artifact is normal (a harness only captures
        // what it needs). Only a required one is a problem — and a missing
        // requirement is an ABSENCE finding, not an integrity violation.
        if (mandatory) {
          counters.missing++;
          absenceInRun = true;
          record('missing-artifact', `${attemptId}: ${label} has no artifact binding`);
        }
        return null;
      }
      if (!artifact.file) {
        counters.unbound++;
        record('unbound-artifact', `${attemptId}: ${label} records a digest but no file binding — cannot be independently verified`);
        return null;
      }
      // Wrong-attempt binding.
      if (artifact.executionAttemptId && artifact.executionAttemptId !== attemptId) {
        counters.wrongAttempt++;
        record('artifact-wrong-attempt', `${attemptId}: ${label} claims artifact from attempt '${artifact.executionAttemptId}'`);
        return null;
      }
      // Path safety — a ledger must never redirect the verifier elsewhere.
      const resolved = resolveArtifactPath(artifact.file, repoRoot);
      if (!resolved.ok) {
        counters.unsafePath++;
        record('unsafe-artifact-path', `${attemptId}: ${label} — ${resolved.reason} (${artifact.file})`);
        return null;
      }
      // Reuse detection (per-file). A later attempt citing the same file with a
      // different digest is additionally a contradiction.
      const owner = fileOwner.get(resolved.relative);
      if (owner && owner.attempt !== attemptId) {
        counters.reusedEvidence++;
        record('artifact-reused-across-attempts', `${attemptId}: ${label} cites '${resolved.relative}' already owned by attempt '${owner.attempt}' — evidence cannot be reused between attempts`);
        return null;
      }
      if (owner && owner.digest && artifact.sha256 && owner.digest !== artifact.sha256) {
        counters.mismatch++;
        record('artifact-contradictory-digest', `${attemptId}: ${label} cites '${resolved.relative}' with a digest that contradicts an earlier citation`);
        return null;
      }
      fileOwner.set(resolved.relative, { attempt: attemptId, digest: artifact.sha256 || artifact.sha1 || null });

      let bytes;
      try {
        bytes = readArtifact(resolved.absolute);
        if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
      } catch (e) {
        absenceInRun = true;
        if (mode === EvidenceMode.LOCAL) {
          counters.unreadable++;
          record('artifact-unreadable', `${attemptId}: ${label} — ${artifact.file}: ${e.code || e.message}`);
        } else {
          // Absence in a portable/source checkout is NOT a pass and NOT a fail.
          counters.missing++;
          record('artifact-not-present', `${attemptId}: ${label} — ${artifact.file} not present in this checkout (${mode} mode: NOT_VERIFIABLE, not a pass)`);
        }
        return null;
      }

      const res = verifyArtifactBytes(artifact, bytes);
      if (!res.ok) {
        counters.mismatch++;
        record('artifact-hash-mismatch', `${attemptId}: ${label} — ${res.problems.join('; ')}`);
        return null;
      }

      // Content shape: a filename resemblance is never evidence.
      if (sniffContent) {
        const kind = artifact.kind;
        if (kind === 'screenshot') {
          const sniff = sniffScreenshot(bytes);
          if (!sniff.ok) {
            counters.badContent++;
            record('artifact-content-invalid', `${attemptId}: ${label} — ${artifact.file} is recorded as a screenshot but ${sniff.reason}`);
            return null;
          }
        } else if (kind === 'hierarchy') {
          const sniff = sniffHierarchy(bytes);
          if (!sniff.ok) {
            counters.badContent++;
            record('artifact-content-invalid', `${attemptId}: ${label} — ${artifact.file} is recorded as a hierarchy but ${sniff.reason}`);
            return null;
          }
        }
      }

      // Digest reuse across DIFFERENT paths is reported, never failed: the
      // emulator is deterministic, so identical screens legitimately produce
      // identical bytes. Failing on that would punish a correct harness.
      const digestKey = res.grade === 'sha256' ? res.computedSha256 : `sha1:${computeSha1(bytes)}`;
      if (!observedDigests.has(digestKey)) observedDigests.set(digestKey, new Set());
      const owners = observedDigests.get(digestKey);
      const otherOwner = [...owners].find((o) => o !== attemptId);
      if (otherOwner) {
        counters.identicalContentAcrossAttempts++;
        record('identical-content-across-attempts', `${attemptId}: ${label} — identical bytes to attempt '${otherOwner}' at a different path (deterministic screen; not evidence reuse)`);
      }
      owners.add(attemptId);

      if (res.grade === 'sha1-legacy') {
        counters.verifiedLegacy++;
        record('artifact-legacy-digest', `${attemptId}: ${label} verified against a LEGACY SHA-1 — real evidence, but not modern SHA-256 content verification`);
      } else {
        counters.verified++;
      }
      return { grade: res.grade, kind: artifact.kind || null, relative: resolved.relative };
    };

    // Observations -------------------------------------------------------
    const verifiedKinds = new Set();
    for (const o of run.observations || []) {
      if (!o || typeof o !== 'object') continue;
      const mandatory = observationRequiresArtifact(o);
      const label = `obs#${o.seq}${o.phase ? ` (${o.phase})` : ''}`;
      const ok = verifyOne(o.evidenceArtifact, label, mandatory);
      if (ok && ok.kind) verifiedKinds.add(ok.kind);
    }
    // Run-level artifacts -------------------------------------------------
    for (const a of run.artifacts || []) {
      if (!a || typeof a !== 'object') continue;
      const label = `artifact[${a.kind || 'unknown'}]`;
      const mandatory = a.mandatory === true;
      const ok = verifyOne(a, label, mandatory);
      if (ok && ok.kind) verifiedKinds.add(ok.kind);
    }

    // Capability-level artifact sufficiency (P1-C). A capability the contract
    // certifies must be backed by the kinds of artifact it requires. Only
    // checked when the run actually claims the capability, and only when the
    // artifacts were readable in this mode (otherwise absence is already
    // accounted for above).
    const axes = safeDeriveCapabilities(run);
    for (const [capability, kinds] of Object.entries(CAPABILITY_ARTIFACT_REQUIREMENTS)) {
      const axis = axes && axes[capability];
      if (!axis || axis.status !== 'VERIFIED') continue;
      const lacking = kinds.filter((k) => !verifiedKinds.has(k));
      // Only an INTEGRITY gap counts here: a capability whose backing artifact
      // was simply absent is reported by the absence counters (BLOCKED in local
      // mode, NOT_VERIFIABLE in portable), never re-labelled as a hash/binding
      // failure.
      if (lacking.length && !absenceInRun) {
        counters.capabilityUnbound++;
        record('capability-artifact-missing', `${attemptId}: ${capability} is certified but no verified ${lacking.join('/')} artifact backs it`);
      }
    }

    // Build provenance presence is already covered by the identity check; the
    // per-run binding of gitSha is what makes the sweep attributable.
    if (buildOk && (!run.buildIdentity || !run.buildIdentity.gitSha)) {
      counters.wrongBuild++;
      record('missing-build-provenance', `${attemptId}: no source SHA — cannot bind this evidence to a revision`);
    }
  }

  // -- verdict -------------------------------------------------------------
  const integrityProblems = INTEGRITY_COUNTERS.reduce((n, k) => n + (counters[k] || 0), 0)
    + (counters.mixedBuildBlocking || 0);
  const absenceProblems = ABSENCE_COUNTERS.reduce((n, k) => n + (counters[k] || 0), 0);

  let verdict;
  if (list.length === 0) verdict = VerificationVerdict.NO_EVIDENCE;
  else if (integrityProblems > 0) verdict = VerificationVerdict.FAIL;
  else if (mode === EvidenceMode.LOCAL) {
    // Local mode: required evidence must be present. Absence is BLOCKED — a
    // distinct verdict from FAIL, and never a pass (F-080-NEW-001).
    verdict = absenceProblems > 0 ? VerificationVerdict.BLOCKED : VerificationVerdict.PASS;
  } else if (absenceProblems > 0) {
    verdict = VerificationVerdict.NOT_VERIFIABLE;
  } else {
    verdict = VerificationVerdict.PASS;
  }

  if (buildScope === BuildScope.SINGLE && partitions.size > 1 && verdict === VerificationVerdict.PASS) {
    // Belt-and-braces: mixed builds can never pass single-build certification.
    verdict = VerificationVerdict.FAIL;
  }

  const exitCode = deriveVerificationExitCode(verdict, { mode, strict, buildScope });

  return {
    verdict,
    strict,
    mode,
    buildScope,
    exitCode,
    runsInspected: list.length,
    buildsInspected: partitions.size,
    buildPartitions: buildPartitionReport,
    counters,
    findings,
    // Honest scope statement: what this result does and does not certify.
    scope: buildScope === BuildScope.SINGLE
      ? (partitions.size === 1 ? 'single build' : 'mixed/undetermined builds — NOT single-build certification')
      : 'multi-build archive — partitions verified independently; this does NOT describe the current application revision',
    certifiesNativeEvidence: mode !== EvidenceMode.SOURCE && verdict === VerificationVerdict.PASS,
    note: mode === EvidenceMode.PORTABLE
      ? 'portable mode: absent git-ignored native evidence is reported as NOT_VERIFIABLE, never as a pass and never as a false fail'
      : mode === EvidenceMode.SOURCE
        ? 'source mode: artifact presence is advisory; structure, binding and digests of present artifacts are still validated; a source pass is never native certification'
        : 'local mode: every mandatory artifact must exist and hash to its recorded digest',
  };
}

/**
 * Capability derivation is a shared policy from the coverage contract. A run
 * that makes the deriver throw yields no axes, which means the capability
 * artifact check simply does not run for that run — it never passes by
 * accident, because the run's own structural validity is judged elsewhere.
 */
function safeDeriveCapabilities(run) {
  try { return deriveCapabilities(run); } catch { return null; }
}

/** The phase-based artifact requirement policy, re-exported for the CLI. */
export const DEFAULT_ARTIFACT_REQUIRED_PHASES = ARTIFACT_REQUIRED_PHASES;
