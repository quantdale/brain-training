#!/usr/bin/env node
/**
 * Workflow hygiene validator.
 *
 * Campaign 021 shell rules (spec `ci-shell-hygiene`): guard the failure class
 * that turned the Android release gate red on every push from `c491c2b` to
 * `e77da39` — a `yes |` producer pipeline whose SIGPIPE/EPIPE status is
 * reported under the GitHub runner's default `bash -eo pipefail`, plus the
 * historical `|| true` mask that hides genuine tool failures, plus redundant
 * standalone `sdkmanager --licenses` (already owned by
 * android-actions/setup-android@v3).
 *
 * Campaign 027 adds two supply-chain/reliability rule families:
 *   - `unpinned-action`: a `uses:` reference must be a full 40-hex commit SHA
 *     (local `./` actions are exempt; `docker://` images need an @sha256
 *     digest). Documented exceptions must be listed in USES_ALLOWLIST with a
 *     non-empty reason.
 *   - `unenforced-continue-on-error`: a step with `continue-on-error: true`
 *     must be enforced later in the same job, either by a step whose `run:`
 *     checks `steps.<id>.outcome` / `steps.<id>.conclusion`, or by a
 *     `# enforced-by: <step name>` marker naming a later step in that job.
 *     Statically unresolvable values (`continue-on-error: ${{ ... }}`) are
 *     deliberately not flagged — see the self-test note.
 *
 * Prohibited shell constructs are scanned only inside `run: |` block content
 * — step names, comments, and `uses:` lines are not executable shell here.
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
 * Explicit, reviewed exceptions to the SHA-pinning rule. Every entry MUST
 * carry a non-empty `reason` (validated by validateUsesAllowlist). Entries
 * match either the exact `uses:` string or an `owner/repo` prefix. This list
 * is deliberately empty: every action in `.github/workflows` resolves to a
 * full commit SHA. A deferred pin would be recorded here as
 * `{ uses: 'owner/repo@tag', reason: 'pin-pending-network: <detail>' }`.
 * @type {{uses: string, reason: string}[]}
 */
export const USES_ALLOWLIST = [];

const FULL_SHA_RE = /^[0-9a-f]{40}$/;

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

/**
 * Extract `uses:` step references with line numbers. `uses:` only has step
 * semantics outside `run:` blocks, so scanWorkflow() excludes lines that
 * extractRunBlocks() classified as shell.
 * Returns `{line, value}`.
 */
export function extractUses(text) {
  const uses = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:-\s+)?uses:\s*([^\s#]+)/.exec(lines[i]);
    if (!m) continue;
    uses.push({ line: i + 1, value: m[2] });
  }
  return uses;
}

/** Normalize an allowlist entry's `uses` value for exact/prefix matching. */
function usesAllowed(value, allowlist) {
  for (const entry of allowlist) {
    const target = (entry.uses || '').trim();
    if (!target) continue;
    if (value === target) return entry;
    if (target.endsWith('/') ? value.startsWith(target) : value.startsWith(`${target}@`)) return entry;
  }
  return null;
}

/**
 * Validate the documented pinning exceptions themselves: every entry needs a
 * `uses` and a non-empty `reason`, and an entry that does not match anything
 * in the scanned workflows is reported as stale (no silent rots). Returns
 * finding strings. `seen` may be omitted when validating the constant alone.
 */
export function validateUsesAllowlist(allowlist, seen = null) {
  const findings = [];
  for (const entry of allowlist) {
    if (!entry || typeof entry.uses !== 'string' || !entry.uses.trim()) {
      findings.push('[uses-allowlist] entry missing a non-empty "uses" string');
      continue;
    }
    if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
      findings.push(`[uses-allowlist] entry "${entry.uses}" missing a non-empty "reason" rationale`);
    }
    if (seen && ![...seen].some((value) => usesAllowed(value, [entry]))) {
      findings.push(`[uses-allowlist] entry "${entry.uses}" matches no scanned workflow reference (stale allowlist)`);
    }
  }
  return findings;
}

