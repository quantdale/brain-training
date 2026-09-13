#!/usr/bin/env node
/**
 * validate-affected.mjs — risk-based affected-area validation entrypoint (WP-F).
 *
 * Accepts a list of changed paths and prints the required light-validation
 * checks per `.agent/IMPACT_MAP.md`, so agents/orchestrators know exactly what
 * to run after a change instead of guessing.
 *
 * The rule table below mirrors the "Affected-Area Validation Map" table in
 * `.agent/IMPACT_MAP.md`. `--check-sync` enforces that the table's backticked
 * path patterns and this script's `RULES` match exactly, so the two stay in
 * sync (CI runs it).
 *
 * Usage:
 *   node scripts/validate-affected.mjs <path> [path...]
 *   node scripts/validate-affected.mjs --list-areas [--json]
 *   node scripts/validate-affected.mjs --check-sync
 *   node scripts/validate-affected.mjs --json <path> [path...]
 *   node scripts/validate-affected.mjs --strict <path> [path...]   # exit 1 on unmatched paths
 *
 * Exit codes: 0 = ok, 1 = internal error (or unmatched under --strict),
 *             2 = usage error.
 *
 * NOTE: this script only prints the required checks; it never executes them.
 * The Android harness area is owned by task packet 001-d (scripts/android/**).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const IMPACT_MAP = path.join(ROOT, '.agent/IMPACT_MAP.md');

/**
 * Area rules. `match` entries are repo-root-relative globs (`**` crosses
 * directories, `*` and `?` stay inside one segment). A path maps to an area if
 * it matches any pattern directly, or if it is a directory prefix of a
 * pattern (so `apps/mobile/src/games` selects the game-module area).
 * `checks` are the concrete light-validation commands/activities required.
 */
