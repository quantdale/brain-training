#!/usr/bin/env node
/**
 * validate-cli-contracts.mjs — validator CLI compatibility gate (Campaign 079).
 *
 * Catches the d26cd536 regression class end to end: a command-line option that
 * is documented in usage text or invoked by GitHub Actions but rejected (or
 * silently ignored) by the invoked script's own argument parser. Three sources
 * must agree for every gate script:
 *
 *   1. documented flags  — usage text in the header comment and `console.*`
 *                          usage blocks (what a human is told works)
 *   2. recognized flags  — literals used in actual parser comparisons
 *                          (`=== '--x'`, `.includes('--x')`, `.has('--x')`,
 *                          `.startsWith('--x=')`) (what the parser accepts)
 *   3. CI-invoked flags  — `node scripts/...` command lines inside
 *                          .github/workflows/*.yml (what CI actually runs)
 *
 * Invariants (exit 1 on violation, exit 2 when the gate cannot run):
 *   - every documented flag is recognized by the parser
 *   - every CI-invoked flag is recognized by the parser
 *   - every CI-invoked script path exists
 *   - every registered script rejects an unknown option with usage + exit 2
 *   - every registered script rejects a stray positional argument with
 *     usage + exit 2 unless it accepts positionals by contract
 *   - registered positive probes (cheap, offline) succeed
 *   - validate-affected.mjs keeps its documented flag/exit contract exactly
 *     (the script whose parser regression reddened Repository Integrity)
 *
 * The recognized-flag extraction is deliberately syntax-shaped rather than
 * literal-scraping: a flag that only appears inside a usage string must NOT
 * count as recognized, or the d26cd536 defect would pass this gate.
 *
 * Usage:
 *   node scripts/certification/validate-cli-contracts.mjs [--self-test] [--json]
 *     --self-test   offline fixture self-test of the extraction/matching logic
 *     --json        print the workflow-to-script compatibility matrix as JSON
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const INVALID_FLAG = '--__definitely_invalid__';
const INVALID_POSITIONAL = 'definitely-invalid-positional';

/**
 * Gate scripts under contract. `positiveProbes` must be offline and cheap;
 * self-tests here complement (never replace) the repository's own gate steps.
 */
const REGISTRY = [
  {
    script: 'scripts/validate-affected.mjs',
    acceptsPositionals: true, // <path...> plan mode
    positiveProbes: ['--help', '--self-test', '--check-sync', '--list-areas'],
    // Regression subject (d26cd536): exact documented contract is pinned.
    contractProbes: [
      { args: ['--self-test', '--check-sync'], exit: 0, note: 'documented precedence: --self-test is terminal and wins' },
      { args: ['--self-test'], exit: 0, note: 'F-6 regression: documented --self-test must reach its handler' },
      { args: [], exit: 2, note: 'no invocation shape prints usage + exit 2' },
    ],
  },
  {
    script: 'scripts/validate-task-ownership.cjs',
    acceptsPositionals: true, // optional [<task-ownership.json>] config path
    positiveProbes: [],
  },
  {
    script: 'scripts/validate-repo-state.mjs',
    positiveProbes: [],
  },
  {
    script: 'scripts/certification/validate-jest-signal.mjs',
    positiveProbes: ['--self-test'],
  },
  {
    script: 'scripts/certification/certify-clean-checkout.mjs',
    positiveProbes: ['--self-test'],
  },
  {
    script: 'scripts/validate-dependency-audit.mjs',
    positiveProbes: ['--self-test'],
  },
  {
    script: 'scripts/validate-expo-alignment.mjs',
    positiveProbes: ['--self-test'],
  },
  {
    script: 'scripts/validate-offline.mjs',
    positiveProbes: ['--help', '--self-test'],
  },
  {
    script: 'scripts/validate-provenance.mjs',
    positiveProbes: ['--self-test'],
  },
  {
    script: 'scripts/validate-secrets.mjs',
    positiveProbes: ['--self-test'],
  },
  {
    script: 'scripts/validate-workflows.mjs',
    positiveProbes: ['--self-test'],
  },
  {
    script: 'scripts/generate-game-registry.mjs',
    positiveProbes: ['--self-check'],
  },
  {
    script: 'scripts/generate-spec-store.mjs',
    positiveProbes: [],
  },
  {
    script: 'scripts/qa/validate-runtime-qa-contract.mjs',
    positiveProbes: ['--self-test'],
  },
  {
    script: 'scripts/certification/validate-cli-contracts.mjs',
    positiveProbes: ['--self-test'],
  },
];

