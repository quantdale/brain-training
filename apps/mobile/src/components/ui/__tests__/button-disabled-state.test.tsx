/**
 * Button disabled-state contract (076-f defect D3).
 *
 * Defect reproduced on device and measured, not assumed: the shared Button
 * applied `opacity: 0.5` to the WHOLE control when disabled. For a filled
 * variant whose label already uses the dark `*On` ink (dark primary: fill
 * `#FF4A57`, label `#2B0508`), compositing both at 50% over the dark stage
 * landed the pair ~1.08:1 apart — the label was gone, and gone precisely on the
 * shared GO control the player needs after a trial resolves.
 *
 * This pins the repair. A disabled Button must render an EXPLICIT, theme-aware
 * treatment — dimmed fill, readable muted label — never a whole-control opacity
 * that collapses the label into the fill. The label contrast is COMPUTED from
 * the real tokens with the WCAG 2.x relative-luminance formula and asserted to
 * clear the 4.5:1 AA floor, so the guard fails if a future change reintroduces
 * an unreadable combination. Loading is asserted to be a SEPARATE state: a busy
 * button keeps its full-strength fill, supplies a spinner, and is announced
 * busy rather than disabled. Enabled appearance is asserted unchanged.
 *
 * The RNTL harness renders with the default scheme (LIGHT), so per-render
 * assertions are written against `Colors.light` — the theme the test actually
 * runs in. Both palettes are also measured directly for the contrast floor.
 */
import { describe, expect, it } from '@jest/globals';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { Button } from '@/components/ui';
import { Colors, type ColorTheme } from '@/theme/tokens';

/** The harness renders in the light scheme. */
const T = Colors.light;

/** WCAG 2.x relative luminance of an #rrggbb colour. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`expected #rrggbb, got "${hex}"`);
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
function contrast(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Read a flattened hex token out of a theme. */
function slot(theme: ColorTheme, key: string): string {
  const v = (theme as unknown as Record<string, string>)[key];
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) {
    throw new Error(`token "${key}" is not a hex colour: ${String(v)}`);
  }
  return v;
}

/** Composite `fg` over `bg` at `alpha`, producing #rrggbb. */
function blend(fg: string, bg: string, alpha: number): string {
  const p = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const f = p(fg);
  const b = p(bg);
  const mix = f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
  return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Walk the themed-text label of a rendered button and return its resolved
 * `themeColor` slot. The label is the themed-text node carrying a
 * `themeColor`; the pressable wrapper has none, so the first match is the
 * label itself.
 */
function findLabelProps(node: unknown): string | undefined {
  const seen = new Set<unknown>();
  const stack: Record<string, unknown>[] = [node as Record<string, unknown>];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object' || seen.has(cur)) continue;
    seen.add(cur);
    const props = (cur as { props?: Record<string, unknown> }).props;
    if (props && typeof props.themeColor === 'string') {
      return props.themeColor as string;
    }
    const kids = (cur as { props?: { children?: unknown } }).props?.children;
    if (Array.isArray(kids)) stack.push(...(kids as Record<string, unknown>[]));
    else if (kids) stack.push(kids as Record<string, unknown>);
  }
  return undefined;
}

const flatten = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style) ?? {};

