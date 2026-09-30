/**
 * Navigation contract guard (Change 072 §5).
 *
 * Widenings over the phase-2 game guard this file grew from, each for a reason
 * the narrow version could not see:
 *
 * 1. **SCOPE.** The original scanned only the 42 game screen modules under
 *    `src/games`, because that was where a bare `router.back()` had been found
 *    and the catalog scanners treat every directory there as a game module. A
 *    guard scoped to the directory where the bug was found is not a guard: the
 *    same mistake in an app route, a component, or a new top-level module is
 *    invisible. This scans every `.ts`/`.tsx` under `src`, minus tests.
 *
 * 2. **BYPASS RESISTANCE.** The original negative pattern was
 *    `/router\.back\s*\(/`, which misses `router . back (`, `router?.back(`,
 *    `router['back'](`, and an aliased import. A negative guard that can be
 *    defeated by whitespace is documentation, not enforcement, so the patterns
 *    here tolerate arbitrary spacing and the alternative call shapes, and
 *    ALLOW a named exemption rather than a silent hole.
 *
 * 3. **TOP-LEVEL DEPTH.** A new rule from §4: a top-level destination pushed
 *    instead of replaced grows the stack on every tap, so a tab bar that looks
 *    stateless is backed by a history. The classification is the shared
 *    `isTopLevelHref` predicate, not a second list that could disagree.
 */
import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { TOP_LEVEL_HREFS, isTopLevelHref } from '@/components/navigation-depth';

const SRC = resolve(__dirname, '..');

/**
 * Strip comments before scanning.
 *
 * Without this the guard fails on its own documentation: this file, the
 * `useSafeBack` helper, and the game host all WRITE "never a bare
 * `router.back()`" in prose, and a naive pattern match reads that sentence as
 * the defect. A guard that must be weakened because it is describing the rule
 * is a guard that will eventually be deleted.
 *
 * This is a deliberately simple scanner — a real parser would be better, but
 * it only has to be right about the distinction that matters here: code
 * versus a comment, and a string literal versus both. Regex literals are the
 * one construct it can confuse, and they are handled by only stripping
 * sequences that do not begin with a `/` preceded by a non-`/` char.
 */
