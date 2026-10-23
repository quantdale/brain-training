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
const RFC3339_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

/** Accept only a full RFC-3339 timestamp with timezone, not Date.parse coercions. */
export function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = RFC3339_TIMESTAMP.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth;
}

/** Read the checked-in game modules as the authoritative metadata registry. */
export function loadEvidenceGameMetadata() {
  const dir = path.join(ROOT, 'apps/mobile/src/games');
  const metadataById = new Map();
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name, 'game.json');
    if (!fs.existsSync(file)) continue;
    const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!hasText(metadata?.id) || metadataById.has(metadata.id)) {
      throw new Error(`invalid or duplicate authoritative game id in ${file}`);
    }
    metadataById.set(metadata.id, metadata);
  }
  if (metadataById.size === 0) throw new Error('authoritative game registry is empty');
  return metadataById;
}

/** Game ids remain available to contract callers that need membership only. */
export function loadEvidenceGameRegistry() {
  return new Set(loadEvidenceGameMetadata().keys());
}

/** Read the actual Android package from the Expo application config. */
export function loadExpectedApplicationPackage() {
  const file = path.join(ROOT, 'apps/mobile/app.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const packageName = config?.expo?.android?.package;
  if (!hasText(packageName)) throw new Error(`Android package is missing from ${file}`);
  return packageName;
}

/**
 * Validate untrusted run shape before any contract derivation can iterate it.
 * Every malformed collection/member is an error; no caller may filter it away.
 */
export function validateEvidenceRun(run, knownGames, metadataById = null) {
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

  if (metadataById instanceof Map) {
    const metadata = metadataById.get(run.gameId);
    if (!metadata) errors.push(`unknown game id '${run.gameId}' has no authoritative game metadata`);
    else if (typeof metadata.hasTutorial !== 'boolean') errors.push(`authoritative metadata for '${run.gameId}' has no boolean hasTutorial`);
    else if (run.hasTutorial !== metadata.hasTutorial) errors.push(`hasTutorial claim ${String(run.hasTutorial)} does not match authoritative metadata ${metadata.hasTutorial}`);
    if (run.tutorialState !== undefined && run.tutorialState !== null) {
      const artifact = run.tutorialStateArtifact;
      if (!isRecord(artifact) || artifact.kind !== 'tutorial-state' || !hasText(artifact.file) || !/^[a-f0-9]{64}$/i.test(artifact.sha256 || '')) {
        errors.push('tutorialState claim requires a bound tutorial-state JSON artifact');
      }
    } else if (run.tutorialStateArtifact !== undefined && run.tutorialStateArtifact !== null
        && (!isRecord(run.tutorialStateArtifact) || run.tutorialStateArtifact.kind !== 'tutorial-state')) {
      errors.push('tutorialStateArtifact must have kind tutorial-state');
    }
  }

  for (const field of ['startedAt', 'endedAt']) {
    if (run[field] !== undefined && run[field] !== null && !isIsoTimestamp(run[field])) {
      errors.push(`${field} must be an ISO-8601/RFC-3339 timestamp with timezone`);
    }
  }
  if (Array.isArray(run.events)) {
    for (const [index, event] of run.events.entries()) {
      if (isRecord(event) && !isIsoTimestamp(event.timestamp)) {
        errors.push(`events[${index}].timestamp must be an ISO-8601/RFC-3339 timestamp with timezone`);
      }
    }
  }
  if (Array.isArray(run.observations)) {
    for (const [index, observation] of run.observations.entries()) {
      if (!isRecord(observation)) continue;
      if (!isIsoTimestamp(observation.timestamp)) {
        errors.push(`observations[${index}].timestamp must be an ISO-8601/RFC-3339 timestamp with timezone`);
      }
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
