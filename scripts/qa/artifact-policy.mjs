/** Shared fail-closed input, registry, and historical-quarantine policy. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArtifactKind, validateRunRecord } from './coverage-contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const artifactKinds = new Set(Object.values(ArtifactKind));
const HISTORICAL_LEDGER = /^native-coverage-ledger(?:-v([1-7]))?\.json$/i;

/** Read the checked-in game modules as the authoritative game-id registry. */
export function loadEvidenceGameRegistry() {
  const dir = path.join(ROOT, 'apps/mobile/src/games');
  const ids = new Set();
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name, 'game.json');
    if (!fs.existsSync(file)) continue;
    const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!hasText(metadata?.id) || ids.has(metadata.id)) {
      throw new Error(`invalid or duplicate authoritative game id in ${file}`);
    }
    ids.add(metadata.id);
  }
  if (ids.size === 0) throw new Error('authoritative game registry is empty');
  return ids;
}

/**
 * Validate untrusted run shape before any contract derivation can iterate it.
 * Every malformed collection/member is an error; no caller may filter it away.
 */
export function validateEvidenceRun(run, knownGames) {
  const errors = [];
  if (!isRecord(run)) return { valid: false, errors: ['run must be an object (not null, array, or primitive)'] };

  for (const field of ['buildIdentity', 'deviceProfile']) {
    if (!isRecord(run[field])) {
      errors.push(`${field} must be an object`);
      continue;
    }
    for (const [key, value] of Object.entries(run[field])) {
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
        errors.push(`${field}.${key} must be scalar`);
      }
    }
  }

  for (const field of ['events', 'observations']) {
    if (!Array.isArray(run[field])) {
      errors.push(`${field} must be an array`);
      continue;
    }
    for (const [index, entry] of run[field].entries()) {
      if (!isRecord(entry)) errors.push(`${field}[${index}] must be an object`);
    }
  }
  if (run.artifacts !== undefined) {
    if (!Array.isArray(run.artifacts)) errors.push('artifacts must be an array when present');
    else for (const [index, entry] of run.artifacts.entries()) {
      if (!isRecord(entry)) errors.push(`artifacts[${index}] must be an object`);
      else if (!artifactKinds.has(entry.kind)) errors.push(`artifacts[${index}].kind must be a known artifact kind`);
    }
  }

  if (Array.isArray(run.observations)) {
    for (const [index, observation] of run.observations.entries()) {
      if (!isRecord(observation)) continue;
      for (const field of ['controls', 'screenMarkers', 'boardValues']) {
        const values = observation[field];
        if ((field === 'controls' || values !== undefined)
            && (!Array.isArray(values) || values.some((value) => typeof value !== 'string'))) {
          errors.push(`observations[${index}].${field} must be a string array`);
        }
      }
      if (observation.evidenceArtifact !== undefined && observation.evidenceArtifact !== null) {
        if (!isRecord(observation.evidenceArtifact)) {
          errors.push(`observations[${index}].evidenceArtifact must be an object or null`);
        } else if (!artifactKinds.has(observation.evidenceArtifact.kind)) {
          errors.push(`observations[${index}].evidenceArtifact.kind must be a known artifact kind`);
        }
      }
    }
  }

  if (errors.length) return { valid: false, safeToDerive: false, errors };
  if (!(knownGames instanceof Set) || knownGames.size === 0) {
    return { valid: false, safeToDerive: false, errors: ['authoritative game registry unavailable; no native certification'] };
  }
  const validation = validateRunRecord(run, { knownGames, evidenceMode: 'portable' });
  return { ...validation, errors: [...validation.errors], valid: validation.valid, safeToDerive: true };
}

// Pre-isolation evidence was overwritten by later attempts. Retain the original
// run fingerprints so renamed copies cannot evade the v1-v7 quarantine. Newer
// ledgers are never trusted by version number; they still pass every validator.
let quarantinedRunHashes;
let quarantinedAttemptIds;
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function quarantineHashes() {
  if (quarantinedRunHashes) return quarantinedRunHashes;
  quarantinedRunHashes = new Set();
  quarantinedAttemptIds = new Set();
  const files = [path.join(ROOT, 'scripts/qa/native-coverage-ledger.json')];
  for (let version = 1; version <= 7; version++) {
    files.push(path.join(ROOT, `scripts/qa/native-coverage-ledger-v${version}.json`));
  }
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const runs = Array.isArray(doc) ? doc : Array.isArray(doc?.runs) ? doc.runs : [];
    for (const run of runs) {
      if (!isRecord(run)) continue;
      quarantinedRunHashes.add(digest(run));
      if (hasText(run.executionAttemptId)) quarantinedAttemptIds.add(run.executionAttemptId);
    }
  }
  return quarantinedRunHashes;
}

export function isQuarantinedRun(run) {
  if (!isRecord(run)) return false;
  const clean = Object.fromEntries(Object.entries(run).filter(([key]) => !key.startsWith('_source')));
  if (run.quarantined === true || run._quarantined === true || run.evidenceSource === 'quarantined') return true;
  try {
    const hashes = quarantineHashes();
    return quarantinedAttemptIds.has(run.executionAttemptId) || hashes.has(digest(clean));
  } catch { return false; }
}

export function isQuarantinedLedger(file, doc) {
  return HISTORICAL_LEDGER.test(path.basename(file))
    || doc?.quarantined === true
    || doc?.evidenceSource === 'quarantined';
}
