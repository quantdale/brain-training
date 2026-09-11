/**
 * WCAG contrast utilities + the design-system palette audit.
 *
 * The palette is only trustworthy if its contrast claims are computed, not
 * eyeballed. `auditPalette()` walks the neutral slots, the semantic families
 * and the domain identities and reports every pairing that misses its
 * threshold, so `__tests__/contrast.test.ts` fails a palette edit that silently
 * breaks accessibility.
 *
 * Thresholds (WCAG 2.1): 4.5:1 body text, 3:1 large text / UI boundaries.
 */

import { Colors, DomainColors, Families, type ColorFamily, type SemanticName } from './tokens';

/** Threshold applied to text drawn on a surface. */
export const TEXT_CONTRAST_MIN = 4.5;
/** Threshold applied to large text, fills and component boundaries. */
export const UI_CONTRAST_MIN = 3;

/** Parse `#rgb`/`#rrggbb` to [r, g, b]. */
function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Relative luminance (WCAG 2.1). `linearize` is the sRGB transfer function —
 * named because the 12.92 / 1.055 constants below are otherwise unreadable.
 */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio between two opaque colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** A single contrast claim about the palette. */
export interface ContrastCheck {
  /** `light` | `dark`. */
  scheme: 'light' | 'dark';
  /** Family/neutral name, e.g. `accent` or `text`. */
  name: string;
  /** What is being measured, e.g. `text on surface`. */
  pairing: string;
  foreground: string;
  background: string;
  ratio: number;
  min: number;
  pass: boolean;
}

/** Readable one-line summary used in failure messages. */
export function formatFailure(check: ContrastCheck): string {
  return `${check.scheme} ${check.name} ${check.pairing}: ${check.foreground} on ${check.background} = ${check.ratio.toFixed(2)}:1 (min ${check.min})`;
}

function makeCheck(
  scheme: 'light' | 'dark',
  name: string,
  pairing: string,
  foreground: string,
  background: string,
  min: number,
): ContrastCheck {
  const ratio = contrastRatio(foreground, background);
  return { scheme, name, pairing, foreground, background, ratio, min, pass: ratio >= min };
}

/** Every contrast claim the design system makes for one scheme. */
function checksForScheme(scheme: 'light' | 'dark'): ContrastCheck[] {
  const theme = Colors[scheme];
  const families: Record<SemanticName, ColorFamily> = Families[scheme];
  const domains: Record<string, ColorFamily> = DomainColors[scheme];
  const checks: ContrastCheck[] = [];

  // Neutrals: copy must be readable on the page and on cards alike.
  for (const neutral of ['text', 'textSecondary', 'textMuted'] as const) {
    checks.push(makeCheck(scheme, neutral, 'on surface', theme[neutral], theme.surface, TEXT_CONTRAST_MIN));
    checks.push(makeCheck(scheme, neutral, 'on background', theme[neutral], theme.background, TEXT_CONTRAST_MIN));
  }
  // Interactive boundaries must be distinguishable from the surface.
  checks.push(makeCheck(scheme, 'borderStrong', 'on surface', theme.borderStrong, theme.surface, UI_CONTRAST_MIN));

  // Semantic families.
  for (const [name, family] of Object.entries(families)) {
    checks.push(makeCheck(scheme, name, 'text on surface', family.text, theme.surface, TEXT_CONTRAST_MIN));
    checks.push(makeCheck(scheme, name, 'text on background', family.text, theme.background, TEXT_CONTRAST_MIN));
    checks.push(makeCheck(scheme, name, 'base on surface', family.base, theme.surface, UI_CONTRAST_MIN));
    checks.push(makeCheck(scheme, name, 'softText on soft', family.softText, family.soft, TEXT_CONTRAST_MIN));
    checks.push(makeCheck(scheme, name, 'on/base', family.on, family.base, TEXT_CONTRAST_MIN));
  }

  // Domain identities.
  for (const [name, family] of Object.entries(domains)) {
    checks.push(makeCheck(scheme, `domain:${name}`, 'text on surface', family.text, theme.surface, TEXT_CONTRAST_MIN));
    checks.push(makeCheck(scheme, `domain:${name}`, 'base on surface', family.base, theme.surface, UI_CONTRAST_MIN));
    checks.push(makeCheck(scheme, `domain:${name}`, 'softText on soft', family.softText, family.soft, TEXT_CONTRAST_MIN));
    checks.push(makeCheck(scheme, `domain:${name}`, 'on/base', family.on, family.base, TEXT_CONTRAST_MIN));
  }

  return checks;
}

/** All contrast claims for both schemes. */
export function auditPalette(): ContrastCheck[] {
  return [...checksForScheme('light'), ...checksForScheme('dark')];
}

/** Subset of {@link auditPalette} that fails its threshold. */
export function paletteFailures(): ContrastCheck[] {
  return auditPalette().filter((check) => !check.pass);
}
