#!/usr/bin/env node

/**
 * High-confidence repository secret scan. This intentionally checks only
 * provider/key formats that can be identified without guessing at ordinary
 * words such as "token" in documentation. It scans Git-tracked text files,
 * reports file/line/pattern only, and never prints the matched value.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');

const PATTERNS = [
  { id: 'private-key', expression: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  { id: 'aws-access-key', expression: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', expression: /\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{20,}\b/ },
  { id: 'slack-token', expression: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { id: 'openai-style-key', expression: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { id: 'supabase-service-key', expression: /\bsbp_[A-Za-z0-9_-]{20,}\b/ },
];

function scanText(source, file = '<memory>') {
  const findings = [];
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    for (const pattern of PATTERNS) {
      if (pattern.expression.test(line)) {
        findings.push({ file, line: index + 1, pattern: pattern.id });
      }
    }
  }
  return findings;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function scanTrackedFiles() {
  const findings = [];
  let textFiles = 0;
  for (const file of trackedFiles()) {
    const bytes = readFileSync(resolve(root, file));
    // Binary files are not useful to this text-pattern scanner. Their content
    // is still tracked and should be reviewed through the binary scanner that
    // owns that format if one is introduced later.
    if (bytes.includes(0)) {
      continue;
    }
    textFiles += 1;
    findings.push(...scanText(bytes.toString('utf8'), relative(root, resolve(root, file))));
  }
  return { findings, textFiles };
}

function selfTest() {
  const privateKey = ['-----BEGIN ', 'RSA PRIVATE KEY-----'].join('');
  const awsKey = ['AKIA', '1234567890123456'].join('');
  const githubToken = ['ghp_', 'A'.repeat(24)].join('');
  assert.deepEqual(scanText('ordinary token documentation'), []);
  assert.equal(scanText(privateKey)[0]?.pattern, 'private-key');
  assert.equal(scanText(awsKey)[0]?.pattern, 'aws-access-key');
  assert.equal(scanText(githubToken)[0]?.pattern, 'github-token');
  assert.equal(scanText('prefix ' + githubToken + ' suffix').length, 1);
  console.log('validate-secrets self-test: PASS');
}

const args = new Set(process.argv.slice(2));
if (args.has('--help')) {
  console.log('Usage: node scripts/validate-secrets.mjs [--check|--self-test]');
  process.exit(0);
}
if (args.has('--self-test')) {
  selfTest();
  process.exit(0);
}

try {
  const result = scanTrackedFiles();
  if (result.findings.length > 0) {
    console.error(`validate-secrets: FAIL — ${result.findings.length} high-confidence match(es)`);
    for (const finding of result.findings) {
      console.error(`SECRET_PATTERN: ${finding.file}:${finding.line} (${finding.pattern})`);
    }
    process.exitCode = 1;
  } else {
    console.log(`validate-secrets: CLEAN — scanned ${result.textFiles} tracked text files`);
  }
} catch (error) {
  console.error(`validate-secrets: FAIL — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
