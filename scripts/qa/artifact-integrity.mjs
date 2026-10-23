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
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';
import {
  isIsoTimestamp,
  isQuarantinedRun,
  loadEvidenceGameMetadata,
  loadExpectedApplicationPackage,
  validateEvidenceRun,
} from './artifact-policy.mjs';
import {
  ARTIFACT_REQUIRED_PHASES,
  CAPABILITY_ARTIFACT_REQUIREMENTS as CONTRACT_CAPABILITY_REQUIREMENTS,
  deriveCapabilities,
  observationRequiresArtifact,
} from './coverage-contract.mjs';

const require = createRequire(new URL('../../apps/mobile/package.json', import.meta.url));
const { SaxesParser } = require('saxes');

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
    && result.mode !== EvidenceMode.SOURCE
    && result.buildScope === BuildScope.SINGLE
    && result.currentIdentityVerified === true;
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
  // Treat both slash spellings as separators even when auditing Windows ledgers
  // on POSIX. Windows strips trailing dots/spaces and supports ADS; reject those
  // aliases instead of allowing them to evade ownership tracking.
  const components = file.replace(/\\/g, '/').split('/');
  if (components.some((part) => /[. ]$/.test(part) && part !== '.' && part !== '..') || file.includes(':')) {
    return { ok: false, reason: 'artifact path contains a Windows alias or alternate data stream' };
  }
  const absolute = path.resolve(root, ...components);
  const rel = path.relative(root, absolute);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, reason: 'artifact path escapes the repository root' };
  }
  // Resolve symlink/junction aliases before assigning ownership. Existing paths
  // must stay inside the real repository; a lexical prefix is not sufficient.
  let canonical = absolute;
  try {
    canonical = fs.realpathSync(absolute);
    const realRoot = fs.realpathSync(root);
    const realRel = path.relative(realRoot, canonical);
    if (realRel.startsWith('..') || path.isAbsolute(realRel)) return { ok: false, reason: 'artifact symlink escapes the repository root' };
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') return { ok: false, reason: `cannot resolve artifact ownership: ${error.code || error.message}` };
  }
  return { ok: true, absolute, relative: rel.split(path.sep).join('/'), ownershipKey: canonical.replace(/\\/g, '/').toLowerCase() };
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
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function sniffScreenshot(bytes) {
  const bad = (reason) => ({ ok: false, reason: `not a valid PNG: ${reason}` });
  if (!Buffer.isBuffer(bytes) || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return bad('signature missing');
  let offset = 8;
  let header;
  let ended = false;
  let palette = false;
  let dataEnded = false;
  const data = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) return bad('truncated chunk');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (!/^[A-Za-z]{4}$/.test(type) || offset + length + 12 > bytes.length) return bad('invalid chunk length/type');
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) return bad(`${type} CRC mismatch`);
    if (!header && type !== 'IHDR') return bad('IHDR must be first');
    if (type === 'IHDR') {
      if (header || length !== 13) return bad('invalid/duplicate IHDR');
      const width = payload.readUInt32BE(0), height = payload.readUInt32BE(4);
      const depth = payload[8], color = payload[9];
      const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!width || !height || width > 32768 || height > 32768 || !depths[color]?.includes(depth) || payload[10] || payload[11] || payload[12] > 1) return bad('invalid IHDR dimensions/encoding');
      header = { width, height, depth, color, interlace: payload[12] };
    } else if (type === 'PLTE') {
      if (palette || data.length || !length || length % 3 || length > 768 || [0, 4].includes(header.color)) return bad('invalid palette');
      palette = true;
    } else if (type === 'IDAT') {
      if (dataEnded || (header.color === 3 && !palette)) return bad('invalid IDAT order/palette');
      data.push(payload);
    } else if (type === 'IEND') {
      if (length || !data.length || offset + 12 !== bytes.length) return bad('invalid IEND or trailing bytes');
      ended = true;
    } else {
      if (data.length) dataEnded = true;
      if (type[0] === type[0].toUpperCase()) return bad(`unknown critical chunk ${type}`);
    }
    offset += length + 12;
  }
  if (!ended || !header) return bad('missing IHDR/IDAT/IEND');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header.color];
  const passes = header.interlace ? [[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]] : [[0,0,1,1]];
  const rows = passes.map(([x,y,dx,dy]) => {
    const width = Math.max(0, Math.ceil((header.width - x) / dx));
    const height = Math.max(0, Math.ceil((header.height - y) / dy));
    return { height: width ? height : 0, stride: 1 + Math.ceil(width * channels * header.depth / 8) };
  });
  const size = rows.reduce((n, row) => n + row.height * row.stride, 0);
  if (size > 128 * 1024 * 1024) return bad('decoded image exceeds verification bound');
  try {
    const compressed = Buffer.concat(data);
    const result = inflateSync(compressed, { maxOutputLength: Math.max(1, size), info: true });
    if (result.engine.bytesWritten !== compressed.length || result.buffer.length !== size) return bad('incorrect compressed/pixel length');
    let at = 0;
    for (const row of rows) for (let y = 0; y < row.height; y++, at += row.stride) if (result.buffer[at] > 4) return bad('invalid scanline filter');
  } catch (error) { return bad(`invalid compressed pixels (${error.message})`); }
  return { ok: true };
}

