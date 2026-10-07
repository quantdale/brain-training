/**
 * Change 071 — single-definition contracts for the shared UI kit.
 *
 * Two classes of defect are pinned here, and both are invisible to usage tests:
 *
 * 1. `Tappable` computed a merged accessibility state and then threw it away:
 *    `{...rest}` spread AFTER the computed value while `accessibilityState` was
 *    still inside `rest`, so the caller's RAW state replaced the merge and the
 *    result depended on prop ORDER rather than on the intent.
 *
 *    MEASURED in both directions (2026-09-30), because the audit's stated
 *    symptom turned out to be the wrong one:
 *      caller `{ disabled: true }` on an ENABLED control
 *        before: `{ disabled: true }`  — announced as unpressable. WRONG.
 *        after:  `{ disabled: false }` — the component's own state wins.
 *      caller `{ selected: true }` on a DISABLED control
 *        before and after: `{ selected: true, disabled: true }` — identical.
 *    The audit reported that a caller could ERASE `disabled`; measurement shows
 *    it could not, because react-native's `Pressable` re-derives
 *    `accessibilityState.disabled` from its own `disabled` prop. The direction
 *    that was genuinely broken is the one above. Both are asserted here, so the
 *    suite pins the real contract rather than the remembered story.
 *
 * 2. The minimum touch target had THREE independent definitions — the
 *    accessibility constant, a theme export of the same name, and a platform
 *    literal — with nothing connecting them. A migration that touched two of
 *    them would leave the third asserting a different number, and a reader
 *    would have no way to tell which one a file meant. The catalog test fails if
 *    a second definition of the value reappears anywhere in the kit.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';

import { MIN_TOUCH_TARGET, MinTouchTarget } from '@/components/a11y';
import { Tappable } from '@/components/ui/tappable';
import { hitSlopToTouchTarget, MIN_TOUCH_TARGET_SIZE } from '@/platform/touch';

const KIT_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Recursively collect the kit's source files, skipping tests. */
function kitSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...kitSources(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('Tappable accessibility-state composition (Change 071 §1)', () => {
  it('keeps disabled:true when the caller supplies selected:true', async () => {
    // Regression case (unchanged by the fix: react-native's internal merge
    // already covered this direction). Pinned so the merge does not regress
    // when the explicit implementation is refactored.
    await render(
      <Tappable disabled accessibilityState={{ selected: true }} testID="probe">
        <Text>option</Text>
      </Tappable>,
    );
    expect(screen.getByTestId('probe').props.accessibilityState).toEqual({
      selected: true,
      disabled: true,
    });
  });

  it('keeps the caller state when the control is enabled', async () => {
    await render(
      <Tappable accessibilityState={{ selected: true, checked: false }} testID="probe">
        <Text>option</Text>
      </Tappable>,
    );
    expect(screen.getByTestId('probe').props.accessibilityState).toEqual({
      selected: true,
      checked: false,
      disabled: false,
    });
  });

  it('does not let a caller mark an ENABLED control as disabled', async () => {
    // THE regression, in the direction that was genuinely broken: before the
    // fix the caller's raw state replaced the merge, so a caller that passed
    // `disabled: true` had a pressable control announced as unpressable. The
    // component's own truth is not the caller's to set; the only way to change
    // it is to change the `disabled` prop.
    await render(
      <Tappable accessibilityState={{ disabled: true, busy: true }} testID="probe">
        <Text>option</Text>
      </Tappable>,
    );
    // Other caller keys still pass through untouched.
    expect(screen.getByTestId('probe').props.accessibilityState).toEqual({
      busy: true,
      disabled: false,
    });
  });

  it('always reports disabled:false rather than omitting the key', async () => {
    // Omission and `false` behave the same to a screen reader today, but the
    // explicit key is what the assertion above depends on: if the component ever
    // goes back to omitting it, a caller state can silently win again.
    await render(
      <Tappable testID="probe">
        <Text>tap</Text>
      </Tappable>,
    );
    expect(screen.getByTestId('probe').props.accessibilityState).toEqual({ disabled: false });
  });

  it('preserves every other accessibility prop from the caller', async () => {
    await render(
      <Tappable
        accessibilityLabel="Memory game"
        accessibilityHint="Opens the game"
        accessibilityRole="button"
        testID="probe">
        <Text>tap</Text>
      </Tappable>,
    );
    const node = screen.getByTestId('probe');
    expect(node.props.accessibilityLabel).toBe('Memory game');
    expect(node.props.accessibilityHint).toBe('Opens the game');
    expect(node.props.accessibilityRole).toBe('button');
  });
});

describe('touch target: exactly one definition (Change 071 §2)', () => {
  it('has one canonical numeric constant', () => {
    expect(MIN_TOUCH_TARGET).toBe(Platform.OS === 'android' ? 48 : 44);
  });

  it('has one style fragment derived from the same number', () => {
    // `minHeight` only: the fragment deliberately leaves the horizontal
    // footprint alone, so this pins the vertical contract without asserting a
    // width the kit does not guarantee.
    expect(MinTouchTarget.minHeight).toBe(MIN_TOUCH_TARGET);
  });

  it('derives the platform hit-slop helper from the canonical constant', () => {
    // This used to be an independent literal. Deriving it means the helper can
    // never compute slop against a different target than the styles enforce.
    expect(MIN_TOUCH_TARGET_SIZE).toBe(MIN_TOUCH_TARGET);
    const slop = Math.ceil((MIN_TOUCH_TARGET - 24) / 2);
    expect(hitSlopToTouchTarget(24)).toEqual({ top: slop, bottom: slop, left: slop, right: slop });
    expect(hitSlopToTouchTarget(MIN_TOUCH_TARGET)).toBeNull();
  });

  it('declares the value in exactly one place, the canonical module', () => {
    // The real guard: a second `= 44` for a touch target can reappear anywhere in
    // `src`, and nothing else in the type system or the compiler would notice.
    // The scan is whole-`src` rather than kit-only because a duplicate is just
    // as likely to appear in a game module, where nothing about the kit's own
    // structure would catch it.
    const declarations: string[] = [];
    for (const file of kitSources(SRC_ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line) => {
        if (/MIN_TOUCH_TARGET\s*=\s*Platform\.select\(\{ android: 48, default: 44 \}\)/.test(line) ||
            /(MinTouchTarget|MIN_TOUCH_TARGET)[A-Za-z_]*\s*(:[^=]*)?=\s*(44|48)\b/.test(line)) {
          declarations.push(path.relative(SRC_ROOT, file).split(path.sep).join('/'));
        }
      });
    }
    // Exactly one, and it is the canonical module. A named allowlist rather than
    // a blanket exclusion, so a THIRD copy anywhere else is still a failure.
    expect(declarations).toEqual(['components/a11y/touch-target.ts']);
  });

  it('no style object hardcodes the touch-target floor as a raw 44', () => {
    // Guard blind spot (audit 2026-10-02): the declaration scan above matches
    // NAMED constants only, so a `minHeight: 44` style literal — the exact
    // drift §2 exists to prevent — was invisible to it, and seven interactive
    // styles had drifted back to raw literals. A raw FLOOR must reference
    // MIN_TOUCH_TARGET (or the derived MIN_TOUCH_TARGET_SIZE) instead. Only
    // the floor axes are checked: a `width: 44` / `height: 44` VISUAL size is
    // game art, not a touch target, and stays legitimate.
    const offenders: string[] = [];
    for (const file of kitSources(SRC_ROOT)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line) => {
        if (/MIN_TOUCH_TARGET/.test(line)) return;
        if (/\b(minHeight|minWidth)\s*:\s*44\b/.test(line)) {
          offenders.push(path.relative(SRC_ROOT, file).split(path.sep).join('/'));
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it('re-exports the canonical constant rather than a second value', () => {
    // A barrel may re-export; it may not re-derive. A re-export keeps one
    // definition reachable from several import paths without duplicating it.
    const a11y = readFileSync(path.resolve(KIT_ROOT, '..', 'a11y.ts'), 'utf8');
    expect(a11y).toMatch(/export\s*\{[^}]*MIN_TOUCH_TARGET[^}]*\}\s*from/);
    // And the theme module must no longer offer the old duplicate name.
    const tokens = readFileSync(path.join(SRC_ROOT, 'theme', 'tokens.ts'), 'utf8');
    expect(tokens).not.toMatch(/export\s+const\s+MinTouchTarget\b/);
  });
});