const FLAG_RE = /--[a-z0-9][a-z0-9-]*/g;

/** True when a comment line's content begins a Usage section. The word
 * "usage" mid-prose (e.g. "a usage error: ...") must NOT open one. */
function isUsageStart(trimmed) {
  const content = trimmed
    .replace(/^\/\*+\s?/, '')
    .replace(/^\*+\s?/, '')
    .replace(/^\/\/+\s?/, '');
  return /^usage\b/i.test(content);
}

/** Extract documented flags: usage blocks in comments and console usage text.
 * Within a comment block only the `Usage:` section counts — prose that quotes
 * an unrelated tool's flag (e.g. `git diff` with its own long options, an npm
 * audit command line) must not register as a documented option of the script.
 */
export function extractDocumentedFlags(source) {
  const flags = new Set();
  const lines = source.split(/\r?\n/);
  let inConsoleTemplate = false;
  let inUsageComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const isComment = trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
    if (isComment && isUsageStart(trimmed)) inUsageComment = true;
    else if (!isComment) inUsageComment = false;
    // A line opens a console usage template when it contains console.* followed
    // by an unescaped backtick; single-line console usage strings are matched
    // by the console-usage rule below.
    const hasConsoleTemplate = /console\.(log|error)\(\s*`/.test(line);
    const isConsoleUsage = /console\.(log|error)\(\s*[`'"]\s*usage\b/i.test(line);
    const collectable = (isComment && inUsageComment) || inConsoleTemplate || hasConsoleTemplate || isConsoleUsage;
    if (collectable) {
      for (const m of line.matchAll(FLAG_RE)) flags.add(m[0]);
    }
    if (inConsoleTemplate) {
      if (hasClosingBacktick(line)) inConsoleTemplate = false;
    } else if (hasConsoleTemplate && !closesOnSameLine(line)) {
      inConsoleTemplate = true;
    }
  }
  return flags;
}

function closesOnSameLine(line) {
  const after = line.slice(line.indexOf('console.'));
  return hasClosingBacktick(after.slice(after.indexOf('`') + 1));
}