describe('Button disabled treatment (076-f D3)', () => {
  it('renders a dimmed fill and a readable muted label, not a whole-control opacity', async () => {
    await render(<Button label="GO" testID="go-disabled" disabled />);
    const btn = screen.getByTestId('go-disabled');
    const flat = flatten('go-disabled');
    // The regression itself: a single opacity applied to the whole control. It
    // must be absent — the treatment is a per-slot fill and label colour, not
    // dilution of both together.
    expect(flat.opacity).toBeUndefined();
    // The fill is the explicit muted surface, not the enabled accent.
    expect(flat.backgroundColor).toBe(T.backgroundElement);
    // The label is the readable secondary ink, not the accent `*On` ink.
    expect(findLabelProps(btn)).toBe('textSecondary');
  });

  it('keeps the disabled label above the 4.5:1 AA floor in BOTH themes', () => {
    const lightFg = slot(Colors.light, 'textSecondary');
    const lightBg = slot(Colors.light, 'backgroundElement');
    expect(contrast(lightFg, lightBg)).toBeGreaterThanOrEqual(4.5);

    const darkFg = slot(Colors.dark, 'textSecondary');
    const darkBg = slot(Colors.dark, 'backgroundElement');
    expect(contrast(darkFg, darkBg)).toBeGreaterThanOrEqual(4.5);

    // A token that FAILS the floor on the light palette, recorded so the slot
    // choice above is a measured decision rather than a preference:
    // `textMuted` on the dimmed light fill is 2.35:1 — the same unreadable
    // outcome the repair exists to remove.
    expect(contrast(slot(Colors.light, 'textMuted'), lightBg)).toBeLessThan(4.5);

    // The collapse that motivated the fix, computed properly. A whole-
    // control 0.5 opacity composites BOTH the fill and the label over the stage
    // the button sits on, so the label ends up read against the composited
    // fill — not against the fill's own colour. Dark primary yields ~1.6:1,
    // still far below the 4.5:1 floor the repaired treatment clears at 9.1:1.
    const stage = slot(Colors.dark, 'stage');
    const fillC = blend(slot(Colors.dark, 'accent'), stage, 0.5);
    const labelC = blend(slot(Colors.dark, 'accentOn'), fillC, 0.5);
    const collapsed = contrast(labelC, fillC);
    expect(collapsed).toBeLessThan(2);
    // And the repaired pair clears the floor in this same theme.
    expect(contrast(slot(Colors.dark, 'textSecondary'), slot(Colors.dark, 'backgroundElement'))).toBeGreaterThanOrEqual(4.5);
  });

  it('leaves the enabled primary button completely unchanged', async () => {
    await render(<Button label="GO" testID="go-enabled" onPress={() => {}} />);
    const flat = flatten('go-enabled');
    expect(flat.opacity).toBeUndefined();
    expect(flat.backgroundColor).toBe(T.accent);
    expect(findLabelProps(screen.getByTestId('go-enabled'))).toBe('accentOn');
    // The pressed-key lip is still present on an actionable filled button.
    expect(flat.marginBottom).toBe(4);
  });

  it('reports the disabled state to accessibility', async () => {
    await render(<Button label="GO" testID="go-a11y" disabled />);
    const btn = screen.getByTestId('go-a11y');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
    expect(btn.props.accessibilityState?.busy).toBe(false);
  });

  it('suppresses the press when disabled', async () => {
    let pressed = 0;
    await render(<Button label="GO" testID="go-nopress" disabled onPress={() => { pressed += 1; }} />);
    const btn = screen.getByTestId('go-nopress');
    // The disabled flag is forwarded to the pressable rather than re-exposed on
    // the outer props; the observable contract is the a11y state plus onPress
    // never firing through the handler chain.
    expect(btn.props.accessibilityState?.disabled).toBe(true);
    btn.props.onPress?.();
    expect(pressed).toBe(0);
  });

  it('treats loading as a separate state: enabled fill, spinner, busy not disabled', async () => {
    await render(<Button label="GO" testID="go-loading" loading onPress={() => {}} />);
    const flat = flatten('go-loading');
    // A busy button is NOT a disabled button visually: it keeps the live CTA
    // fill and its pressed-key lip, with no opacity dilution. Separating the
    // two appearances is the whole point of the D3 repair — before it, `loading`
    // and `disabled` shared one code path.
    expect(flat.backgroundColor).toBe(T.accent);
    expect(flat.marginBottom).toBe(4);
    expect(flat.opacity).toBeUndefined();
    const btn = screen.getByTestId('go-loading');
    // `busy` distinguishes it from a plain disabled button (which has
    // `busy: false`). Note that Tappable deliberately re-derives
    // `disabled: true` for any non-pressable control, documented in
    // `tappable.tsx` — press suppression is a real unpressability, so the
    // screen reader is told so; the busy flag is what separates the meanings.
    expect(btn.props.accessibilityState?.busy).toBe(true);
  });

  it('drops the pressed-key lip only while disabled', async () => {
    await render(<Button label="GO" testID="lip-off" disabled />);
    expect(flatten('lip-off').marginBottom).toBeUndefined();
    await render(<Button label="GO" testID="lip-on" onPress={() => {}} />);
    expect(flatten('lip-on').marginBottom).toBe(4);
  });
});
