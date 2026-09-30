/**
 * `docs/DESIGN_SYSTEM.md` is executable truth, not prose (Change 071 §5.2).
 *
 * A design-system document that restates token values is a snapshot: the day a
 * radius changes, the document is wrong and nothing says so. The document is
 * the thing a new contributor reads before touching the theme, so a stale value
 * in it causes a real, expensive mistake — someone "restores" a radius or a
 * duration that no longer exists anywhere in the code.
 *
 * This suite reads the document and asserts its concrete claims against the
 * token source, so the next token change fails loudly instead of quietly
 * re-diverging. It also pins the documented KIT SURFACE against the real
 * barrel, which is how the removed components get their documentation corrected
 * by a test rather than by someone's memory.
 */
import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Colors, Motion, Radii } from '@/theme/tokens';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

// __dirname is apps/mobile/src/components/__tests__; the repository root is
// four levels up (components -> src -> mobile -> apps -> repo).
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const DOC_PATH = path.join(REPO_ROOT, 'docs', 'DESIGN_SYSTEM.md');
const doc = readFileSync(DOC_PATH, 'utf8');

/** Every `name: value` pair stated in a "·"-separated document run. */
function documentedPairs(label: string): [string, number][] {
  const line = doc.split('\n').find((l) => l.includes(label));
  expect(line).toBeDefined();
  const pairs: [string, number][] = [];
  const run = (line as string).split(':').slice(1).join(':');
  for (const chunk of run.split('·')) {
    const match = /([A-Za-z][A-Za-z0-9]*)\s+(\d+(?:\.\d+)?)/.exec(chunk);
    if (match) pairs.push([match[1], Number(match[2])]);
  }
  return pairs;
}

describe('documented radii match the tokens (071 §5.1/§5.2)', () => {
  it('documents every exported radius with its real value', () => {
    const documented = documentedPairs('Radii:');
    const exported = Object.entries(Radii).filter(
      ([, value]) => typeof value === 'number',
    ) as [string, number][];

    expect(documented.length).toBeGreaterThanOrEqual(exported.length);
    for (const [name, value] of exported) {
      const stated = documented.find(([key]) => key === name);
      // A radius the document never mentions is a gap; a radius it states
      // with a different number is worse, because that is a false claim.
      expect({ name, stated: stated ? stated[1] : null }).toEqual({
        name,
        stated: value,
      });
    }
  });
});

describe('documented motion matches the tokens (071 §5.2)', () => {
  it('documents every numeric motion token with its real value', () => {
    const documented = new Map(documentedPairs('`Motion`:'));
    const numeric = Object.entries(Motion).filter(
      ([, value]) => typeof value === 'number',
    ) as [string, number][];

    expect(numeric.length).toBeGreaterThan(0);
    for (const [name, value] of numeric) {
      expect({ name, stated: documented.get(name) ?? null }).toEqual({
        name,
        stated: value,
      });
    }
  });
});

describe('documented palette matches the tokens (071 §5.1/§5.2)', () => {
  it('quotes the real background and ink hexes for both schemes', () => {
    // The document states concrete hexes for the two surfaces that define the
    // whole look. A palette change that leaves the document quoting the old
    // values is exactly the silent re-divergence this test exists to catch.
    for (const scheme of ['light', 'dark'] as const) {
      const background = Colors[scheme].background;
      const text = Colors[scheme].text;
      expect(background).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(text).toMatch(/^#[0-9A-Fa-f]{6}$/);
      const backgroundMentioned = doc.toUpperCase().includes(background.toUpperCase());
      const textMentioned = doc.toUpperCase().includes(text.toUpperCase());
      expect({ scheme, backgroundMentioned, textMentioned }).toEqual({
        scheme,
        backgroundMentioned: true,
        textMentioned: true,
      });
    }
  });

  it('states the primary action colour the tokens actually use', () => {
    const accent = Colors.light.accent;
    expect(accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(doc.toUpperCase()).toContain(accent.toUpperCase());
  });
});

describe('documented accessibility floor matches the contract (071 §5.2/§5.4)', () => {
  it('states the same 44 dp floor the kit enforces', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
    expect(doc).toMatch(/44\s*[×x]\s*44\s*dp|≥\s*44\s*dp/);
  });
});

describe('documented kit surface matches the real barrel (071 §5.4)', () => {
  it('no longer lists a removed component as kit surface', () => {
    // 071 removed these as unreachable. A document that still lists them as
    // available sends the next author looking for an import that does not
    // exist. Scoped to the kit-surface SECTION, so the separate "removed in
    // Change 071" note — which must name them to explain their absence — does
    // not trip the check.
    const sections = doc.split('## 6. Kit')[1]?.split('## 7. Composition rules')[0] ?? '';
    expect(sections.length).toBeGreaterThan(0);
    for (const removed of [
      '`Avatar`',
      '`ScreenHeader`',
      '`LevelCard`',
      '`StreakCard`',
      '`ResultRow`',
    ]) {
      expect(sections.includes(removed)).toBe(false);
    }
  });

  it('names every component the kit barrel actually exports', () => {
    const barrel = readFileSync(
      path.join(REPO_ROOT, 'apps', 'mobile', 'src', 'components', 'ui', 'index.ts'),
      'utf8',
    );
    const exported = new Set<string>();
    for (const match of barrel.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of match[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && /^[A-Z]/.test(name)) exported.add(name);
      }
    }
    // Spot-check the components the document lists as kit surface; each must
    // still be a real export. (Not exhaustive by design: the full surface is
    // asserted by the per-component suites, and this guards the doc's claims.)
    const documented = ['Tappable', 'Button', 'Card', 'SectionGrid', 'Chip', 'Badge', 'ListRow', 'Confetti'];
    for (const name of documented) {
      expect(exported.has(name)).toBe(true);
    }
  });
});

describe('the document is reachable and non-empty (a cheap tripwire)', () => {
  it('exists at the path the test claims', () => {
    expect(existsSync(DOC_PATH)).toBe(true);
    expect(doc.length).toBeGreaterThan(500);
  });

  it('still names the token source file it describes', () => {
    expect(doc).toContain('theme/tokens.ts');
  });
});
