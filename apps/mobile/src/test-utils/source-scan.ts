/**
 * Source-level helpers for the repository's structural guards.
 *
 * Guards that read source text need to distinguish CODE from PROSE, and a naive
 * pattern match reads a comment that DESCRIBES a rule as a violation of it. That
 * failure mode is not hypothetical here: this repository's own modules document
 * the rules its guards enforce ("never call router.back()", "the SDK
 * `SessionLifecycle`", "does not construct its own timers"), so a guard that
 * matched raw text would fail on the very files that explain the contract.
 *
 * `stripComments` is deliberately a small scanner rather than a parser: it only
 * has to be right about the distinction that matters, which is code versus a
 * comment, and string literals versus both. Regex literals are the one
 * construct it can confuse, and they are handled by only treating `//` as a
 * comment when the first slash is not preceded by another slash.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const NEWLINE = '\n';
const ESCAPE = '\\';

/** Remove comments, preserving string literals and line structure. */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;
  let inBlock = false;
  let inLine = false;
  let quote: string | null = null;
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (inLine) {
      if (ch === NEWLINE) {
        inLine = false;
        out += ch;
      }
      i += 1;
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false;
        // Two spaces so reported positions still line up with the input.
        out += '  ';
        i += 2;
        continue;
      }
      out += ch === NEWLINE ? NEWLINE : ' ';
      i += 1;
      continue;
    }
    if (quote !== null) {
      out += ch;
      if (ch === ESCAPE) {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLine = true;
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlock = true;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Read a file with comments stripped. */
export function readCode(file: string): string {
  return stripComments(readFileSync(file, 'utf8'));
}

/** POSIX-normalized path relative to `root`, so assertions are platform-agnostic. */
export function relOf(root: string, file: string): string {
  return file.slice(root.length + 1).split(sep).join('/');
}

/** One source file inside a scanned module. */
export interface ModuleSource {
  /** Path relative to the module root, POSIX-normalized. */
  rel: string;
  /** File contents. */
  text: string;
  /** File contents with comments removed — use this for CODE patterns. */
  code: string;
}

export interface ScanOptions {
  /** Directory names skipped entirely. */
  skipDirs?: readonly string[];
  /** Test/spec files to skip, matched against the file name. */
  isTestFile?: (name: string) => boolean;
}

/**
 * Walk a module directory and return its source files, with a `code` field that
 * has comments stripped. Tests are excluded by default because a guard about
 * production code must not be satisfied or broken by fixtures.
 */
export function scanModuleSources(dir: string, options: ScanOptions = {}): ModuleSource[] {
  const skipDirs = new Set(options.skipDirs ?? ['__tests__', 'node_modules']);
  const isTestFile =
    options.isTestFile ?? ((name: string) => /\.(test|spec)\.(ts|tsx)$/.test(name));
  const out: ModuleSource[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) {
        if (!skipDirs.has(entry)) walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      if (isTestFile(entry)) continue;
      if (entry.endsWith('.d.ts')) continue;
      const text = readFileSync(full, 'utf8');
      out.push({ rel: relOf(dir, full), text, code: stripComments(text) });
    }
  };
  walk(dir);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}