/** Parse actual UIAutomator hierarchy bytes into root/node attributes. */
export function parseHierarchy(bytes) {
  const bad = (reason) => ({ ok: false, reason: `not valid hierarchy XML: ${reason}` });
  if (!Buffer.isBuffer(bytes) || !bytes.length) return bad('empty');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return bad('invalid UTF-8'); }
  let root = null, depth = 0, problem = null;
  const nodes = [];
  const parser = new SaxesParser({ xmlns: false });
  parser.on('error', (error) => { problem = error.message; });
  parser.on('doctype', () => { problem = 'DOCTYPE is forbidden'; });
  parser.on('opentag', (tag) => {
    const attributes = Object.fromEntries(Object.entries(tag.attributes || {}).map(([key, value]) => [key, String(value)]));
    if (depth++ === 0) root = tag.name;
    if (!['hierarchy', 'node'].includes(tag.name)) problem = `unexpected element ${tag.name}`;
    if (tag.name === 'node') nodes.push(attributes);
  });
  parser.on('closetag', () => { depth--; });
  parser.on('text', (value) => { if (value.trim()) problem = 'unexpected text content'; });
  try { parser.write(text).close(); } catch (error) { problem = error.message; }
  if (problem || root !== 'hierarchy' || nodes.length === 0 || depth !== 0) {
    return bad(problem || 'missing populated hierarchy root');
  }
  return { ok: true, root, nodes };
}

/** Strict XML parsing, not prefix sniffing. DTDs/entities are never evaluated. */
export function sniffHierarchy(bytes) {
  const parsed = parseHierarchy(bytes);
  return parsed.ok ? { ok: true } : { ok: false, reason: parsed.reason };
}