function hasClosingBacktick(text) {
  return /(^|[^\\])`/.test(text);
}

/**
 * Extract parser-recognized flags: only literals in comparison/call positions
 * count. A flag that appears solely inside a usage string or comment is NOT
 * recognized — that asymmetry is exactly what detects d26cd536.
 */
export function extractRecognizedFlags(source) {
  const flags = new Set();
  const patterns = [
    /(?:===|==|!==)\s*['"](--[a-z0-9][a-z0-9-]*)['"]/g, // a === '--flag'
    /\.(?:includes|has|indexOf)\(\s*['"](--[a-z0-9][a-z0-9-]*)['"]\s*\)/g, // args.includes('--flag') / args.indexOf('--flag')
    /\.startsWith\(\s*['"](--[a-z0-9][a-z0-9-]*=)['"]\s*\)/g, // a.startsWith('--flag=')
  ];
  // Comment lines are excluded: a comment quoting a parser idiom (e.g. the F-6
  // rationale) must not count as recognition for the live parser.
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    for (const re of patterns) {
      for (const m of line.matchAll(re)) flags.add(m[1].replace(/=$/, ''));
    }
  }
  return flags;
}

/** Extract `node scripts/... --flags` invocations from workflow YAML. */
export function extractWorkflowInvocations(workflowText) {
  const invocations = [];
  for (const line of workflowText.split(/\r?\n/)) {
    const m = line.match(/node\s+((?:scripts|certification)\/[\w./-]+\.m?js)\s*(.*)$/);
    if (!m) continue;
    const script = m[1].replace(/^\.\//, '');
    const flags = [...m[2].matchAll(FLAG_RE)].map((x) => x[0]);
    invocations.push({ script, flags });
  }
  return invocations;
}

function readIfExists(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf8');
}

function runNode(args, cwd = ROOT) {
  return spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 120000 });
}

/** Compare the three flag sources for one script. Returns issue strings. */
export function contractIssues({ documented, recognized, ciFlags }) {
  const issues = [];
  for (const flag of documented) {
    if (!recognized.has(flag)) {
      issues.push(`documented flag ${flag} is not recognized by the parser (documented-but-rejected regression)`);
    }
  }
  for (const flag of ciFlags) {
    if (!recognized.has(flag) && !documented.has(flag)) {
      issues.push(`CI-invoked flag ${flag} is neither recognized nor documented`);
    } else if (!recognized.has(flag)) {
      issues.push(`CI-invoked flag ${flag} is documented but not recognized by the parser`);
    }
  }
  return issues;
}

function mainGate() {
  const findings = [];
  const matrix = [];

  // 1–2: per-script static contract + 3: workflow invocations.
  const workflowDir = path.join(ROOT, '.github', 'workflows');
  const ciByScript = new Map();
  if (!fs.existsSync(workflowDir)) {
    console.error('cli-contracts BLOCKED: .github/workflows not found');
    process.exit(2);
  }
  for (const file of fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))) {
    const text = fs.readFileSync(path.join(workflowDir, file), 'utf8');
    for (const inv of extractWorkflowInvocations(text)) {
      const list = ciByScript.get(inv.script) || [];
      list.push({ file, flags: inv.flags });
      ciByScript.set(inv.script, list);
    }
  }
  for (const [script, uses] of ciByScript) {
    if (!fs.existsSync(path.join(ROOT, script))) {
      findings.push(`${script} invoked in ${uses.map((u) => u.file).join(', ')} but does not exist`);
    }
    if (!REGISTRY.some((r) => r.script === script)) {
      findings.push(`${script} is invoked in CI but missing from the CLI-contract registry — register it (and its flags) so its parser contract is enforced`);
    }
  }

  for (const entry of REGISTRY) {
    const source = readIfExists(entry.script);
    if (source === null) {
      findings.push(`${entry.script} is registered but missing`);
      continue;
    }
    const documented = extractDocumentedFlags(source);
    const recognized = extractRecognizedFlags(source);
    const ciFlags = new Set((ciByScript.get(entry.script) || []).flatMap((u) => u.flags));
    const issues = contractIssues({ source, documented, recognized, ciFlags });
    for (const issue of issues) findings.push(`${entry.script}: ${issue}`);
    matrix.push({
      script: entry.script,
      documented: [...documented].sort(),
      recognized: [...recognized].sort(),
      ciInvoked: [...ciFlags].sort(),
      issues,
    });
  }

  // 4–5: runtime probes — unknown option and stray positional must fail
  // deterministically with usage + exit 2 for every registered script.
  const usageError = /Unknown option|Unexpected argument|Usage/i;
  for (const entry of REGISTRY) {
    const invalid = runNode([entry.script, INVALID_FLAG]);
    if (invalid.status !== 2 || !usageError.test(invalid.stderr || '')) {
      findings.push(`${entry.script}: unknown option probe expected exit 2 + usage-error stderr, got exit ${invalid.status}`);
    }
    if (!entry.acceptsPositionals) {
      const positional = runNode([entry.script, INVALID_POSITIONAL]);
      if (positional.status !== 2 || !usageError.test(positional.stderr || '')) {
        findings.push(`${entry.script}: stray positional probe expected exit 2 + usage-error stderr, got exit ${positional.status}`);
      }
    }
    // 6: registered positive probes (offline, cheap) must succeed.
    for (const flag of entry.positiveProbes || []) {
      const probe = runNode([entry.script, flag]);
      if (probe.status !== 0) {
        findings.push(`${entry.script} ${flag}: expected exit 0, got exit ${probe.status}`);
      }
    }
    // 7: pinned per-script contract probes (validate-affected regression).
    for (const probe of entry.contractProbes || []) {
      const result = runNode([entry.script, ...probe.args]);
      if (result.status !== probe.exit) {
        findings.push(`${entry.script} ${probe.args.join(' ') || '(no args)'}: ${probe.note} — expected exit ${probe.exit}, got exit ${result.status}`);
      }
    }
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ version: 1, matrix, findings }, null, 2));
  } else {
    console.log('Validator CLI compatibility matrix:');
    for (const row of matrix) {
      console.log(`  ${row.script}`);
      console.log(`    documented: ${row.documented.join(' ') || '(none)'}`);
      console.log(`    recognized: ${row.recognized.join(' ') || '(none)'}`);
      console.log(`    ci-invoked: ${row.ciInvoked.join(' ') || '(none)'}`);
    }
  }

  if (findings.length) {
    console.error(`\ncli-contracts: FAIL — ${findings.length} issue(s)`);
    for (const f of findings) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\ncli-contracts: PASS (${REGISTRY.length} scripts; documented, parser-recognized and CI-invoked flags agree; unknown-option probes exit 2)`);
}

