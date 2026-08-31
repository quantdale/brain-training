#!/usr/bin/env node
/**
 * Provenance drift validator (006R task 2.6).
 *
 * Detects when generator/content files change without a corresponding version
 * bump. For each game, tracks which files affect challenge identity and
 * requires a version bump when those files change.
 *
 * Usage: node scripts/validate-provenance.mjs [--check] [--json]
 *   --check  exit 1 if drift detected (default: report only)
 *   --json   output JSON instead of human-readable text
 *
 * Allowlist: files listed in `.agent/provenance-allowlist.json` are excluded
 * from drift detection (for non-semantic edits like comments, formatting).
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = join(REPO_ROOT, 'apps', 'mobile', 'src', 'games');
const ALLOWLIST_PATH = join(REPO_ROOT, '.agent', 'provenance-allowlist.json');

/**
 * Files that affect challenge identity for each game type.
 * Procedural: generator.ts
 * Curated: content-validation.ts, content/pack.json, content/*.ts
 * Hybrid: generator.ts, content/*.ts
 */
const CHALLENGE_IDENTITY_PATTERNS = {
  // All games have a generator
  generator: 'generator.ts',
  // Games with content banks have these
  contentPack: 'content/pack.json',
  contentBank: /^content\/.+\.ts$/,
  contentValidation: 'content-validation.ts',
};

/**
 * Load the allowlist (non-semantic edits that don't require a version bump).
 * Entries without a future expiry are deliberately ignored later, so a
 * legacy/permanent exemption cannot become a silent bypass.
 */