/** Compare ledger hierarchy claims with IDs and packages in captured XML bytes. */
function hierarchyObservationProblems(parsed, run, observation, gameMetadata, expectedPackage) {
  const problems = [];
  if (!parsed?.ok || !observation) return ['hierarchy is not bound to a run observation'];
  const nodes = parsed.nodes;
  const packageNames = new Set(nodes.map((node) => node.package).filter(Boolean));
  if (!expectedPackage || !packageNames.has(expectedPackage)) {
    problems.push(`captured hierarchy has no node for expected application package '${expectedPackage || '(unknown)'}'`);
  }
  if (run.buildIdentity?.packageName !== expectedPackage) {
    problems.push(`run package '${run.buildIdentity?.packageName || '(missing)'}' does not match application package '${expectedPackage || '(unknown)'}'`);
  }

  const controlsByGame = new Map();
  const gameIds = [...(gameMetadata?.keys() || [])].sort((a, b) => b.length - a.length);
  for (const node of nodes) {
    const rawId = node['resource-id'] || node.resourceId || '';
    const resourceId = rawId.includes(':id/') ? rawId.split(':id/').pop() : rawId.split('/').pop();
    for (const gameId of gameIds) {
      if (resourceId === gameId || resourceId.startsWith(`${gameId}.`)) {
        if (!controlsByGame.has(gameId)) controlsByGame.set(gameId, new Set());
        controlsByGame.get(gameId).add(resourceId === gameId ? 'screen' : resourceId.slice(gameId.length + 1));
        break;
      }
    }
  }
  const detectedGameIds = [...controlsByGame.keys()];
  if (detectedGameIds.length > 1) problems.push(`captured hierarchy contains controls for multiple games (${detectedGameIds.join(', ')})`);
  const detectedGameId = detectedGameIds.length === 1 ? detectedGameIds[0] : null;
  if ((detectedGameId && observation.observedGameId !== detectedGameId)
      || (observation.observedGameId != null && observation.observedGameId !== detectedGameId)) {
    problems.push(`observedGameId claim '${observation.observedGameId ?? '(none)'}' does not match captured hierarchy identity '${detectedGameId || '(none)'}'`);
  }
  const actualControls = [...(controlsByGame.get(run.gameId) || [])].sort();
  const claimedControls = Array.isArray(observation.controls) ? [...observation.controls].sort() : [];
  if (JSON.stringify(claimedControls) !== JSON.stringify(actualControls)) {
    problems.push(`controls claim [${claimedControls.join(', ')}] does not match captured hierarchy [${actualControls.join(', ')}]`);
  }

  const raw = observation.rawScreen;
  if (raw !== undefined) {
    if (raw.expectedPackage !== expectedPackage) problems.push('rawScreen.expectedPackage does not match the application package');
    if (raw.hierarchyStatus !== 'ok') problems.push('rawScreen.hierarchyStatus does not describe the parsed hierarchy bytes');
    if (raw.controlCount !== undefined && raw.controlCount !== actualControls.length) problems.push('rawScreen.controlCount does not match game controls parsed from hierarchy bytes');
    const focusPackage = typeof raw.focusPackage === 'string' ? raw.focusPackage.split('/')[0] : null;
    if (focusPackage && focusPackage !== expectedPackage && detectedGameId) problems.push('rawScreen.focusPackage does not match the captured game application package');
  }

  const allGameControls = [...controlsByGame.values()].some((controls) => controls.size > 0);
  const textualEvidence = nodes.flatMap((node) => [node.text, node['content-desc'], node['resource-id'], node.class, node.package].filter(Boolean)).join(' ');
  const crashEvidence = /(?:has stopped|keeps stopping|isn['’]t responding|not responding|app crashed|application crashed)/i.test(textualEvidence);
  const systemDialogEvidence = nodes.some((node) => {
    const packageName = node.package || '';
    const className = node.class || '';
    const resourceId = node['resource-id'] || '';
    const text = `${node.text || ''} ${node['content-desc'] || ''}`;
    return /(?:permissioncontroller|packageinstaller)/i.test(packageName)
      || /(?:alertdialog|permissiondialog|systemdialog)/i.test(className)
      || /(?:permission|dialog)/i.test(resourceId)
      || /(?:allow|deny|permission request|open settings)/i.test(text);
  });
  const markerList = Array.isArray(observation.screenMarkers) ? observation.screenMarkers : [];
  const negativeScreenClaim = markerList.some((marker) => ['crash', 'app-crashed', 'system-dialog', 'permission-dialog', 'adb-failure', 'hierarchy-failure', 'malformed-hierarchy'].includes(marker));
  const claimsDestination = observation.screenKind === 'app-destination' || markerList.includes('app-destination');
  if (claimsDestination) {
    if (!packageNames.has(expectedPackage)) problems.push('app destination is not rooted in captured nodes from the known application package');
    if (allGameControls) problems.push('app destination hierarchy still contains game controls');
    if (crashEvidence || systemDialogEvidence || negativeScreenClaim) problems.push('app destination hierarchy contains crash/system-dialog evidence');
    if (!raw || raw.expectedPackage !== expectedPackage || raw.hierarchyStatus !== 'ok' || raw.appAlive !== true
        || !raw.focusPackage || raw.focusPackage.split('/')[0] !== expectedPackage) {
      problems.push('app destination lacks matching live foreground/package metadata');
    }
  }
  return problems;
}

const TUTORIAL_STATE_QUERY = 'SELECT completed, replay_requested, version FROM tutorial_state WHERE game_id = ?';

function tutorialStateArtifactProblems(bytes, run) {
  const problems = [];
  let snapshot;
  try { snapshot = JSON.parse(bytes.toString('utf8')); }
  catch { return ['tutorial-state artifact is not valid JSON']; }
  if (!isRecord(snapshot) || snapshot.schemaVersion !== 1 || snapshot.source !== 'sqlite-query'
      || snapshot.query !== TUTORIAL_STATE_QUERY || !Array.isArray(snapshot.parameters)
      || snapshot.parameters.length !== 1 || snapshot.parameters[0] !== run.gameId
      || snapshot.gameId !== run.gameId || typeof snapshot.completed !== 'boolean'
      || !(snapshot.row === null || isRecord(snapshot.row))) {
    return ['tutorial-state artifact does not match the bound SQLite query schema/gameId'];
  }
  let completed = false, replayRequested = false, version = null;
  if (snapshot.row !== null) {
    const row = snapshot.row;
    if ((row.game_id !== undefined && row.game_id !== run.gameId)
        || ![0, 1].includes(row.completed)
        || ![0, 1].includes(row.replay_requested)
        || (row.version !== null && typeof row.version !== 'string')) {
      return ['tutorial-state artifact row is not a valid tutorial_state query result'];
    }
    completed = row.completed === 1;
    replayRequested = row.replay_requested === 1;
    version = row.version;
  }
  const previouslyCompleted = completed && !replayRequested && version === '1.0.0';
  if (snapshot.completed !== completed) problems.push('tutorial-state JSON completed value does not match its SQLite row');
  const claim = run.tutorialState;
  if (!isRecord(claim)) return [...problems, 'tutorial-state artifact has no corresponding run tutorialState claim'];
  if (claim.previouslyCompleted !== previouslyCompleted) problems.push('tutorialState.previouslyCompleted does not match the captured SQLite row');
  if (claim.completed !== completed) problems.push('tutorialState.completed does not match the captured SQLite row');
  if (claim.replayRequested !== replayRequested) problems.push('tutorialState.replayRequested does not match the captured SQLite row');
  if (claim.version !== version) problems.push('tutorialState.version does not match the captured SQLite row');
  if (claim.source !== 'tutorial_state') problems.push('tutorialState source does not identify the tutorial_state SQLite row');
  if (claim.gameId !== undefined && claim.gameId !== run.gameId) problems.push('tutorialState.gameId does not match the run gameId');
  return problems;
}

/** Empty hierarchy dumps are a known tooling failure, never a valid state. */
export function hierarchyIsEmpty(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return true;
  const text = bytes.toString('utf8');
  if (!/<node\b/.test(text)) return true;
  // A hierarchy with zero node elements (or a single bare root) proves nothing.
  return false;
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha256Shape = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
const gitShaShape = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value);

/** Load and verify the externally supplied acquisition index. */
function loadCaptureReceiptIndex(input, repoRoot, readArtifact) {
  if (input === undefined || input === null || input === '') return { present: false, valid: false, entries: new Map(), errors: [] };
  let document = input;
  if (typeof input === 'string') {
    try { document = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8')); }
    catch (error) { return { present: true, valid: false, entries: new Map(), errors: [`cannot read capture-receipts index: ${error.code || error.message}`] }; }
  }
  if (!isRecord(document) || document.schemaVersion !== 1 || !Array.isArray(document.receipts)) {
    return { present: true, valid: false, entries: new Map(), errors: ['capture-receipts index must be {schemaVersion:1,receipts:[{file,sha256}]}'] };
  }
  const entries = new Map();
  const captureIds = new Map();
  const artifactFiles = new Map();
  const errors = [];
  for (const [index, entry] of document.receipts.entries()) {
    if (!isRecord(entry) || typeof entry.file !== 'string' || !sha256Shape(entry.sha256)) {
      errors.push(`capture-receipts[${index}] must contain a repository-relative file and SHA-256`);
      continue;
    }
    const resolved = resolveArtifactPath(entry.file, repoRoot);
    if (!resolved.ok) { errors.push(`capture-receipts[${index}] has unsafe path: ${resolved.reason}`); continue; }
    if (entries.has(resolved.ownershipKey)) { errors.push(`capture-receipts index repeats canonical receipt path '${entry.file}'`); continue; }
    let bytes;
    try { bytes = readArtifact(resolved.absolute); }
    catch (error) { errors.push(`capture receipt '${entry.file}' is unreadable: ${error.code || error.message}`); continue; }
    if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
    const actualSha = computeSha256(bytes);
    if (actualSha !== entry.sha256.toLowerCase()) { errors.push(`capture receipt '${entry.file}' SHA-256 mismatch`); continue; }
    let receipt;
    try { receipt = JSON.parse(bytes.toString('utf8')); }
    catch { errors.push(`capture receipt '${entry.file}' is not valid JSON`); continue; }
    if (!isRecord(receipt)
        || receipt.schemaVersion !== 1
        || typeof receipt.captureId !== 'string' || !receipt.captureId.trim()
        || typeof receipt.executionAttemptId !== 'string' || !receipt.executionAttemptId.trim()
        || !sha256Shape(receipt.artifactSha256)
        || !isIsoTimestamp(receipt.capturedAt)
        || !Number.isSafeInteger(receipt.observationSeq) || receipt.observationSeq < 0
        || !isIsoTimestamp(receipt.observationTimestamp)
        || typeof receipt.artifactFile !== 'string' || !receipt.artifactFile.trim()
        || !gitShaShape(receipt.gitSha)
        || !sha256Shape(receipt.apkSha256)) {
      errors.push(`capture receipt '${entry.file}' does not match schemaVersion 1 artifact/observation binding fields`);
      continue;
    }
    if (captureIds.has(receipt.captureId)) {
      errors.push(`captureId '${receipt.captureId}' is not unique per artifact acquisition`);
      continue;
    }
    captureIds.set(receipt.captureId, resolved.ownershipKey);
    const artifactPath = resolveArtifactPath(receipt.artifactFile, repoRoot);
    if (!artifactPath.ok) { errors.push(`capture receipt '${entry.file}' has unsafe artifactFile: ${artifactPath.reason}`); continue; }
    if (artifactFiles.has(artifactPath.ownershipKey)) {
      errors.push(`artifact '${receipt.artifactFile}' has more than one acquisition receipt`);
      continue;
    }
    artifactFiles.set(artifactPath.ownershipKey, resolved.ownershipKey);
    const artifactOwnershipKey = artifactPath.ownershipKey;
    entries.set(resolved.ownershipKey, {
      indexFile: entry.file,
      indexSha256: entry.sha256.toLowerCase(),
      receipt,
      artifactOwnershipKey,
    });
  }
  return { present: true, valid: errors.length === 0, entries, errors };
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
    invalidRun: 0,
    quarantinedRun: 0,
    noMeaningfulArtifact: 0,
    captureReceiptInvalid: 0,
    captureReceiptUnindexed: 0,
    captureReceiptIndexInvalid: 0,
    captureReceiptIndexMissing: 0,
    currentIdentityMissing: 0,
    invalidExpectedIdentity: 0,
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
  'invalidRun',
  'quarantinedRun',
  'noMeaningfulArtifact',
  'captureReceiptInvalid',
  'captureReceiptUnindexed',
  'captureReceiptIndexInvalid',
  'invalidExpectedIdentity',
]);

/** Counters that make native verification unavailable rather than successful. */
const ABSENCE_COUNTERS = Object.freeze(['missing', 'unreadable', 'captureReceiptIndexMissing', 'currentIdentityMissing']);

/**
 * Verify a set of run records.
 *
 * @param {object[]} runs  ledger run records
 * @param {object} opts
 * @param {string} [opts.mode='portable']       EvidenceMode
 * @param {boolean} [opts.strict=false]         strict certification request
 * @param {string} [opts.buildScope='single']   BuildScope
 * @param {string} [opts.repoRoot=process.cwd()]
 * @param {string|object} [opts.captureReceipts] externally supplied schemaVersion-1 acquisition index
 * @param {string} [opts.expectedGitSha]        externally supplied current source identity
 * @param {string} [opts.expectedApkSha256]     externally supplied current APK identity
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

  const inputIsArray = Array.isArray(runs);
  const list = inputIsArray ? runs : [];
  const findings = [];
  const counters = emptyCounters();
  const record = (kind, detail) => findings.push({ kind, detail });
  let gameMetadata = null;
  let knownGames = null;
  let expectedApplicationPackage = null;
  try {
    gameMetadata = loadEvidenceGameMetadata();
    knownGames = new Set(gameMetadata.keys());
    expectedApplicationPackage = loadExpectedApplicationPackage();
  } catch (error) { record('registry-unavailable', `authoritative game registry/package metadata could not be loaded: ${error.message}`); }
  if (!inputIsArray) {
    counters.invalidRun++;
    record('malformed-run-collection', 'run collection must be an array; no entries were accepted');
  }
  const receiptIndex = loadCaptureReceiptIndex(opts.captureReceipts, repoRoot, readArtifact);
  if (mode !== EvidenceMode.SOURCE && !receiptIndex.present) {
    counters.captureReceiptIndexMissing++;
    record('capture-receipt-index-missing', 'native artifact verification requires an externally supplied capture-receipts index');
  } else if (receiptIndex.present && !receiptIndex.valid) {
    counters.captureReceiptIndexInvalid++;
    for (const error of receiptIndex.errors) record('capture-receipt-index-invalid', error);
  }
  const expectedGitSha = opts.expectedGitSha;
  const expectedApkSha256 = opts.expectedApkSha256;
  if (buildScope === BuildScope.SINGLE && mode !== EvidenceMode.SOURCE) {
    if (expectedGitSha === undefined || expectedApkSha256 === undefined) {
      counters.currentIdentityMissing++;
      record('current-build-identity-missing', 'single-build native verification requires externally supplied expectedGitSha and expectedApkSha256');
    } else if (!gitShaShape(expectedGitSha) || !sha256Shape(expectedApkSha256)) {
      counters.invalidExpectedIdentity++;
      record('current-build-identity-invalid', 'expected source SHA must be 40 hexadecimal characters and expected APK SHA-256 must be 64 hexadecimal characters');
    }
  }

  // -- duplicate execution attempts ----------------------------------------
  // The same executionAttemptId twice is either a copy/paste error or a
  // fabricated attempt. Either way one attempt plus one attempt is one attempt.
  const attemptSeen = new Map();
  const duplicateAttempts = new Set();
  for (const run of list) {
    if (!isRecord(run)) {
      counters.invalidRun++;
      record('invalid-run-shape', 'run entry must be an object; malformed entry was retained and rejected');
      continue;
    }
    const id = run.executionAttemptId;
    if (typeof id !== 'string' || !id.trim()) { counters.incompleteIdentity++; record('missing-attempt-id', 'a run carries no executionAttemptId'); continue; }
    if (attemptSeen.has(id)) {
      counters.duplicateAttempt++;
      duplicateAttempts.add(id);
      record('duplicate-attempt-id', `executionAttemptId '${id}' appears more than once — duplicate attempts never certify`);
    }
    attemptSeen.set(id, run);
  }

  // -- input/run policy validation -----------------------------------------
  const runValidations = new Map();
  for (const [index, run] of list.entries()) {
    const validation = validateEvidenceRun(run, knownGames, gameMetadata);
    runValidations.set(index, validation);
    if (!validation.valid) {
      counters.invalidRun++;
      record('invalid-run', `run[${index}] rejected before artifact/capability derivation: ${validation.errors.join('; ')}`);
    }
    if (isRecord(run) && isQuarantinedRun(run)) {
      counters.quarantinedRun++;
      record('quarantined-run', `run[${index}] matches quarantined historical v1-v7 evidence and cannot certify`);
    }
  }

  // -- build identity completeness ----------------------------------------
  for (const run of list) {
    if (!isRecord(run)) continue;
    const missing = missingBuildFields(run.buildIdentity);
    if (missing.length) {
      counters.incompleteIdentity++;
      counters.wrongBuild++;
      record('incomplete-build-identity', `${run.executionAttemptId || '(missing attempt)'}: buildIdentity missing ${missing.join(', ')} — cannot bind evidence to a build`);
    }
    if (buildScope === BuildScope.SINGLE && mode !== EvidenceMode.SOURCE
        && gitShaShape(expectedGitSha) && sha256Shape(expectedApkSha256)
        && (String(run.buildIdentity?.gitSha).toLowerCase() !== expectedGitSha.toLowerCase()
          || String(run.buildIdentity?.apkSha256).toLowerCase() !== expectedApkSha256.toLowerCase())) {
      counters.wrongBuild++;
      record('unexpected-current-build', `${run.executionAttemptId || '(missing attempt)'}: claimed source/APK identity does not match the externally supplied expected identity`);
    }
  }

  // -- build scope ---------------------------------------------------------
  const { partitions, unidentifiable } = partitionByBuild(list.filter(isRecord));
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
  const fileOwner = new Map(); // canonical Windows ownership key -> {attempt, observationKey, digest}
  const receiptOwner = new Map(); // canonical receipt path -> { attempt, observationKey }
  const observedDigests = new Map(); // digest -> Set(attemptId) for reuse detection
  let meaningfulArtifacts = 0;
  const verifyCaptureReceipt = (artifact, resolvedArtifact, actualSha256, run, label, explicitObservation = null) => {
    if (mode === EvidenceMode.SOURCE && artifact.captureReceipt === undefined) {
      return { observation: explicitObservation, observationKey: explicitObservation ? `${run.executionAttemptId}\u0000${explicitObservation.seq}\u0000${explicitObservation.timestamp}` : null };
    }
    if (mode === EvidenceMode.SOURCE && !receiptIndex.present) {
      return { observation: explicitObservation, observationKey: explicitObservation ? `${run.executionAttemptId}\u0000${explicitObservation.seq}\u0000${explicitObservation.timestamp}` : null };
    }
    if (!isRecord(artifact.captureReceipt)
        || typeof artifact.captureReceipt.file !== 'string'
        || !sha256Shape(artifact.captureReceipt.sha256)) {
      if (mode === EvidenceMode.SOURCE && !receiptIndex.present) {
        return { observation: explicitObservation, observationKey: explicitObservation ? `${run.executionAttemptId}\u0000${explicitObservation.seq}\u0000${explicitObservation.timestamp}` : null };
      }
      counters.unbound++;
      record('capture-receipt-missing', `${run.executionAttemptId}: ${label} has no valid captureReceipt {file,sha256}`);
      return false;
    }
    if (!receiptIndex.present) {
      record('capture-receipt-index-unavailable', `${run.executionAttemptId}: ${label} receipt cannot be checked without the external index`);
      return false;
    }
    if (!receiptIndex.valid) return false;
    const resolvedReceipt = resolveArtifactPath(artifact.captureReceipt.file, repoRoot);
    if (!resolvedReceipt.ok) {
      counters.unsafePath++;
      record('unsafe-capture-receipt-path', `${run.executionAttemptId}: ${label} — ${resolvedReceipt.reason}`);
      return false;
    }
    const indexed = receiptIndex.entries.get(resolvedReceipt.ownershipKey);
    if (!indexed || indexed.indexSha256 !== artifact.captureReceipt.sha256.toLowerCase()) {
      counters.captureReceiptUnindexed++;
      record('capture-receipt-unindexed', `${run.executionAttemptId}: ${label} receipt is absent from the supplied capture-receipts index or has a different digest`);
      return false;
    }
    const receipt = indexed.receipt;
    const build = run.buildIdentity || {};
    const matchingObservations = (run.observations || []).filter((candidate) => candidate
      && candidate.seq === receipt.observationSeq
      && candidate.timestamp === receipt.observationTimestamp);
    const observation = explicitObservation || (matchingObservations.length === 1 ? matchingObservations[0] : null);
    if (!observation || observation.seq !== receipt.observationSeq || observation.timestamp !== receipt.observationTimestamp) {
      counters.captureReceiptInvalid++;
      record('capture-receipt-observation-mismatch', `${run.executionAttemptId}: ${label} receipt is not bound to the exact observation sequence and timestamp`);
      return false;
    }
    const observationKey = `${run.executionAttemptId}\u0000${observation.seq}\u0000${observation.timestamp}`;
    const priorReceiptOwner = receiptOwner.get(resolvedReceipt.ownershipKey);
    if (priorReceiptOwner && (priorReceiptOwner.attempt !== run.executionAttemptId || priorReceiptOwner.observationKey !== observationKey)) {
      counters.reusedEvidence++;
      record('capture-receipt-reused-for-distinct-observation', `${run.executionAttemptId}: ${label} reuses a capture receipt for a different observation`);
      return false;
    }
    if (receipt.executionAttemptId !== run.executionAttemptId
        || receipt.artifactSha256.toLowerCase() !== actualSha256
        || String(receipt.gitSha).toLowerCase() !== String(build.gitSha || '').toLowerCase()
        || String(receipt.apkSha256).toLowerCase() !== String(build.apkSha256 || '').toLowerCase()
        || (indexed.artifactOwnershipKey && indexed.artifactOwnershipKey !== resolvedArtifact.ownershipKey)) {
      counters.captureReceiptInvalid++;
      record('capture-receipt-binding-mismatch', `${run.executionAttemptId}: ${label} receipt does not bind this artifact, attempt, source/APK build, and path`);
      return false;
    }
    receiptOwner.set(resolvedReceipt.ownershipKey, { attempt: run.executionAttemptId, observationKey });
    return { observation, observationKey };
  };

  // -- per-run verification ------------------------------------------------
  for (const [runIndex, run] of list.entries()) {
    if (!isRecord(run)) continue;
    const validation = runValidations.get(runIndex);
    if (!validation?.valid || isQuarantinedRun(run)) continue;
    const attemptId = run.executionAttemptId || '(missing)';
    const buildOk = missingBuildFields(run.buildIdentity).length === 0;
    let runMeaningfulArtifacts = 0;
    let runMeaningfulBindings = 0;
    let verifiedHierarchyIdentity = false;
    // Absence in local mode is a BLOCKED condition, not an integrity violation.
    // The capability-sufficiency check below must not double-report the same
    // absence as a FAIL: if any required artifact was simply not present, the
    // verdict is already BLOCKED and re-labelling it FAIL would misdescribe a
    // machine that merely lacks the evidence.
    let absenceInRun = false;

    const verifyOne = (artifact, label, mandatory, explicitObservation = null) => {
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
      if ((artifact.kind === 'screenshot' || artifact.kind === 'hierarchy') && typeof artifact.file === 'string' && artifact.file.trim()) runMeaningfulBindings++;
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
      const priorPathOwner = fileOwner.get(resolved.ownershipKey);
      if (priorPathOwner && priorPathOwner.attempt !== attemptId) {
        counters.reusedEvidence++;
        record('artifact-reused-across-attempts', `${attemptId}: ${label} cites '${resolved.relative}' already owned by attempt '${priorPathOwner.attempt}' — evidence cannot be reused between attempts`);
        return null;
      }
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

      // A valid acquisition receipt binds the actual bytes, attempt, build, and
      // exact observation. Repeated fields referencing the SAME observation do
      // not represent a new acquisition; distinct observations need new receipts.
      const receiptBinding = verifyCaptureReceipt(artifact, resolved, res.computedSha256, run, label, explicitObservation);
      if (!receiptBinding) return null;
      const observationKey = receiptBinding.observationKey;
      const owner = fileOwner.get(resolved.ownershipKey);
      if (owner && (owner.attempt !== attemptId || owner.observationKey !== observationKey)) {
        counters.reusedEvidence++;
        record('artifact-reused-for-distinct-observation', `${attemptId}: ${label} reuses '${resolved.relative}' for a distinct capture observation`);
        return null;
      }
      if (owner && owner.digest && artifact.sha256 && owner.digest !== artifact.sha256) {
        counters.mismatch++;
        record('artifact-contradictory-digest', `${attemptId}: ${label} cites '${resolved.relative}' with a digest that contradicts an earlier citation`);
        return null;
      }
      fileOwner.set(resolved.ownershipKey, { attempt: attemptId, observationKey, digest: artifact.sha256 || artifact.sha1 || null });

      if (artifact.kind === 'hierarchy') {
        const parsed = parseHierarchy(bytes);
        const hierarchyProblems = hierarchyObservationProblems(parsed, run, receiptBinding.observation, gameMetadata, expectedApplicationPackage);
        if (hierarchyProblems.length) {
          counters.badContent++;
          record('hierarchy-observation-mismatch', `${attemptId}: ${label} — ${hierarchyProblems.join('; ')}`);
          return null;
        }
        if (receiptBinding.observation?.observedGameId === run.gameId) verifiedHierarchyIdentity = true;
      } else if (artifact.kind === 'tutorial-state') {
        const stateProblems = tutorialStateArtifactProblems(bytes, run);
        if (stateProblems.length) {
          counters.badContent++;
          record('tutorial-state-artifact-mismatch', `${attemptId}: ${label} — ${stateProblems.join('; ')}`);
          return null;
        }
      }

      // Digest reuse across DIFFERENT paths is reported, never failed: two
      // independently receipted captures may legitimately render identical
      // static frames. A shared canonical path remains invalid above.
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
      if (artifact.kind === 'screenshot' || artifact.kind === 'hierarchy') {
        meaningfulArtifacts++;
        runMeaningfulArtifacts++;
      }
      return { grade: res.grade, kind: artifact.kind || null, relative: resolved.relative };
    };

    // Observations -------------------------------------------------------
    const verifiedKinds = new Set();
    for (const o of run.observations || []) {
      if (!o || typeof o !== 'object') continue;
      const mandatory = observationRequiresArtifact(o);
      const label = `obs#${o.seq}${o.phase ? ` (${o.phase})` : ''}`;
      const ok = verifyOne(o.evidenceArtifact, label, mandatory, o);
      if (ok && ok.kind) verifiedKinds.add(ok.kind);
      const hierarchyOk = verifyOne(o.hierarchyArtifact, `${label} hierarchy`, false, o);
      if (hierarchyOk && hierarchyOk.kind) verifiedKinds.add(hierarchyOk.kind);
    }
    // Run-level artifacts -------------------------------------------------
    for (const a of run.artifacts || []) {
      if (!a || typeof a !== 'object') continue;
      const label = `artifact[${a.kind || 'unknown'}]`;
      const mandatory = a.mandatory === true;
      const ok = verifyOne(a, label, mandatory);
      if (ok && ok.kind) verifiedKinds.add(ok.kind);
    }
    if (run.tutorialStateArtifact && typeof run.tutorialStateArtifact === 'object') {
      const ok = verifyOne(run.tutorialStateArtifact, 'artifact[tutorial-state]', true);
      if (ok && ok.kind) verifiedKinds.add(ok.kind);
    }

    if (runMeaningfulArtifacts === 0 && runMeaningfulBindings === 0) {
      counters.noMeaningfulArtifact++;
      record('no-meaningful-artifact', `${attemptId}: no screenshot or hierarchy artifact is bound to this run`);
    } else if (runMeaningfulArtifacts === 0 && !absenceInRun && receiptIndex.present) {
      counters.noMeaningfulArtifact++;
      record('no-meaningful-artifact', `${attemptId}: no screenshot or hierarchy artifact was independently verified`);
    }

    // Capability-level artifact sufficiency (P1-C). A capability the contract
    // certifies must be backed by the kinds of artifact it requires. Only
    // checked when the run actually claims the capability, and only when the
    // artifacts were readable in this mode (otherwise absence is already
    // accounted for above).
    const axes = safeDeriveCapabilities(run);
    if (!absenceInRun && (axes?.identity?.status === 'VERIFIED' || axes?.gameplayEntered?.status === 'VERIFIED') && !verifiedHierarchyIdentity) {
      counters.capabilityUnbound++;
      record('identity-hierarchy-unbound', `${attemptId}: identity/gameplay is claimed but no verified hierarchy binds the observed game id to the requested game`);
    }
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
  if (!inputIsArray) verdict = VerificationVerdict.FAIL;
  else if (list.length === 0) verdict = VerificationVerdict.NO_EVIDENCE;
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
  const currentIdentityMatches = buildScope === BuildScope.SINGLE
    && mode !== EvidenceMode.SOURCE
    && gitShaShape(expectedGitSha)
    && sha256Shape(expectedApkSha256)
    && list.length > 0
    && list.every((run) => isRecord(run)
      && String(run.buildIdentity?.gitSha).toLowerCase() === expectedGitSha.toLowerCase()
      && String(run.buildIdentity?.apkSha256).toLowerCase() === expectedApkSha256.toLowerCase());
  const currentIdentityVerified = currentIdentityMatches && verdict === VerificationVerdict.PASS;

  return {
    verdict,
    strict,
    mode,
    buildScope,
    currentIdentityVerified,
    exitCode,
    runsInspected: list.length,
    buildsInspected: partitions.size,
    buildPartitions: buildPartitionReport,
    counters,
    findings,
    // Honest scope statement: what this result does and does not certify.
    scope: buildScope === BuildScope.SINGLE
      ? (currentIdentityMatches
        ? 'single build matches externally supplied expected source/APK identities'
        : 'mixed/undetermined or externally unbound/mismatched build — NOT current-revision certification')
      : 'multi-build archive — partitions verified independently; this does NOT describe the current application revision',
    certifiesNativeEvidence: certifiesNativeEvidence({ verdict, mode, buildScope, currentIdentityVerified }),
    meaningfulArtifacts,
    captureReceiptTrustBoundary: 'The supplied capture-receipts index binds unique artifact acquisitions to bytes, attempt, build, observation sequence, and exact observation timestamp. It is an auditable acquisition record, not cryptographic proof of native capture.',
    note: mode === EvidenceMode.PORTABLE
      ? 'portable mode: absent git-ignored native evidence is reported as NOT_VERIFIABLE, never as a pass and never as a false fail'
      : mode === EvidenceMode.SOURCE
        ? 'source mode: artifact presence is advisory; structure, binding and digests of present artifacts are still validated; a source pass is never native certification'
        : buildScope === BuildScope.ARCHIVE
          ? 'archive scope: partitions were checked, but this is explicitly non-current and non-certifying for the application revision'
          : 'local mode: mandatory artifacts and indexed capture receipts must exist and verify against externally expected source/APK identities',
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
