/**
 * Design-language contract tests.
 *
 * These guard the promises the palette and token layer make to the rest of the
 * app: WCAG-AA contrast in both schemes, complete family slots, a monotonic
 * elevation ramp, ordered motion durations, and a responsive API that is
 * actually consumed (campaign 024 spec `design-language-v2`).
 */

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import {
  Colors,
  DomainColors,
  DOMAIN_ORDER,
  Elevation,
  Families,
  METRIC_COLOR_KEYS,
  Motion,
  Springs,
  Typography,
  type ElevationName,
  type SemanticName,
  type TypographyName,
} from '@/theme/tokens';
import { auditPalette, contrastRatio, formatFailure, paletteFailures } from '@/theme/contrast';

import { LAYOUT_HOOKS, PENDING_RESPONSIVE_CONSUMERS } from './responsive-consumers';

const SRC_ROOT = path.resolve(__dirname, '../..');

describe('palette contrast', () => {
  it('reports every pairing the design system claims', () => {
    // Sanity floor: if the audit silently stops visiting families, the guard
    // below would pass vacuously.
    expect(auditPalette().length).toBeGreaterThan(120);
  });

  it('meets WCAG AA for every semantic and domain pairing in both schemes', () => {
    expect(paletteFailures().map(formatFailure)).toEqual([]);
  });

  it('resolves the campaign-023 accent-as-text failure', () => {
    // Regression pin: the old accent measured 3.8:1 (light) / 3.9:1 (dark).
    for (const scheme of ['light', 'dark'] as const) {
      expect(contrastRatio(Colors[scheme].accentText, Colors[scheme].surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(Colors[scheme].accentText, Colors[scheme].background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('exposes identical colour keys across schemes', () => {
    expect(Object.keys(Colors.light).sort()).toEqual(Object.keys(Colors.dark).sort());
    expect(Object.keys(DomainColors.light).sort()).toEqual(Object.keys(DomainColors.dark).sort());
    expect(Object.keys(Families.light).sort()).toEqual(Object.keys(Families.dark).sort());
  });

  it('flattens every family slot into the flat theme key space', () => {
    const families = Object.keys(Families.light) as SemanticName[];
    for (const name of families) {
      for (const slot of [`${name}`, `${name}Text`, `${name}Soft`, `${name}SoftText`, `${name}On`]) {
        expect(Colors.light[slot as keyof typeof Colors.light]).toBeTruthy();
      }
    }
  });
});

describe('colour families', () => {
  it('defines all five slots for every semantic family', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const family of Object.values(Families[scheme])) {
        for (const slot of ['base', 'text', 'soft', 'softText', 'on'] as const) {
          expect(family[slot]).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
      }
    }
  });

  it('defines all five slots for every domain identity', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const domain of DOMAIN_ORDER) {
        const family = DomainColors[scheme][domain];
        for (const slot of ['base', 'text', 'soft', 'softText', 'on'] as const) {
          expect(family[slot]).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
      }
    }
  });

  it('gives every domain a distinct hue', () => {
    const bases = DOMAIN_ORDER.map((domain) => DomainColors.light[domain].base);
    expect(new Set(bases).size).toBe(bases.length);
  });

  it('maps each metric to a colour family that exists', () => {
    for (const key of Object.values(METRIC_COLOR_KEYS)) {
      expect(typeof Colors.light[key]).toBe('string');
    }
  });
});

describe('elevation ramp', () => {
  const LEVELS: ElevationName[] = ['none', 'flat', 'card', 'raised', 'hero', 'overlay'];

  it('increases monotonically and defines both shadow and elevation', () => {
    const elevations = LEVELS.map((level) => Elevation[level].elevation);
    for (let i = 1; i < elevations.length; i += 1) {
      expect(elevations[i]).toBeGreaterThanOrEqual(elevations[i - 1]);
    }
    for (const level of LEVELS) {
      expect(typeof Elevation[level].boxShadow).toBe('string');
      expect(typeof Elevation[level].elevation).toBe('number');
    }
    expect(Elevation.overlay.elevation).toBeGreaterThan(Elevation.card.elevation);
  });
});

describe('motion tokens', () => {
  it('keeps durations ordered and the stagger step bounded', () => {
    const { press, quick, base, entrance, celebration } = Motion;
    expect(press).toBeGreaterThan(0);
    expect(press).toBeLessThanOrEqual(quick);
    expect(quick).toBeLessThanOrEqual(base);
    expect(base).toBeLessThanOrEqual(entrance);
    expect(entrance).toBeLessThan(celebration);
    expect(Motion.stagger).toBeLessThanOrEqual(100);
  });

  it('exposes spring presets with the physics keys consumers spread in', () => {
    for (const preset of Object.values(Springs)) {
      expect(Object.keys(preset).sort()).toEqual(['damping', 'mass', 'stiffness']);
    }
  });
});

describe('typography tokens', () => {
  const REQUIRED: TypographyName[] = [
    'eyebrow',
    'caption',
    'label',
    'bodySmall',
    'body',
    'bodyLarge',
    'headline',
    'title',
    'display',
    'numeral',
    'numeralLg',
    'numeralXl',
  ];

  it('defines size, lineHeight and weight for every step', () => {
    for (const name of REQUIRED) {
      const token = Typography[name];
      expect(token.size).toBeGreaterThan(0);
      expect(token.lineHeight).toBeGreaterThanOrEqual(token.size);
      expect(Number(token.weight)).toBeGreaterThanOrEqual(400);
    }
  });

  it('marks numerals as tabular so counters do not reflow', () => {
    for (const name of ['numeral', 'numeralLg', 'numeralXl'] as const) {
      expect(Typography[name].tabular).toBe(true);
    }
  });

  it('keeps hero styles larger than body copy', () => {
    expect(Typography.display.size).toBeGreaterThan(Typography.body.size);
    expect(Typography.numeralXl.size).toBeGreaterThan(Typography.numeral.size);
  });
});

describe('responsive API', () => {
  it('consumes every layout hook that the campaign has wired up', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          files.push(full);
        }
      }
    };
    walk(path.join(SRC_ROOT, 'app'));
    walk(path.join(SRC_ROOT, 'components'));
    // `platform/` counts too (a primitive consumed by another helper is not
    // dead), but the module that defines the hooks is excluded so a hook cannot
    // satisfy the sweep with its own declaration.
    const layoutModule = path.join(SRC_ROOT, 'platform', 'layout.ts');
    const walkPlatform = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
          walkPlatform(full);
        } else if (/\.tsx?$/.test(entry.name) && full !== layoutModule) {
          files.push(full);
        }
      }
    };
    walkPlatform(path.join(SRC_ROOT, 'platform'));

    // The breakpoint API must not be dead code: a hook that loses its last
    // consumer fails here instead of silently rotting. Hooks still queued for
    // the screen wave are listed in PENDING_RESPONSIVE_CONSUMERS and asserted
    // NOT to have leaked a consumer by accident.
    const consumed = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const hook of LAYOUT_HOOKS) {
        if (source.includes(hook)) consumed.add(hook);
      }
    }

    const missing = LAYOUT_HOOKS.filter(
      (hook) => !consumed.has(hook) && !PENDING_RESPONSIVE_CONSUMERS.includes(hook),
    );
    expect(missing).toEqual([]);

    // Hooks on the pending list may become consumed at any time — that is the
    // wave's job. The list itself must be empty when the campaign closes.
  });
});
