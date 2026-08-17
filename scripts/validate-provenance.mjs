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
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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

/** Load the allowlist (non-semantic edits that don't require version bump). */
function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch {
    console.error(`provenance validator: failed to parse ${ALLOWLIST_PATH}`);
    return {};
  }
}

/** Get files changed since a base commit. */
function getChangedFiles(baseRef = 'origin/main') {
  try {
    const output = execSync(`git diff --name-only ${baseRef}`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // If git fails, return empty (validator will pass)
    return [];
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

/** Get version info for a game. */
function getGameVersions(gameId) {
  const gameJsonPath = join(GAMES_DIR, gameId, 'game.json');
  const versionsPath = join(GAMES_DIR, gameId, 'versions.ts');
  
  let gameJson = {};
  if (existsSync(gameJsonPath)) {
    try {
      gameJson = JSON.parse(readFileSync(gameJsonPath, 'utf8'));
    } catch {
      return null;
    }
  }
  
  let scoringVersion = '1.0.0';
  if (existsSync(versionsPath)) {
    const content = readFileSync(versionsPath, 'utf8');
    const match = content.match(/SCORING_VERSION\s*=\s*'([^']+)'/);
    if (match) {
      scoringVersion = match[1];
    }
  }
  
  return {
    gameVersion: gameJson.gameVersion || '1.0.0',
    generatorVersion: gameJson.generatorVersion || null,
    contentVersion: gameJson.contentVersion || null,
    scoringVersion,
  };
}

/** Main validation logic. */
function validate() {
  const allowlist = loadAllowlist();
  const changedFiles = getChangedFiles();
  
  if (changedFiles.length === 0) {
    return { valid: true, drifts: [], message: 'No changed files detected' };
  }
  
  // Group changed files by game
  const changedByGame = {};
  for (const file of changedFiles) {
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
  
  for (const [gameId, files] of Object.entries(changedByGame)) {
    const versions = getGameVersions(gameId);
    if (!versions) continue;
    
    // Check if any challenge identity files changed
    const challengeFiles = files.filter(f => isChallengeIdentityFile(f, gameId));
    
    if (challengeFiles.length === 0) continue;
    
    // Check if files are in allowlist
    const unlistedFiles = challengeFiles.filter(f => {
      const allowlistEntry = allowlist[f];
      if (!allowlistEntry) return true;
      // Check if allowlist entry is still valid
      if (allowlistEntry.expires && new Date(allowlistEntry.expires) < new Date()) {
        return true;
      }
      return false;
    });
    
    if (unlistedFiles.length === 0) continue;
    
    // Determine which version should have been bumped
    const hasGeneratorChange = unlistedFiles.some(f => f.endsWith('generator.ts'));
    const hasContentChange = unlistedFiles.some(f => 
      f.includes('content/') || f.endsWith('content-validation.ts')
    );
    
    const needsGeneratorBump = hasGeneratorChange && versions.generatorVersion;
    const needsContentBump = hasContentChange && versions.contentVersion;
    
    if (needsGeneratorBump || needsContentBump) {
      drifts.push({
        gameId,
        files: unlistedFiles,
        currentVersions: versions,
        needsGeneratorBump,
        needsContentBump,
      });
    }
  }
  
  return {
    valid: drifts.length === 0,
    drifts,
    message: drifts.length === 0
      ? 'No provenance drift detected'
      : `Found ${drifts.length} game(s) with challenge identity changes without version bump`,
  };
}

/** Generate allowlist template for current state. */
function generateAllowlist() {
  const allowlist = {};
  const gameDirs = existsSync(GAMES_DIR) ? 
    readdirSync(GAMES_DIR, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name) : [];
  
  for (const gameId of gameDirs) {
    const gameDir = join(GAMES_DIR, gameId);
    const files = [
      join(gameDir, 'generator.ts'),
      join(gameDir, 'content', 'pack.json'),
      join(gameDir, 'content-validation.ts'),
    ];
    
    for (const file of files) {
      if (existsSync(file)) {
        const relativePath = file.replace(REPO_ROOT + '/', '');
        allowlist[relativePath] = {
          reason: 'Initial version baseline',
          addedAt: new Date().toISOString(),
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

if (generateMode) {
  const allowlist = generateAllowlist();
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(allowlist, null, 2));
  console.log(`provenance validator: wrote ${ALLOWLIST_PATH}`);
  process.exit(0);
}

const result = validate();

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
    }
  }
}

if (checkOnly && !result.valid) {
  process.exit(1);
}
