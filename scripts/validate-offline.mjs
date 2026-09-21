#!/usr/bin/env node
/**
 * validate-offline.mjs — static offline-first boundary check (constitution §5,
 * campaign 003, packet WP-3D; hardened in campaign 028).
 *
 * Scans `apps/mobile/src` (recursively) for network APIs — `fetch`,
 * `XMLHttpRequest`, `axios`, `WebSocket`, `EventSource`, `sendBeacon`,
 * aliased/dynamic global access to them, and banned network package
 * specifiers (`axios`, `expo/fetch`, `expo-network`, `node-fetch`,
 * `cross-fetch`, `undici`, `got`, `superagent`) — outside an explicit
 * allowlist and outside test artifacts. Prints a deterministic table of hits
 * (file:line + pattern, sorted) and exits 0 when clean, 1 when violations
 * are found.
 *
 * Usage (from the repo root):
 *   node scripts/validate-offline.mjs            # scan
 *   node scripts/validate-offline.mjs --check    # same scan (explicit CI alias)
 *   node scripts/validate-offline.mjs --self-test  # offline fixture self-test
 *
 * Exclusions:
 *   - `__tests__` / `__mocks__` directories and `*.test.ts` / `*.spec.ts`
 *   - ALLOWLIST entries below (empty by design; name + comment any exception)
 *
 * Detection model (campaign 028):
 *   - String literals are stripped before matching, so URLs (`"https://..."`)
 *     cannot masquerade as `//` comments; a network API whose name exists only
 *     inside a string literal is not flagged.
 *   - Comment handling truncates at the first real `//` or block-comment start
 *     (outside strings) and skips JSDoc `*` continuation lines. A line is no
 *     longer skipped wholesale because it contains `*` (old false negative:
 *     `const n = a * b; fetch(u)` was silently ignored) or a trailing comment.
 *   - Dynamic global access (`globalThis['fetch']`) is scanned on the raw line
 *     because string stripping blanks the bracket key; dot access and
 *     destructuring aliases are scanned on the stripped code.
 *   - Banned package specifiers are scanned on the raw code (before string
 *     stripping), so `import { get } from 'axios'` is caught even though the
 *     module name lives inside a string literal. This is the static authority
 *     for imported network libraries, which a runtime global ban cannot
 *     intercept.
 *
 * Known limitations (not silent passes — the in-jest monkeypatch suite in
 * `apps/mobile/src/__tests__/offline-boundary.test.ts` is the authoritative
 * runtime proof):
 *   - Regex literals containing `//` (e.g. /https?:\/\//) still truncate the
 *     line at that point; computed/assembled API names (`'f'+'etch'`) and
 *     `require('axios')` string forms are not reconstructed.
 *   - Property methods named `fetch` on non-global objects are flagged as
 *     false positives; allowlist the file/pattern if that ever occurs.
 *   - The banned-specifier scan runs on the raw line, so a prose string that
 *     literally contains `from 'axios'` (e.g. documentation text inside a
 *     string) is flagged; that is the price of seeing through string
 *     stripping, and the fix is an allowlist entry, not a weaker scan.
 *
 * No dependencies: plain ESM using node:fs / node:path only. Deterministic
 * output (hits sorted by file and line).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(SCRIPT_DIR, '..', 'apps', 'mobile', 'src');

/**
 * Name patterns scanned against string-stripped, comment-truncated code.
 * `\b` keeps `refetch(` from matching `fetch` while still catching `fetch (`.
 */