// ——— Self-test: fixture proofs of the extraction/matching logic (offline).
// Fixture flag names are assembled by concatenation so this file's own source
// never contains parser-shaped literals for them (the extractor must not see
// this file as recognizing fixture flags).
function selfTest() {
  let pass = 0;
  let fail = 0;
  const expect = (cond, name) => {
    if (cond) { pass++; } else { fail++; console.error(`SELF-TEST FAIL: ${name}`); }
  };
  const DASH = '--';
  const foo = `${DASH}foo`;
  const bar = `${DASH}bar`;
  const baz = `${DASH}baz`;

  const documentedSource = [
    '/**',
    ' * Usage: node fixture.mjs ' + foo + ' [' + bar + ']', // comment documents both
    ' */',
    'const args = process.argv.slice(2);',
    'if (args.includes(' + JSON.stringify(foo) + ')) runFoo();',
  ].join('\n');
  const documented = extractDocumentedFlags(documentedSource);
  const recognized = extractRecognizedFlags(documentedSource);
  expect(documented.has(foo) && documented.has(bar), 'comment usage lines are documented');
  expect(recognized.has(foo), 'includes() literal is recognized');
  expect(!recognized.has(bar), 'usage-only literal is NOT recognized (d26cd536 detection)');

  const issues = contractIssues({ source: documentedSource, documented, recognized, ciFlags: new Set() });
  expect(issues.length === 1 && issues[0].includes(bar), 'documented-but-unrecognized flag raises exactly one issue');

  const agreeSource = [
    'const args = process.argv.slice(2);',
    'if (args.includes(' + JSON.stringify(foo) + ')) runFoo();',
    'if (args.includes(' + JSON.stringify(bar) + ')) runBar();',
  ].join('\n');
  const agreeIssues = contractIssues({
    source: agreeSource,
    documented: extractDocumentedFlags(agreeSource),
    recognized: extractRecognizedFlags(agreeSource),
    ciFlags: new Set([foo, bar]),
  });
  expect(agreeIssues.length === 0, 'documented + recognized + CI flags in agreement raise no issues');

  const comparisonSource = 'if (a === ' + JSON.stringify(baz) + ') {}';
  expect(extractRecognizedFlags(comparisonSource).has(baz), '=== comparison literal is recognized');
  const prefixSource = 'const x = args.find((a) => a.startsWith(' + JSON.stringify(`${DASH}dir=`) + '));';
  expect(extractRecognizedFlags(prefixSource).has(`${DASH}dir`), 'startsWith(--flag=) prefix form is recognized');

  const consoleSource = 'console.log(`Usage:\\n  node fixture.mjs ' + foo + '  do the thing`);';
  const consoleDoc = extractDocumentedFlags(consoleSource);
  expect(consoleDoc.has(foo), 'single-line console usage template is documented');
  const proseSource = [
    '/**',
    ' * Fail with a usage error when an unknown flag is passed, e.g. quoting',
    ' * another tool\'s options like git-dash-dash-name-only or npm-audit-json.',
    ' */',
  ].join('\n');
  const proseDoc = extractDocumentedFlags(proseSource);
  expect(proseDoc.size === 0, 'prose mentioning "usage" without a Usage block documents nothing');
  const multiSource = 'console.log(`Usage:\\n  node fixture.mjs ' + foo + '\\n  node fixture.mjs ' + bar + '`);';
  const multiDoc = extractDocumentedFlags(multiSource);
  expect(multiDoc.has(foo) && multiDoc.has(bar), 'multi-line console usage template is documented');

  const workflowText = [
    '      - name: Gate',
    '        run: node scripts/validate-affected.mjs --check-sync',
    '        run: node scripts/validate-affected.mjs --self-test',
  ].join('\n');
  const invs = extractWorkflowInvocations(workflowText);
  expect(invs.length === 2 && invs[0].flags.includes('--check-sync') && invs[1].flags.includes('--self-test'),
    'workflow run lines yield script + flags');

  const ciIssue = contractIssues({
    source: agreeSource,
    documented: new Set([foo]),
    recognized: new Set([foo]),
    ciFlags: new Set([bar]),
  });
  expect(ciIssue.length === 1 && ciIssue[0].includes(bar), 'CI-only unrecognized flag raises an issue');

  console.log(`validate-cli-contracts self-test: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

// CLI contract for this script itself.
for (const a of process.argv.slice(2)) {
  if (a === '--self-test' || a === '--json') continue;
  console.error(`${a.startsWith('-') ? 'Unknown option' : 'Unexpected argument'}: ${a}\n`);
  console.error('Usage: node scripts/certification/validate-cli-contracts.mjs [--self-test] [--json]');
  process.exit(2);
}
if (process.argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
}
mainGate();