const RULES = [
  {
    name: 'Android QA harness',
    impact: 'Android QA harness',
    match: ['scripts/android/**'],
    checks: [
      'Harness self-test (packet 001-d owns scripts/android/**)',
      'No-host-input proof; screenshot/log artifact check per docs/QA_ARTIFACTS.md',
    ],
  },
  {
    name: 'CI / scripts',
    impact: 'CI/scripts',
    match: ['.github/**', 'scripts/**', 'apps/mobile/scripts/**'],
    checks: [
      'node --check <script> / run the changed script locally where possible',
      'Parse workflow YAML locally (e.g. `node -e` with the yaml package)',
      'Final gate: GitHub Actions workflow run',
    ],
  },
  {
    name: 'app navigation / shell',
    impact: 'app navigation/shell',
    match: [
      'apps/mobile/src/app/**',
      'apps/mobile/src/components/app-tabs*.tsx',
      'apps/mobile/src/components/game-host/**',
    ],
    checks: [
      'cd apps/mobile && npm run typecheck',
      'cd apps/mobile && npm run test:ci',
      'App launch + navigation smoke (Home/Games/Progress/Profile tabs)',
    ],
  },
  {
    name: 'workout',
    impact: 'workout',
    match: ['apps/mobile/src/workout/**', 'apps/mobile/src/db/workout*.ts', 'apps/mobile/src/db/__tests__/workout*.ts'],
    checks: [
      'cd apps/mobile && npm run test:ci -- src/workout src/db/__tests__/workout --no-coverage',
      'cd apps/mobile && npm run typecheck',
      'Workout attribution/adversarial matrix if routing/ownership touched',
    ],
  },
  {
    name: 'personalization / mastery / spotlight',
    impact: 'personalization/mastery/spotlight',
    match: ['apps/mobile/src/personalization/**', 'apps/mobile/src/mastery/**', 'apps/mobile/src/spotlight/**'],
    checks: [
      'cd apps/mobile && npm run test:ci -- src/personalization src/mastery src/spotlight --no-coverage',
      'cd apps/mobile && npm run typecheck',
      'Determinism/repetition checks for personalized selection',
    ],
  },
  {
    name: 'sync / data-portability',
    impact: 'sync/data-portability',
    match: ['apps/mobile/src/sync/**', 'apps/mobile/src/data-portability/**', 'apps/mobile/src/persistence/**'],
    checks: [
      'cd apps/mobile && npm run test:ci -- src/sync src/data-portability --no-coverage',
      'cd apps/mobile && npm run typecheck',
      'Export/wipe/import round-trip smoke if envelope changed',
    ],
  },
  {
    name: 'content / registry / provenance',
    impact: 'content/registry/provenance',
    match: ['apps/mobile/src/content/**', 'apps/mobile/src/registry/**', 'apps/mobile/src/games/**/content/**', 'apps/mobile/src/games/**/registry/**', 'scripts/generate-game-registry.mjs', 'scripts/validate-provenance.mjs'],
    checks: [
      'cd apps/mobile && npm run test:ci -- src/content --no-coverage',
      'node scripts/generate-game-registry.mjs --check',
      'node scripts/validate-provenance.mjs (or provenance check)',
      'Content validation for affected packs (duplicate/ordering/tier checks)',
    ],
  },
  {
    name: 'OpenSpec / governance',
    impact: 'OpenSpec/governance',
    match: ['openspec/**', '.agent/**', 'AGENTS.md', 'docs/**', 'apps/mobile/src/governance/**'],
    checks: [
      'node scripts/validate-repo-state.mjs',
      'node scripts/validate-task-ownership.cjs',
      'npx --yes @fission-ai/openspec@1.6.0 validate --all',
      'Doc/reference consistency check (paths, commands, conventions cited in docs must exist)',
    ],
  },
  {
    name: 'SQLite / schema / migrations',
    impact: 'SQLite/schema/migrations',
    match: ['apps/mobile/src/db/**', 'apps/mobile/src/persistence/**', 'apps/mobile/src/storage/**'],
    checks: [
      'cd apps/mobile && npm run typecheck',
      'cd apps/mobile && npm run test:ci  # migration + persistence unit tests',
      'App launch + representative read/write smoke',
    ],
  },
  {
    name: 'Game SDK shared contracts',
    impact: 'Game SDK shared contracts',
    match: ['apps/mobile/src/sdk/**', 'apps/mobile/src/game-sdk/**'],
    checks: [
      'cd apps/mobile && npm run typecheck',
      'cd apps/mobile && npm run test:ci  # SDK unit/contract tests',
      'Representative canary game + app launch',
    ],
  },
  {
    name: 'individual game module',
    impact: 'individual game module',
    match: ['apps/mobile/src/games/**'],
    checks: [
      'cd apps/mobile && npm run typecheck',
      'cd apps/mobile && npm run test:ci  # game unit/contract tests',
      'Targeted emulator smoke for that game',
    ],
  },
  {
    name: 'scoring / rating',
    impact: 'scoring/rating',
    match: ['apps/mobile/src/scoring/**', 'apps/mobile/src/rating/**'],
    checks: [
      'cd apps/mobile && npm run test:ci  # normalization/rating unit tests, fixed seeds',
      'Regression samples / fixture comparisons',
    ],
  },
  {
    name: 'currency / progression',
    impact: 'currency/progression',
    match: ['apps/mobile/src/currency/**', 'apps/mobile/src/progression/**', 'apps/mobile/src/ledger/**'],
    checks: [
      'cd apps/mobile && npm run test:ci  # transaction-ledger/progression tests',
      'Persistence reload smoke',
    ],
  },
  {
    name: 'visual / design-system shared layer',
    impact: 'visual/design-system shared layer',
    match: ['apps/mobile/src/components/ui/**', 'apps/mobile/src/constants/theme.ts', 'apps/mobile/src/design/**'],
    checks: [
      'cd apps/mobile && npm run typecheck',
      'Affected screenshots + representative canary screens',
    ],
  },
  {
    name: 'package manifest / lockfile',
    impact: 'package manifest/lockfile',
    match: ['apps/mobile/package.json', 'apps/mobile/package-lock.json'],
    checks: [
      'cd apps/mobile && npm ci  # clean dependency install',
      'node scripts/validate-repo-state.mjs',
      'cd apps/mobile && npm run typecheck',
    ],
  },
];