/** Pin-policy decision for one `uses:` value. Returns a finding or null. */
function pinFinding(value, line, fileLabel, allowlist) {
  if (value.startsWith('./')) return null; // local action, same repository
  if (value.startsWith('docker://')) {
    return /@sha256:[0-9a-f]{64}$/.test(value)
      ? null
      : `${fileLabel}:${line}: [unpinned-action] container reference "${value}" must be pinned by @sha256:<64-hex digest>`;
  }
  const ref = value.slice(value.lastIndexOf('@') + 1);
  const isSha = value.includes('@') && FULL_SHA_RE.test(ref);
  if (isSha) return null;
  const allowed = usesAllowed(value, allowlist);
  if (allowed && typeof allowed.reason === 'string' && allowed.reason.trim()) return null;
  const suffix = allowed ? ' (allowlist entry has no non-empty reason)' : '';
  return `${fileLabel}:${line}: [unpinned-action] "${value}" is not a full 40-hex commit SHA${suffix}; pin it and keep the original tag in a trailing comment`;
}

/**
 * Minimal structural read of `jobs.*.steps` for enforcement analysis. The
 * validator is intentionally dependency-free (Repository Integrity runs it
 * without `npm ci`), so this handles repository-authored workflow shape:
 * block indentation, one job key per level, `- key:` step items. Returns
 * `{ name, line, steps: [{line, endLine, indent, id, name, uses,
 * continueOnError, run, comments}] }`.
 */
