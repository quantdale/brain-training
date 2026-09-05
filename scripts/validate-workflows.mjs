#!/usr/bin/env node
/**
 * Workflow shell-hygiene validator (Campaign 021, ci-shell-hygiene spec).
 *
 * Guards the failure class that turned the Android release gate red on every
 * push from `c491c2b` to `e77da39`: a `yes |` producer pipeline whose
 * SIGPIPE/EPIPE status is reported under the GitHub runner's default
 * `bash -eo pipefail`, plus the historical `|| true` mask that hides genuine
 * tool failures, plus redundant standalone `sdkmanager --licenses` (already
 * owned by android-actions/setup-android@v3).
 *
 * Prohibited constructs are scanned only inside `run: |` block content —
 * step names, comments, and `uses:` lines are not executable shell here.
 *
 * Fail-closed like the secret scanner: names file + line + rule, never
 * reprints a whole matched block. `--self-test` proves detection and
 * non-detection on fixtures so the guard itself cannot silently regress.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = process.cwd();

/** @type {{id: string, re: RegExp, why: string}[]} */
const RULES = [
  {
    id: 'yes-pipe-sigpipe',
    // `yes | ...` or `yes ... | ...`: an unbounded producer. Once the
    // consumer exits without draining stdin, `yes` dies writing to a closed
    // pipe and pipefail reports its status even when the consumer succeeded.
    re: /(^|[\s;(&])yes(\s+\S+)*\s*\|/,
    why: '`yes |` producer pipeline: deterministic SIGPIPE/EPIPE status under runner pipefail once the consumer stops reading; accept the input another way (heredoc/`yes > f &`-free forms) or drop the redundant interactive prompt',
  },
  {
    id: 'exit-mask-true',
    re: /\|\|\s*true\b/,
    why: '`|| true` masks a real non-zero exit; isolate the harmless producer status or fix the root cause instead',
  },
  {
    id: 'redundant-sdkmanager-licenses',
    // setup-android@v3 accepts licenses by default (accept-android-sdk-licenses: true).
    re: /\bsdkmanager\b[^\n]*--licenses\b/,
    why: 'redundant `sdkmanager --licenses`: android-actions/setup-android already accepts SDK licenses; a second interactive pass is the SIGPIPE failure source',
  },
];

/**
 * Extract executable `run:` block content with line numbers from raw YAML
 * text. Handles literal block scalars (`run: |`, `run: >-`, with optional
 * explicit indentation indicators) by indentation, which is sufficient and
 * dependency-free for repository-authored workflows. Also handles the list
 * item form `- run: |`. Returns array of `{line, text}` for scanned shell
 * lines. Comment-only lines are skipped.
 */
export function extractRunBlocks(text) {
  const lines = text.split(/\r?\n/);
  const shell = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:-\s+)?run:\s*(?:([|>][-+]?\d*)\s*)?(.*)$/.exec(lines[i]);
    if (!m) continue;
    const inline = m[3].trim();
    if (inline && !m[2]) {
      // Inline one-liner (`run: npm ci`): scan just this line.
      if (!inline.startsWith('#')) shell.push({ line: i + 1, text: inline });
      continue;
    }
    const parentIndent = m[0].indexOf('run:');
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j];
      if (raw.trim() === '') continue;
      const indent = raw.length - raw.trimStart().length;
      if (indent <= parentIndent) break; // block ended at a sibling/parent key
      if (raw.trimStart().startsWith('#')) continue;
      shell.push({ line: j + 1, text: raw.trim() });
    }
  }
  return shell;
}

/** Scan one workflow text; returns finding strings (empty = clean). */
export function scanWorkflow(text, fileLabel) {
  const findings = [];
  for (const { line, text: shellLine } of extractRunBlocks(text)) {
    for (const rule of RULES) {
      if (rule.re.test(shellLine)) {
        findings.push(`${fileLabel}:${line}: [${rule.id}] ${rule.why}`);
      }
    }
  }
  return findings;
}

export function validateWorkflows(dir) {
  const findings = [];
  let scanned = 0;
  const entries = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort();
  for (const file of entries) {
    scanned++;
    findings.push(...scanWorkflow(fs.readFileSync(path.join(dir, file), 'utf8'), `.github/workflows/${file}`));
  }
  return { findings, scanned };
}