const CODE_PATTERNS = [
  { name: 'fetch', re: /\bfetch\s*\(/g },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/g },
  { name: 'axios', re: /\baxios\b/g },
  { name: 'WebSocket', re: /\bWebSocket\s*\(/g },
  { name: 'EventSource', re: /\bEventSource\s*\(/g },
  { name: 'sendBeacon', re: /\bsendBeacon\s*\(/g },
  {
    name: 'global-dot-access',
    re: /\b(?:globalThis|global|window)\s*\.\s*(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/g,
  },
  {
    name: 'destructured-global',
    re: /\{\s*(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\s*[,:}]/g,
  },
];

/** Raw-line pattern: string stripping would blank the bracket key. */
const BRACKET_GLOBAL_PATTERN =
  /\b(?:globalThis|global|window)\s*\[\s*["'`](?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)["'`]\s*\]/g;

/**
 * Network-capable packages banned from the app source. The identifier scan
 * above cannot see `import { get } from 'axios'` (the specifier is a string
 * literal, stripped before matching), and a runtime global ban cannot
 * intercept an imported module — this raw-code scan is the authority for
 * both. Relative paths and same-named local modules are not flagged.
 */
const BANNED_MODULE_SPECIFIERS = new Set([
  'axios',
  'expo/fetch',
  'expo-network',
  'node-fetch',
  'cross-fetch',
  'undici',
  'got',
  'superagent',
]);

/** Import/require specifier shapes scanned on the raw (unstripped) code. */
const MODULE_SPECIFIER_PATTERNS = [
  /\bfrom\s*['"`]([^'"`]+)['"`]/g,
  /\brequire\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  /\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
  // Side-effect-only import: `import 'pkg';`.
  /\bimport\s*['"`]([^'"`]+)['"`]/g,
];

/**
 * `import(/* bundler comment *\/ 'pkg')` needs the raw line: comment
 * truncation would cut the specifier away. Scanned separately, skipping
 * full-line comments so commented-out code stays ignored.
 */
const COMMENTED_DYNAMIC_IMPORT_PATTERN =
  /\bimport\s*\(\s*\/\*[\s\S]*?\*\/\s*['"`]([^'"`]+)['"`]\s*\)/g;

function isBannedSpecifier(specifier) {
  if (BANNED_MODULE_SPECIFIERS.has(specifier)) return true;
  for (const banned of BANNED_MODULE_SPECIFIERS) {
    if (specifier.startsWith(`${banned}/`)) return true;
  }
  return false;
}

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
 * Code text before any real comment. JSDoc continuation lines (`* ...`) and
 * full-line comments are empty. Block comments truncate at `/*`.
 */
function codeBeforeComment(line) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
    return '';
  }
  let cut = line.length;
  const slash = line.indexOf('//');
  if (slash >= 0) cut = Math.min(cut, slash);
  const block = line.indexOf('/*');
  if (block >= 0) cut = Math.min(cut, block);
  return line.slice(0, cut);
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

/**
 * Pure per-text scanner: returns `{line, pattern}` hits. Exposed for the
 * self-test so every detection class is pinned offline.
 */
export function scanText(text) {
  const hits = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((line, index) => {
    const stripped = stripStringLiterals(line);
    const code = codeBeforeComment(stripped);
    if (code.trim()) {
      for (const { name, re } of CODE_PATTERNS) {
        for (const _match of code.matchAll(re)) {
          hits.push({ line: index + 1, pattern: name });
        }
      }
    }
    // Banned package specifiers: scanned on the raw code so the string
    // literal containing the module name is still visible.
    const rawCode = codeBeforeComment(line);
    if (rawCode.trim()) {
      for (const re of MODULE_SPECIFIER_PATTERNS) {
        for (const match of rawCode.matchAll(re)) {
          if (isBannedSpecifier(match[1])) {
            hits.push({ line: index + 1, pattern: 'network-module-specifier' });
          }
        }
      }
    }
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('*') && !trimmed.startsWith('/*') && !trimmed.startsWith('//')) {
      for (const match of line.matchAll(COMMENTED_DYNAMIC_IMPORT_PATTERN)) {
        if (isBannedSpecifier(match[1])) {
          hits.push({ line: index + 1, pattern: 'network-module-specifier' });
        }
      }
    }
    // Dynamic bracket access: the raw line keeps the key inside the string.
    for (const _match of line.matchAll(BRACKET_GLOBAL_PATTERN)) {
      hits.push({ line: index + 1, pattern: 'global-bracket-access' });
    }
  });
  return hits;
}

function scan() {
  const hits = [];
  for (const file of walkFiles(SRC_ROOT)) {
    const rel = path.relative(SRC_ROOT, file).split(path.sep).join('/');
    for (const hit of scanText(readFileSync(file, 'utf8'))) {
      const allowlisted = ALLOWLIST.some(
        (entry) => entry.file === rel && (entry.pattern === undefined || entry.pattern === hit.pattern),
      );
      if (!allowlisted) {
        hits.push({ file: rel, line: hit.line, pattern: hit.pattern });
      }
    }
  }
  hits.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.pattern.localeCompare(b.pattern));
  return hits;
}

function selfTest() {
  let pass = 0;
  let fail = 0;
  const expect = (cond, name) => {
    if (cond) {
      pass += 1;
    } else {
      fail += 1;
      console.error(`SELF-TEST FAIL: ${name}`);
    }
  };
  const hitCount = (text, pattern) =>
    scanText(text).filter((h) => !pattern || h.pattern === pattern).length;

  // Direct calls, whitespace-tolerant, and the refetch false positive avoided.
  expect(hitCount('const r = fetch(url);', 'fetch') === 1, 'direct fetch detected');
  expect(hitCount('const r = fetch (url);', 'fetch') === 1, 'whitespace fetch detected');
  expect(hitCount('const r = refetch(url);') === 0, 'refetch is not fetch');
  expect(hitCount('new WebSocket (url);') === 1, 'whitespace WebSocket detected');
  expect(hitCount('new EventSource(url);') === 1, 'EventSource detected');
  expect(hitCount('navigator.sendBeacon(url, data);') === 1, 'sendBeacon detected');
  expect(hitCount('const r = axios.get(url);') === 1, 'axios detected');

  // Aliasing and dynamic access.
  expect(hitCount('const go = globalThis.fetch; go(u);') === 1, 'globalThis.fetch alias detected');
  expect(hitCount('const { fetch: f } = globalThis; f(u);') === 1, 'destructured fetch detected');
  expect(hitCount("globalThis['fetch'](u);") === 1, 'bracket fetch detected');
  expect(hitCount('window[`WebSocket`](u);') === 1, 'bracket WebSocket detected');

  // Comment/multiplication regressions (the old heuristic skipped any line
  // containing `*` or `//`, hiding real calls).
  expect(hitCount('const n = retries * 2; fetch(u);', 'fetch') === 1, 'multiplication line still scanned');
  expect(hitCount('// fetch(u) in a comment') === 0, 'full-line comment ignored');
  expect(hitCount('doThing(); // fetch(u)') === 0, 'trailing comment ignored');
  expect(hitCount('/* fetch(u) */') === 0, 'block comment ignored');
  expect(hitCount(' * fetch(u) in jsdoc') === 0, 'jsdoc continuation ignored');
  expect(hitCount('const url = "https://example.com/fetch(data)";') === 0, 'string literal ignored');
  expect(hitCount('// note: refetch() then axios') === 0, 'pattern name inside comment ignored');

  // Banned package specifiers (campaign 064): the identifier scan cannot see
  // a specifier that only exists inside a string literal.
  expect(hitCount(`import { get } from 'axios';`) === 1, 'axios specifier import detected');
  expect(hitCount(`const client = require('got');`) === 1, 'require specifier detected');
  expect(hitCount(`const mod = await import('node-fetch');`) === 1, 'dynamic import specifier detected');
  expect(hitCount(`import * as ExpoFetch from 'expo/fetch';`) === 1, 'expo/fetch specifier detected');
  expect(
    hitCount(`import { fetch } from 'expo/fetch';`) === 2,
    'expo/fetch destructured fetch and specifier are both detected',
  );
  expect(hitCount(`import * as Network from 'expo-network';`) === 1, 'expo-network specifier detected');
  expect(hitCount(`import axiosRetry from 'axios-retry';`) === 0, 'unrelated same-prefix package not flagged');
  expect(hitCount(`import 'axios';`) === 1, 'side-effect import specifier detected');
  expect(
    hitCount(`const m = await import(/* chunk */ 'axios');`) === 1,
    'dynamic import with a bundler comment is detected',
  );
  expect(hitCount(`const m = await import(\`axios\`);`) === 1, 'template-literal dynamic import is detected');
  expect(hitCount(`import { get } from './fetch-utils';`) === 0, 'relative specifier not flagged');
  expect(hitCount(`// import { get } from 'axios';`) === 0, 'commented specifier ignored');

  console.log(`Offline validator self-test: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

function main() {
  if (process.argv.includes('--help')) {
    console.log('validate-offline.mjs — scan apps/mobile/src for network API usage');
    console.log('Usage: node scripts/validate-offline.mjs [--check] [--self-test]');
    return;
  }

  if (process.argv.includes('--self-test')) {
    process.exitCode = selfTest() ? 0 : 1;
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