function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('allowlist root must be an object');
    }
    return parsed;
  } catch (error) {
    console.error(
      `provenance validator: failed to parse ${ALLOWLIST_PATH}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

/** Get files changed since a base commit. */
function getChangedFiles(baseRef = 'origin/main') {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${baseRef}^{commit}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output = execFileSync('git', ['diff', '--name-only', baseRef, '--'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, files: output.trim().split('\n').filter(Boolean) };
  } catch (error) {
    return {
      ok: false,
      files: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Read a path from a validated git base without invoking a shell. */
function readBaseFile(baseRef, filePath) {
  try {
    return execFileSync('git', ['show', `${baseRef}:${filePath}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

/** Check if a file matches a challenge identity pattern. */
function isChallengeIdentityFile(filePath, gameId) {
  const relativePath = filePath.replace(`src/games/${gameId}/`, '');
  
  if (relativePath === CHALLENGE_IDENTITY_PATTERNS.generator) {
    return true;
  }
  if (relativePath === CHALLENGE_IDENTITY_PATTERNS.contentPack) {
    return true;
  }
  if (CHALLENGE_IDENTITY_PATTERNS.contentBank.test(relativePath)) {
    return true;
  }
  if (relativePath === CHALLENGE_IDENTITY_PATTERNS.contentValidation) {
    return true;
  }
  return false;
}

function parseSemver(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareSemver(a, b) {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) return null;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

/** Get version info for a game from the current checkout or a base snapshot. */
function getGameVersions(gameId, source = 'current', baseRef = null) {
  const gameJsonPath = join(GAMES_DIR, gameId, 'game.json');
  const versionsPath = join(GAMES_DIR, gameId, 'versions.ts');

  const gameJsonText =
    source === 'current'
      ? existsSync(gameJsonPath)
        ? readFileSync(gameJsonPath, 'utf8')
        : null
      : readBaseFile(baseRef, `apps/mobile/src/games/${gameId}/game.json`);
  const versionsText =
    source === 'current'
      ? existsSync(versionsPath)
        ? readFileSync(versionsPath, 'utf8')
        : null
      : readBaseFile(baseRef, `apps/mobile/src/games/${gameId}/versions.ts`);

  if (gameJsonText === null || versionsText === null) return null;

  let gameJson;
  try {
    gameJson = JSON.parse(gameJsonText);
  } catch {
    return null;
  }
  if (!gameJson || typeof gameJson !== 'object' || Array.isArray(gameJson)) {
    return null;
  }

  const gameVersion = gameJson.gameVersion;
  const generatorVersion = gameJson.generatorVersion;
  const contentVersion = gameJson.contentVersion;
  const scoringMatch = versionsText.match(/SCORING_VERSION\s*=\s*['"]([^'"]+)['"]/);
  const scoringVersion = scoringMatch?.[1] ?? null;
  if (
    !parseSemver(gameVersion) ||
    !parseSemver(generatorVersion) ||
    (contentVersion !== null && !parseSemver(contentVersion)) ||
    !parseSemver(scoringVersion)
  ) {
    return null;
  }

  return { gameVersion, generatorVersion, contentVersion, scoringVersion };
}

/** Whether a temporary allowlist entry is currently valid. */
function isValidAllowlistEntry(entry, now = new Date()) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  if (typeof entry.reason !== 'string' || entry.reason.trim() === '') return false;
  if (typeof entry.expires !== 'string') return false;
  const expiry = new Date(entry.expires);
  return Number.isFinite(expiry.getTime()) && expiry > now;
}

/** Main validation logic. */
function validate(baseRef = process.env.PROVENANCE_BASE_REF || 'origin/main') {
  const allowlist = loadAllowlist();
  if (allowlist === null) {
    return { valid: false, drifts: [], message: 'Allowlist is malformed or unreadable' };
  }

  const changed = getChangedFiles(baseRef);
  if (!changed.ok) {
    return {
      valid: false,
      drifts: [],
      message: `Unable to resolve provenance base ${JSON.stringify(baseRef)}: ${changed.error}`,
    };
  }
  if (changed.files.length === 0) {
    return { valid: true, drifts: [], message: 'No changed files detected', baseRef };
  }
  
  // Group changed files by game
  const changedByGame = {};
  for (const file of changed.files) {
    const match = file.match(/^apps\/mobile\/src\/games\/([^/]+)\//);
    if (match) {
      const gameId = match[1];
      if (!changedByGame[gameId]) {
        changedByGame[gameId] = [];
      }
      changedByGame[gameId].push(file);
    }
  }
  
  const drifts = [];
  const now = new Date();

  for (const [gameId, files] of Object.entries(changedByGame)) {
    // Check if any challenge identity files changed
    const challengeFiles = files.filter(f => isChallengeIdentityFile(f, gameId));
    if (challengeFiles.length === 0) continue;

    const versions = getGameVersions(gameId, 'current');
    const baseVersions = getGameVersions(gameId, 'base', baseRef);
    if (!versions) {
      drifts.push({
        gameId,
        files: challengeFiles,
        currentVersions: null,
        baseVersions,
        needsGeneratorBump: false,
        needsContentBump: false,
        reason: 'Current game version metadata is missing or malformed',
      });
      continue;
    }

    // Permanent/malformed allowlist entries are treated as absent.
    const unlistedFiles = challengeFiles.filter(
      f => !isValidAllowlistEntry(allowlist[f], now),
    );
    if (unlistedFiles.length === 0) continue;

    const hasGeneratorChange = unlistedFiles.some(f => f.endsWith('generator.ts'));
    const hasContentChange = unlistedFiles.some(f =>
      f.includes('content/') || f.endsWith('content-validation.ts')
    );

    const generatorComparison = baseVersions
      ? compareSemver(versions.generatorVersion, baseVersions.generatorVersion)
      : null;
    const contentComparison =
      baseVersions && versions.contentVersion !== null && baseVersions.contentVersion !== null
        ? compareSemver(versions.contentVersion, baseVersions.contentVersion)
        : null;
    const needsGeneratorBump =
      hasGeneratorChange &&
      (!baseVersions || generatorComparison === null || generatorComparison <= 0);
    const needsContentBump =
      hasContentChange &&
      (versions.contentVersion === null ||
        !baseVersions ||
        baseVersions.contentVersion === null ||
        contentComparison === null ||
        contentComparison <= 0);

    if (needsGeneratorBump || needsContentBump) {
      drifts.push({
        gameId,
        files: unlistedFiles,
        currentVersions: versions,
        baseVersions,
        needsGeneratorBump,
        needsContentBump,
        reason: baseVersions
          ? 'Challenge identity changed without a strictly increasing version'
          : 'Challenge identity file is new or its base version metadata is unavailable',
      });
    }
  }
  
  return {
    valid: drifts.length === 0,
    drifts,
    message: drifts.length === 0
      ? 'No provenance drift detected'
      : `Found ${drifts.length} game(s) with challenge identity changes without version bump`,
    baseRef,
  };
}

/** Generate allowlist template for current state. */
function generateAllowlist() {
  const allowlist = {};
  const gameDirs = existsSync(GAMES_DIR) ? 
    readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name) : [];
  
  const addedAt = new Date().toISOString();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  for (const gameId of gameDirs) {
    const gameDir = join(GAMES_DIR, gameId);
    const files = [
      join(gameDir, 'generator.ts'),
      join(gameDir, 'content', 'pack.json'),
      join(gameDir, 'content-validation.ts'),
    ];
    
    for (const file of files) {
      if (existsSync(file)) {
        // Repo-relative forward-slash key so it matches git's relative paths on both Windows and Unix
        const relativePath = relative(REPO_ROOT, file).split(sep).join('/');
        allowlist[relativePath] = {
          reason: 'Temporary non-semantic edit; replace with a version bump before expiry',
          addedAt,
          expires,
        };
      }
    }
  }
  
  return allowlist;
}

// CLI
const checkOnly = process.argv.includes('--check');
const jsonOutput = process.argv.includes('--json');
const generateMode = process.argv.includes('--generate-allowlist');
const baseArg = process.argv.find(arg => arg.startsWith('--base='));
const baseRef = baseArg ? baseArg.slice('--base='.length) : undefined;

if (generateMode) {
  const allowlist = generateAllowlist();
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(allowlist, null, 2));
  console.log(`provenance validator: wrote ${ALLOWLIST_PATH}`);
  process.exit(0);
}

const result = validate(baseRef);

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  if (result.valid) {
    console.log(`provenance validator: ${result.message}`);
  } else {
    console.error(`provenance validator: ${result.message}`);
    for (const drift of result.drifts) {
      console.error(`  ${drift.gameId}:`);
      console.error(`    Changed files: ${drift.files.join(', ')}`);
      if (drift.needsGeneratorBump) {
        console.error(`    Generator version bump needed (current: ${drift.currentVersions.generatorVersion})`);
      }
      if (drift.needsContentBump) {
        console.error(`    Content version bump needed (current: ${drift.currentVersions.contentVersion})`);
      }
      if (drift.reason) {
        console.error(`    ${drift.reason}`);
      }
    }
  }
}

if (checkOnly && !result.valid) {
  process.exit(1);
}