/** Convert a glob to an anchored RegExp. `**` crosses directories. */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i++;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$+{}()|.[]'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

const compiled = RULES.map((rule) => ({
  ...rule,
  patterns: rule.match.map((m) => {
    // Patterns ending in `/**` also select the directory itself.
    const isTree = m.endsWith('/**');
    const core = isTree ? m.slice(0, -3) : m;
    return {
      re: globToRegExp(m),
      prefix: isTree ? core : null,
    };
  }),
}));

/** Normalize a user-supplied path: forward slashes, no leading ./ , no trailing /. */
function normalizeInput(p) {
  let s = p.replaceAll('\\', '/');
  while (s.startsWith('./')) s = s.slice(2);
  while (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

function matchesRule(rule, normPath) {
  for (const pat of rule.patterns) {
    if (pat.re.test(normPath)) return true;
    if (pat.prefix !== null && (normPath === pat.prefix || normPath.startsWith(pat.prefix + '/'))) return true;
  }
  return false;
}

/**
 * Parse the IMPACT_MAP.md table: one entry per data row with the backticked
 * path patterns from the first column (the human-readable mirror of RULES).
 */
function impactMapRows() {
  if (!fs.existsSync(IMPACT_MAP)) return null;
  const lines = fs.readFileSync(IMPACT_MAP, 'utf8').split(/\r?\n/);
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      if (!inTable) {
        inTable = true;
        continue; // header row
      }
      if (/^\s*\|[\s\-:|]+\|\s*$/.test(line)) continue; // separator row
      const firstCell = (line.split('|')[1] ?? '').trim();
      const patterns = [...firstCell.matchAll(/`([^`]+)`/g)]
        .map((m) => m[1].trim())
        .filter((t) => /[*?]|\//.test(t) || /^[A-Za-z0-9_.-]+\.[a-z]+$/.test(t));
      rows.push({ label: firstCell, patterns });
    } else {
      inTable = false;
    }
  }
  return rows;
}

/**
 * Content-level drift check: the pattern set in the table must equal the set
 * of RULES match patterns (neither may add, drop, or rename a pattern).
 */
function syncIssues() {
  const rows = impactMapRows();
  if (rows === null) return ['WARNING: .agent/IMPACT_MAP.md not found — cannot check table sync.'];
  const issues = [];
  if (rows.length !== RULES.length) {
    issues.push(`WARNING: .agent/IMPACT_MAP.md lists ${rows.length} affected areas but validate-affected.mjs defines ${RULES.length}.`);
  }
  const rulePatterns = new Set(RULES.flatMap((r) => r.match));
  const mapPatterns = new Set(rows.flatMap((r) => r.patterns));
  const missingFromMap = [...rulePatterns].filter((p) => !mapPatterns.has(p));
  const missingFromRules = [...mapPatterns].filter((p) => !rulePatterns.has(p));
  if (missingFromMap.length) issues.push(`WARNING: RULES patterns missing from IMPACT_MAP.md: ${missingFromMap.join(', ')}`);
  if (missingFromRules.length) issues.push(`WARNING: IMPACT_MAP.md patterns missing from RULES: ${missingFromRules.join(', ')}`);
  return issues;
}

function syncWarning() {
  const issues = syncIssues();
  return issues.length ? issues.join('\n') : null;
}

function buildPlan(changedPaths) {
  const norm = changedPaths.map(normalizeInput).filter(Boolean);
  const matched = new Map(); // area name -> {rule, paths: []}
  const unmatched = [];
  for (const p of norm) {
    let found = false;
    for (const rule of compiled) {
      if (matchesRule(rule, p)) {
        found = true;
        if (!matched.has(rule.name)) matched.set(rule.name, { name: rule.name, impact: rule.impact, checks: rule.checks, paths: [] });
        matched.get(rule.name).paths.push(p);
      }
    }
    if (!found) unmatched.push(p);
  }
  return {
    changedPaths: norm,
    areas: [...matched.values()],
    unmatched,
    syncWarning: null,
  };
}

function printHuman(plan, opts) {
  console.log('Affected-area validation plan');
  console.log('============================');
  console.log(`Changed paths (${plan.changedPaths.length}):`);
  for (const p of plan.changedPaths) console.log(`  - ${p}`);
  console.log('');
  if (plan.areas.length === 0) {
    console.log('No areas matched.');
  } else {
    console.log(`Matched areas (${plan.areas.length}):`);
    plan.areas.forEach((a, i) => {
      console.log(`  [${i + 1}] ${a.name}  (impact: ${a.impact})`);
      for (const c of a.checks) console.log(`      - ${c}`);
    });
  }
  console.log('');
  console.log(`Unmatched paths (${plan.unmatched.length}):`);
  if (plan.unmatched.length === 0) console.log('  (none)');
  for (const u of plan.unmatched) console.log(`  - ${u}  <-- no area rule matches; review manually`);
  console.log('');
  if (plan.syncWarning) console.log(plan.syncWarning);
  console.log('Notes: checks are advisory light validation; full stress/broad validation belongs to explicit hardening campaigns.');
}

function printUsage() {
  console.log(`Usage:
  node scripts/validate-affected.mjs <path> [path...]   print required checks for changed paths
  node scripts/validate-affected.mjs --list-areas [--json]  list all known areas and their patterns
  node scripts/validate-affected.mjs --check-sync       exit 1 if IMPACT_MAP.md patterns drift from RULES
  node scripts/validate-affected.mjs --json <path...>   machine-readable output
  node scripts/validate-affected.mjs --strict <path...> exit 1 if any path matches no area
  node scripts/validate-affected.mjs --help`);
}

const args = process.argv.slice(2);
const opts = { json: false, strict: false, list: false, checkSync: false };
const paths = [];
for (const a of args) {
  if (a === '--json') opts.json = true;
  else if (a === '--strict') opts.strict = true;
  else if (a === '--list-areas') opts.list = true;
  else if (a === '--check-sync') opts.checkSync = true;
  else if (a === '--help') { printUsage(); process.exit(0); }
  else paths.push(a);
}

if (opts.list) {
  if (opts.json) {
    console.log(JSON.stringify({ version: 1, areas: RULES.map((r) => ({ name: r.name, impact: r.impact, match: r.match })), syncIssues: syncIssues() }, null, 2));
  } else {
    for (const rule of RULES) console.log(`${rule.name}\t${rule.match.join(', ')}`);
    const w = syncWarning();
    console.log(w ? `\n${w}` : '\nIMPACT_MAP sync: OK');
  }
  process.exit(0);
}

if (opts.checkSync) {
  const issues = syncIssues();
  if (issues.length) {
    for (const issue of issues) console.error(issue);
    process.exit(1);
  }
  console.log(`IMPACT_MAP sync: OK (${RULES.length} areas, ${RULES.flatMap((r) => r.match).length} patterns)`);
  process.exit(0);
}

if (paths.length === 0) {
  printUsage();
  process.exit(2);
}

const plan = buildPlan(paths);
plan.syncWarning = syncWarning();

if (opts.json) {
  console.log(JSON.stringify({ version: 1, ...plan, strict: opts.strict, ok: !(opts.strict && plan.unmatched.length > 0) }, null, 2));
} else {
  printHuman(plan, opts);
}

process.exit(opts.strict && plan.unmatched.length > 0 ? 1 : 0);