export function parseJobs(text) {
  const lines = text.split(/\r?\n/);
  const jobs = [];
  let inJobs = false;
  let job = null;
  let step = null;
  let stepIndent = null;
  let runIndent = null;
  let pendingComments = [];
  let pendingCommentLine = -1;

  const finishStep = (endLine) => {
    if (step && step.endLine === null) step.endLine = endLine;
    step = null;
    runIndent = null;
  };
  const finishJob = (endLine) => {
    finishStep(endLine);
    job = null;
    stepIndent = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    const trimmed = raw.trim();
    const indent = raw.length - raw.trimStart().length;

    if (indent === 0) {
      finishJob(lineNo - 1);
      inJobs = /^jobs:\s*(#.*)?$/.test(trimmed);
      pendingComments = [];
      continue;
    }
    if (!inJobs) continue;

    // `run:` block content is opaque shell: consume it before any key parse.
    if (step && runIndent !== null && indent > runIndent) {
      step.run += `\n${trimmed}`;
      continue;
    }
    if (step && runIndent !== null && indent <= runIndent) runIndent = null;

    if (trimmed === '') continue;
    if (trimmed.startsWith('#')) {
      if (step && indent > step.indent) step.comments.push(trimmed);
      else if (pendingCommentLine === lineNo - 1 || pendingComments.length === 0) pendingComments.push(trimmed);
      pendingCommentLine = lineNo;
      continue;
    }
    pendingCommentLine = -1;

    // Job key (indent 2, `key:` with no inline value). Step properties are
    // always deeper than an item dash, so indent 2 here is always a job key.
    if (indent === 2 && /^[A-Za-z0-9_.-]+:\s*(#.*)?$/.test(trimmed)) {
      finishJob(lineNo - 1);
      job = { name: trimmed.replace(/:.*$/, ''), line: lineNo, inSteps: false, steps: [] };
      jobs.push(job);
      pendingComments = [];
      continue;
    }
    if (!job) continue;

    if (!step && indent > 2 && /^steps:\s*(#.*)?$/.test(trimmed)) {
      job.inSteps = true;
      continue;
    }

    // A new step list item.
    if (job.inSteps && /^-\s*/.test(trimmed) && (stepIndent === null || indent === stepIndent)) {
      finishStep(lineNo - 1);
      stepIndent = indent;
      step = {
        line: lineNo, endLine: null, indent, id: null, name: null, uses: null,
        continueOnError: false, run: '', comments: pendingComments.slice(),
      };
      pendingComments = [];
      job.steps.push(step);
      const rest = trimmed.replace(/^-\s*/, '');
      if (rest) parseStepProp(step, rest);
      continue;
    }
    if (!step) continue;

    // Step property lines (deeper than the `-` item). Trailing comments are
    // kept so `# enforced-by: <step name>` markers survive value trimming.
    if (indent > step.indent) {
      const hash = trimmed.indexOf('#');
      if (hash !== -1) step.comments.push(trimmed.slice(hash));
      parseStepProp(step, trimmed);
      if (runIndent === null && /^run:/.test(trimmed)) runIndent = indent;
    } else {
      finishStep(lineNo - 1);
    }
  }
  finishJob(lines.length);
  return jobs;
}

function parseStepProp(step, content) {
  const stripComment = (v) => v.replace(/\s+#.*$/, '').trim();
  let m;
  if ((m = /^id:\s*(.+)$/.exec(content))) step.id = stripComment(m[1]).replace(/^['"]|['"]$/g, '');
  else if ((m = /^name:\s*(.+)$/.exec(content))) step.name = stripComment(m[1]);
  else if ((m = /^uses:\s*(.+)$/.exec(content))) step.uses = stripComment(m[1]);
  else if ((m = /^continue-on-error:\s*(.+)$/.exec(content))) step.continueOnError = /^true\b/.test(stripComment(m[1]));
  else if ((m = /^run:\s*(.*)$/.exec(content))) {
    const inline = m[1].trim();
    if (inline && !/^[|>]/.test(inline)) step.run += `\n${inline}`;
  }
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Enforce the `unenforced-continue-on-error` rule for one parsed job: a
 * tolerated failure must be re-checked later in the same job, otherwise the
 * masking is permanent. Detection paths:
 *   1. a later step's `run:` references `steps.<id>.outcome|conclusion`;
 *   2. a `# enforced-by: <name>` comment naming a later step in this job.
 */
export function continueOnErrorFindings(job, fileLabel) {
  const findings = [];
  for (let i = 0; i < job.steps.length; i++) {
    const step = job.steps[i];
    if (!step.continueOnError) continue;
    const later = job.steps.slice(i + 1);
    const label = step.name || step.id || `step at line ${step.line}`;
    const outcomeRe = step.id
      ? new RegExp(`steps\\s*\\.\\s*${escapeRe(step.id)}\\s*\\.\\s*(outcome|conclusion)\\b`)
      : null;
    const enforcedByOutcome = outcomeRe ? later.some((s) => outcomeRe.test(s.run)) : false;
    const marker = (step.comments || []).map((c) => /#\s*enforced-by:\s*(.+?)\s*$/.exec(c)).find(Boolean);
    const target = marker ? marker[1].replace(/^['"]|['"]$/g, '') : null;
    const enforcedByName = target
      ? later.some((s) => s.name && s.name.replace(/^['"]|['"]$/g, '') === target)
      : false;
    if (enforcedByOutcome || enforcedByName) continue;
    findings.push(
      `${fileLabel}:${step.line}: [unenforced-continue-on-error] step "${label}" sets continue-on-error: true but no later step in job "${job.name}" re-checks it; add a later step using steps.${step.id || '<id>'}.outcome or a '# enforced-by: <step name>' marker`,
    );
  }
  return findings;
}

/**
 * Scan one workflow text; returns finding strings (empty = clean).
 * `options.usesAllowlist` injects fixtures during `--self-test`.
 */
export function scanWorkflow(text, fileLabel, options = {}) {
  const allowlist = options.usesAllowlist ?? USES_ALLOWLIST;
  const findings = [];
  const shellLines = new Set(extractRunBlocks(text).map((l) => l.line));
  for (const { line, value } of extractUses(text)) {
    if (shellLines.has(line)) continue;
    const f = pinFinding(value, line, fileLabel, allowlist);
    if (f) findings.push(f);
  }
  for (const job of parseJobs(text)) {
    findings.push(...continueOnErrorFindings(job, fileLabel));
  }
  for (const { line, text: shellLine } of extractRunBlocks(text)) {
    for (const rule of RULES) {
      if (rule.re.test(shellLine)) {
        findings.push(`${fileLabel}:${line}: [${rule.id}] ${rule.why}`);
      }
    }
  }
  return findings;
}

export function validateWorkflows(dir, options = {}) {
  const findings = [];
  const allowlist = options.usesAllowlist ?? USES_ALLOWLIST;
  const seen = new Set();
  const entries = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort();
  for (const file of entries) {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const { value } of extractUses(text)) seen.add(value);
    findings.push(...scanWorkflow(text, `.github/workflows/${file}`, { usesAllowlist: allowlist }));
  }
  findings.push(...validateUsesAllowlist(allowlist, seen));
  return { findings, scanned: entries.length };
}

// ——— Self-test: positive (must detect each rule) + negative (must stay clean)
function selfTest() {
  const SHA = '0123456789abcdef0123456789abcdef01234567';
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

  // ——— Campaign 027: unpinned `uses:` detection + non-detection
  const pinned = `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA} # v7\n`;
  const unpinnedFixtures = [
    'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@v7\n',
    'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@main\n',
    'jobs:\n  a:\n    steps:\n      - uses: actions/checkout\n',
    'jobs:\n  a:\n    steps:\n      - uses: docker://alpine:3\n',
    'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@0123456789abcdef0123456789abcdef0123456\n',
  ];
  for (const [i, text] of unpinnedFixtures.entries()) {
    const f = scanWorkflow(text, `uses-bad-${i}`);
    expect(f.length === 1 && f[0].includes('unpinned-action'), `unpinned uses fixture ${i} detected`);
  }
  const cleanUses = [
    pinned,
    `jobs:\n  a:\n    steps:\n      - uses: actions/checkout@${SHA}   # v7\n`,
    'jobs:\n  a:\n    steps:\n      - uses: ./.github/actions/local-build\n',
    'jobs:\n  a:\n    steps:\n      - uses: docker://alpine@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n',
    // `uses:`-looking text inside a run block is shell, not a step reference.
    `jobs:\n  a:\n    steps:\n      - run: |\n          uses: actions/checkout@v7\n`,
  ];
  for (const [i, text] of cleanUses.entries()) {
    const f = scanWorkflow(text, `uses-good-${i}`);
    expect(f.length === 0, `clean uses fixture ${i} (${f.join('; ')})`);
  }
  // Allowlist: matching entry with rationale passes; reasonless entry fails.
  const allowEntry = [{ uses: 'actions/checkout@v7', reason: 'pin-pending-network: offline fixture' }];
  expect(scanWorkflow(unpinnedFixtures[0], 'x', { usesAllowlist: allowEntry }).length === 0, 'allowlisted unpinned action passes');
  expect(scanWorkflow(unpinnedFixtures[1], 'x', { usesAllowlist: allowEntry }).length === 1, 'allowlist is not a blanket repo waiver');
  expect(
    scanWorkflow(unpinnedFixtures[0], 'x', { usesAllowlist: [{ uses: 'actions/checkout@v7', reason: '  ' }] })
      .some((f) => f.includes('no non-empty reason')),
    'allowlist entry without rationale is rejected',
  );
  expect(validateUsesAllowlist([{ uses: 'actions/x@v1' }]).length === 1, 'allowlist schema check: missing reason');
  expect(validateUsesAllowlist([{ uses: 'actions/x@v1', reason: 'why' }], new Set(['actions/y'])).length === 1, 'allowlist schema check: stale entry');
  expect(validateUsesAllowlist(USES_ALLOWLIST, new Set()).length === 0, 'shipped allowlist is valid and empty');

  // ——— Campaign 027: continue-on-error enforcement
  const enforcedByOutcome = 'jobs:\n  a:\n    steps:\n      - name: Tests\n        id: jest\n        continue-on-error: true\n        run: npm test\n      - name: Enforce Tests\n        if: always()\n        run: |\n          if [ "${{ steps.jest.outcome }}" != "success" ]; then exit 1; fi\n';
  const enforcedByMarker = 'jobs:\n  a:\n    steps:\n      - name: Tests\n        continue-on-error: true # enforced-by: Enforce Tests\n        run: npm test\n      - name: Enforce Tests\n        if: always()\n        run: exit 0\n';
  const enforcedByMarkerAbove = 'jobs:\n  a:\n    steps:\n      # enforced-by: Enforce Tests\n      - name: Tests\n        continue-on-error: true\n        run: npm test\n      - name: Enforce Tests\n        run: exit 1\n';
  const unenforced = [
    'jobs:\n  a:\n    steps:\n      - name: Tests\n        id: jest\n        continue-on-error: true\n        run: npm test\n',
    'jobs:\n  a:\n    steps:\n      - name: Tests\n        id: jest\n        continue-on-error: true\n        run: npm test\n      - name: Unrelated\n        run: echo ok\n',
    // Marker names a step that does not exist in this job.
    'jobs:\n  a:\n    steps:\n      - name: Tests\n        continue-on-error: true # enforced-by: Ghost Step\n        run: npm test\n',
    // Outcome reference in an earlier step does not enforce a later failure.
    'jobs:\n  a:\n    steps:\n      - name: Pre\n        run: echo ${{ steps.jest.outcome }}\n      - name: Tests\n        id: jest\n        continue-on-error: true\n        run: npm test\n',
  ];
  for (const [i, text] of unenforced.entries()) {
    const f = scanWorkflow(text, `coe-bad-${i}`);
    expect(f.some((x) => x.includes('unenforced-continue-on-error')), `unenforced continue-on-error fixture ${i} detected`);
  }
  for (const [i, text] of [enforcedByOutcome, enforcedByMarker, enforcedByMarkerAbove].entries()) {
    const f = scanWorkflow(text, `coe-good-${i}`);
    expect(f.length === 0, `enforced continue-on-error fixture ${i} clean (${f.join('; ')})`);
  }
  // Enforcement must be in the same job: a later job does not count.
  const crossJob = 'jobs:\n  a:\n    steps:\n      - name: Tests\n        id: jest\n        continue-on-error: true\n        run: npm test\n  b:\n    steps:\n      - name: Enforce Tests\n        run: exit 1 # steps.jest.outcome\n';
  expect(scanWorkflow(crossJob, 'x').some((f) => f.includes('unenforced-continue-on-error')), 'enforcement in another job is rejected');
  // Honest limitation, pinned so behavior cannot drift silently: a dynamic
  // continue-on-error expression is not statically enforceable and is NOT
  // flagged by this validator.
  const dynamic = 'jobs:\n  a:\n    steps:\n      - name: Tests\n        continue-on-error: ${{ matrix.experimental }}\n        run: npm test\n';
  expect(scanWorkflow(dynamic, 'x').length === 0, 'dynamic continue-on-error is documented non-detection');
  // parseJobs structure survives run blocks containing dashed lines.
  const dashedRun = 'jobs:\n  a:\n    steps:\n      - name: Tests\n        run: |\n          echo "- not a step"\n      - name: Next\n        run: echo next\n';
  expect(parseJobs(dashedRun)[0].steps.length === 2, 'dashed run-block content is not parsed as a step');
  const appCiShaped = parseJobs(enforcedByOutcome)[0];
  expect(appCiShaped.steps[0].id === 'jest' && appCiShaped.steps[0].continueOnError === true, 'parseJobs reads id/continue-on-error');
  expect(appCiShaped.steps[1].run.includes('steps.jest.outcome'), 'parseJobs captures enforcing run block');

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
