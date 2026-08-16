#!/usr/bin/env node
/**
 * validate-offline.mjs — static offline-first boundary check (constitution §5,
 * campaign 003, packet WP-3D).
 *
 * Scans `apps/mobile/src` (recursively) for network APIs — `fetch(`,
 * `XMLHttpRequest`, `axios`, `WebSocket(` — outside an explicit allowlist and
 * outside test artifacts. Prints a deterministic table of hits (file:line +
 * pattern, sorted) and exits 0 when clean, 1 when violations are found.
 *
 * Usage (from the repo root):  node scripts/validate-offline.mjs
 *
 * Exclusions:
 *   - `__tests__` / `__mocks__` directories and `*.test.ts` / `*.spec.ts`
 *   - ALLOWLIST entries below (empty by design; name + comment any exception)
 *
 * Limitations (shared with the in-test scan in
 * `apps/mobile/src/__tests__/offline-boundary.test.ts`):
 *   - The regexes are light substring checks: `fetch(` also matches
 *     identifiers like `refetch(` or `onFetch(`; `axios` matches any
 *     occurrence of those five characters.
 *   - String literals are stripped before matching, so URLs (`"https://..."`)
 *     cannot hide a call and cannot masquerade as `//` comments; the
 *     trade-off is that a network API inside a string literal is not
 *     flagged.
 *   - Lines that still contain `//` or `*` after stripping are skipped as
 *     probable comments, so a network API hidden inside a comment is not
 *     flagged.
 * These are deliberate trade-offs of the requested pattern, not silent
 * passes — the in-jest monkeypatch suite is the authoritative runtime proof.
 *
 * No dependencies: plain ESM using node:fs / node:path only. Deterministic
 * output (hits sorted by file and line).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(SCRIPT_DIR, '..', 'apps', 'mobile', 'src');

/** Light substring patterns; see header for false-positive trade-offs. */
const PATTERN = /fetch\(|XMLHttpRequest|axios|WebSocket\(/g;

/**
 * String literals, including escaped quotes (single, double, backtick).
 * Stripped BEFORE comment detection so a URL like `"https://..."` inside a
 * real call does not make the line look like a comment (`//` is also a URL
 * prefix). Limitation: quoted strings with line-internal quotes are handled
 * by the escape rule; template-literal `${}` bodies are stripped wholesale.
 */
const STRING_LITERAL_PATTERN = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

function stripStringLiterals(line) {
  return line.replace(STRING_LITERAL_PATTERN, '""');
}

/**
 * Explicit allowlist — empty by design. Entry shape:
 *   { file: 'apps/mobile/src/.../file.ts', pattern: 'fetch(', reason: 'why' }
 * `pattern` is optional: when omitted the whole file is exempt.
 */
const ALLOWLIST = [];

const EXCLUDED_DIRS = new Set(['__tests__', '__mocks__']);
const IS_TARGET_FILE = /\.(ts|tsx)$/;
const IS_TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;

/** Comment-marker heuristic; see header. */
function isProbablyComment(line) {
  return line.includes('//') || line.includes('*');
}

/** Recursive, deterministic walk of target files under `root`. */
function walkFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) {
          stack.push(full);
        }
      } else if (entry.isFile() && IS_TARGET_FILE.test(entry.name) && !IS_TEST_FILE.test(entry.name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function scan() {
  const hits = [];
  for (const file of walkFiles(SRC_ROOT)) {
    const rel = path.relative(SRC_ROOT, file).split(path.sep).join('/');
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      // Comment detection runs on the string-stripped line so `"https://..."`
      // URLs never masquerade as `//` comments (shared with the in-test scan).
      const code = stripStringLiterals(line);
      if (isProbablyComment(code)) {
        return;
      }
      for (const match of code.matchAll(PATTERN)) {
        const allowlisted = ALLOWLIST.some(
          (entry) =>
            entry.file === rel && (entry.pattern === undefined || entry.pattern === match[0]),
        );
        if (!allowlisted) {
          hits.push({ file: rel, line: index + 1, pattern: match[0] });
        }
      }
    });
  }
  hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return hits;
}

function main() {
  if (process.argv.includes('--help')) {
    console.log('validate-offline.mjs — scan apps/mobile/src for network API usage');
    console.log('Usage: node scripts/validate-offline.mjs');
    return;
  }

  if (!existsSync(SRC_ROOT)) {
    console.error(`validate-offline: src root not found: ${SRC_ROOT}`);
    process.exitCode = 2;
    return;
  }

  const hits = scan();
  const scanned = walkFiles(SRC_ROOT).length;

  console.log(`validate-offline: scanning ${SRC_ROOT}`);
  console.log(`  files scanned: ${scanned}  (excludes __tests__, __mocks__, *.test.ts, *.spec.ts)`);

  if (hits.length === 0) {
    console.log('  CLEAN — no network API usage outside the allowlist.');
    process.exitCode = 0;
    return;
  }

  console.error('');
  console.error(`  OFFLINE-FIRST VIOLATIONS (${hits.length}):`);
  for (const hit of hits) {
    console.error(`    ${hit.file}:${hit.line}  ${hit.pattern}`);
  }
  console.error('  Every hit is a potential constitution §5 (offline-first) violation.');
  process.exitCode = 1;
}

main();