// ——— Self-test: positive (must detect each rule) + negative (must stay clean)
function selfTest() {
  const bad = [
    'jobs:\n  a:\n    steps:\n      - run: |\n          yes | sdkmanager --licenses >/dev/null\n',
    'jobs:\n  a:\n    steps:\n      - run: |\n          make install || true\n',
    'jobs:\n  a:\n    steps:\n      - run: |\n          sdkmanager --licenses\n',
    'jobs:\n  a:\n    steps:\n      - run: |\n          yes y | some-tool\n',
  ];
  const good = [
    'jobs:\n  a:\n    steps:\n      - name: Install pinned Android build dependencies\n        run: |\n          set -euo pipefail\n          sdkmanager "platform-tools" "ndk;27.0.12077973"\n          grep -qF "x" <<< "$y" || { echo missing; exit 1; }\n',
    '# comment mentions yes | sdkmanager --licenses and || true outside run blocks\njobs:\n  a:\n    steps:\n      - name: yes | pipe in a step name is not shell\n        run: npm ci\n',
    'jobs:\n  a:\n    steps:\n      - run: |\n          # a run-block comment mentioning yes | sdkmanager --licenses is skipped\n          printf y\\n | sdkmanager --some-other-flag\n',
  ];
  let pass = 0;
  let fail = 0;
  const expect = (cond, name) => {
    if (cond) { pass++; } else { fail++; console.error(`SELF-TEST FAIL: ${name}`); }
  };
  for (const [i, text] of bad.entries()) {
    const f = scanWorkflow(text, `fixture-bad-${i}`);
    expect(f.length >= 1, `bad fixture ${i} detected`);
  }
  // Each rule fires on its canonical fixture
  expect(scanWorkflow(bad[0], 'x').some((f) => f.includes('yes-pipe-sigpipe')), 'rule yes-pipe-sigpipe fires');
  expect(scanWorkflow(bad[1], 'x').some((f) => f.includes('exit-mask-true')), 'rule exit-mask-true fires');
  expect(scanWorkflow(bad[2], 'x').some((f) => f.includes('redundant-sdkmanager-licenses')), 'rule redundant-sdkmanager-licenses fires');
  // Rule fires even with sdkmanager licenses after other args
  expect(scanWorkflow('jobs:\n  a:\n    steps:\n      - run: sdkmanager "x" --licenses\n', 'x').length === 1, 'flag scan is line-anchored not whole-file');
  for (const [i, text] of good.entries()) {
    const f = scanWorkflow(text, `fixture-good-${i}`);
    expect(f.length === 0, `good fixture ${i} clean (${f.join('; ')})`);
  }
  // Block extraction: block scalar + inline one-liner both scanned; block
  // ends at the dedented sibling key.
  const bounded = extractRunBlocks('jobs:\n  a:\n    steps:\n      - run: |\n          yes | a\n      - name: next\n        run: npm ci\n');
  expect(bounded.length === 2, 'block scalar and inline run both scanned');
  expect(bounded[0].text === 'yes | a' && bounded[1].text === 'npm ci', 'extracted run lines verbatim');
  expect(extractRunBlocks('jobs:\n  a:\n    steps:\n      - run: |\n          echo one\n          echo two\n').length === 2, 'multi-line block scalar fully scanned');
  // End-to-end: a temp directory with one clean workflow passes validation
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-selftest-'));
  try {
    fs.writeFileSync(path.join(tmp, 'clean.yml'), good[0]);
    const r = validateWorkflows(tmp);
    expect(r.scanned === 1 && r.findings.length === 0, 'validateWorkflows clean dir');
    fs.writeFileSync(path.join(tmp, 'bad.yml'), bad[0]);
    const r2 = validateWorkflows(tmp);
    // bad[0] trips two rules (yes-pipe + redundant licenses).
    expect(r2.scanned === 2 && r2.findings.length === 2, 'validateWorkflows dirty dir');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`Workflow validator self-test: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
}
const dir = path.join(ROOT, '.github', 'workflows');
if (!fs.existsSync(dir)) {
  console.error('.github/workflows not found — run from repository root');
  process.exit(1);
}
const { findings, scanned } = validateWorkflows(dir);
if (findings.length) {
  console.error(`Workflow hygiene validation FAILED (${scanned} files scanned):`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`Workflow hygiene validation PASS (${scanned} files scanned)`);