function stripComments(source: string): string {
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
      if (ch === '\n') {
        inLine = false;
        out += ch;
      }
      i += 1;
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false;
        // Keep the newlines so the result still lines up with the input.
        out += '  ';
        i += 2;
        continue;
      }
      out += ch === '\n' ? '\n' : ' ';
      i += 1;
      continue;
    }
    if (quote !== null) {
      out += ch;
      if (ch === '\\') {
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
    if (ch === '"' || ch === '\'' || ch === '`') {
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

/** POSIX-normalized path relative to `src`, so assertions are platform-agnostic. */
function relOf(file: string): string {
  return relative(SRC, file).split(sep).join('/');
}

/** Every navigable source file: all of `src`, minus tests and fixtures. */
function sourceFiles(dir: string = SRC): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue;
    // Fixtures are data, not navigation code.
    if (entry.endsWith('.d.ts')) continue;
    out.push(full);
  }
  return out;
}

/**
 * The one place a bare back is legal: the shared helper that implements the
 * empty-stack fallback. Named rather than pattern-matched so ADDING a second
 * one is a visible, reviewable act.
 */
// Paths are POSIX-normalized in `relOf`, so the allowlist is too.
const BACK_IMPL_ALLOWLIST = new Set(['components/ui/back-link.tsx']);
/** The classification module, which documents the pattern it forbids. */
const CLASSIFICATION_MODULE = 'components/navigation-depth.ts';

/**
 * Bypass-resistant negative patterns.
 *
 * `router . back (`, `router?.back(`, `router['back'](`, `navigation.goBack()`
 * and `router["back"] (` are all the same defect with different spelling, and a
 * reviewer under time pressure will reach for whichever one the guard does not
 * catch. Each pattern is written to survive whitespace and quote style.
 */
const BARE_BACK_PATTERNS: { re: RegExp; why: string }[] = [
  { re: /router\s*\??\.\s*back\s*\(/, why: 'router.back()' },
  { re: /router\s*\[\s*['"`]back['"`]\s*\]\s*\(/, why: "router['back']()" },
  { re: /navigation\s*\??\.\s*goBack\s*\(/, why: 'navigation.goBack()' },
  { re: /useNavigation\(\)[\s\S]{0,80}?\.\s*goBack\s*\(/, why: 'useNavigation().goBack()' },
];

/** A top-level destination pushed rather than replaced. */
const TOP_LEVEL_PUSH =
  /router\s*\.\s*push\s*\(\s*['"`]([^'"`$]*)['"`]\s*\)/g;

describe('navigation contract: no bare back outside the shared helper', () => {
  it('finds a bare back nowhere in src', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const rel = relOf(file);
      if (BACK_IMPL_ALLOWLIST.has(rel)) continue;
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const { re, why } of BARE_BACK_PATTERNS) {
        if (re.test(source)) offenders.push(`${rel}: ${why}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ignores a bare back that appears only in a comment or a string', () => {
    // Without comment stripping the guard fails on its own prose, which is how
    // a guard gets deleted rather than fixed.
    expect(stripComments('// never call router.back() here').includes('router.back()')).toBe(false);
    expect(stripComments('/* router.back() is unsafe */').includes('router.back()')).toBe(false);
    expect(stripComments('const s = "router.back()";').includes('router.back()')).toBe(true);
    // Real code must still be visible.
    expect(stripComments('// note\nrouter.back();').includes('router.back()')).toBe(true);
  });

  it('still scans the game screens it originally covered', () => {
    // Guards the guard: a scope change that accidentally excluded `games/`
    // would otherwise silently narrow the 42-screen coverage this file started
    // with.
    const gameScreens = sourceFiles().filter((f) => /src[\\/]games[\\/].*[\\/]screen\.tsx$/.test(f));
    expect(gameScreens.length).toBe(42);
    for (const file of gameScreens) {
      const source = readFileSync(file, 'utf8');
      expect(source).toMatch(/useSafeBack\(\s*['"]\/games['"]\s*\)/);
    }
  });

  it('detects every spelling of a bare back it claims to detect', () => {
    // The bypass-resistance claim is only credible if it is tested against the
    // spellings it promises to catch.
    const samples: [string, boolean][] = [
      ['router.back()', true],
      ['router . back ();', true],
      ['router?.back();', true],
      ['router["back"]();', true],
      ['navigation.goBack();', true],
      ['// router.back() is handled by the helper', false],
      ['backOrFallback(canGoBack)', false],
    ];
    for (const [line, shouldMatch] of samples) {
      const matched = BARE_BACK_PATTERNS.some(({ re }) => re.test(line));
      expect({ line, matched, shouldMatch }).toEqual({ line, matched, shouldMatch });
    }
  });
});

describe('navigation contract: top-level destinations are replaced, not pushed', () => {
  it('pushes no top-level destination outside the classification module', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const rel = relOf(file);
      if (rel === CLASSIFICATION_MODULE) continue;
      const source = stripComments(readFileSync(file, 'utf8'));
      for (const match of source.matchAll(TOP_LEVEL_PUSH)) {
        if (isTopLevelHref(match[1])) {
          offenders.push(`${rel}: push("${match[1]}") — a top-level destination must be replaced`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('classifies places as top-level and detail screens as nested', () => {
    // The guard's classifier is a shared decision, so it gets its own test
    // rather than being trusted through the guard that consumes it.
    for (const href of ['/games', '/progress', '/rewards', '/data-management', '/results', '/']) {
      expect(isTopLevelHref(href)).toBe(true);
    }
    for (const href of [
      '/game/memory',
      '/game-detail/memory',
      '/progress-detail',
      '/progress-domain?domain=memory',
      '/progress-game?gameId=memory',
      '/progress-activity',
    ]) {
      expect(isTopLevelHref(href)).toBe(false);
    }
    // Query strings and trailing slashes must not change the classification,
    // or a href built at runtime would slip past the guard.
    expect(isTopLevelHref('/progress?x=1')).toBe(true);
    expect(isTopLevelHref('/games/')).toBe(true);
  });

  it('keeps every tab destination in the top-level set', () => {
    // A tab that is not in the set would be pushed, and the stack would grow on
    // every tap — so the set is checked against the tab routes themselves.
    expect(TOP_LEVEL_HREFS).toEqual(expect.arrayContaining([
      '/',
      '/games',
      '/progress',
      '/profile',
      '/rewards',
    ]));
  });
});
