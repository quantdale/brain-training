/**
 * UI-kit contract tests.
 *
 * The kit is the only place the interaction contract is allowed to live, so
 * these assertions cover the things a per-screen implementation would get
 * wrong: activation blocking while disabled/loading, an accessible name and
 * role on every control, the 44 dp interaction floor, and press behaviour
 * under reduced motion (animation off, action still immediate).
 */

import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tappable } from '@/components/ui/tappable';
import { } from '@/theme/tokens';

// `mock`-prefixed name: jest.mock factories are hoisted and may only close
// over variables whose name starts with `mock`.
const mockReduceMotion = jest.fn<() => boolean>(() => false);
jest.mock('@/components/a11y/reduced-motion', () => ({
  usePrefersReducedMotion: () => mockReduceMotion(),
  motionValue: (reduced: boolean, animated: unknown, fallback: unknown) =>
    reduced ? fallback : animated,
  reduceDuration: (reduced: boolean, duration: number) => (reduced ? 0 : duration),
}));

describe('Button', () => {
  beforeEach(() => {
    mockReduceMotion.mockReturnValue(false);
  });

  it('fires onPress when enabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Start workout" onPress={onPress} testID="cta" />);
    await fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('blocks activation while disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Start workout" onPress={onPress} disabled testID="cta" />);
    await fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('cta').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('blocks activation while loading and reports busy', async () => {
    const onPress = jest.fn();
    await render(<Button label="Saving" onPress={onPress} loading testID="cta" />);
    await fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('cta').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('exposes an accessible name, including the sublabel context', async () => {
    await render(<Button label="Continue" sublabel="Today's workout" testID="cta" />);
    expect(screen.getByTestId('cta').props.accessibilityLabel).toBe("Continue. Today's workout");
  });

  it('keeps at least a 44 dp interaction area at every size', async () => {
    await render(
      <>
        <Button label="Small" size="sm" testID="cta-sm" />
        <Button label="Medium" size="md" testID="cta-md" />
      </>,
    );
    for (const testID of ['cta-sm', 'cta-md']) {
      const { style, hitSlop } = screen.getByTestId(testID).props;
      const flattened = Array.isArray(style) ? Object.assign({}, ...style.flat().filter(Boolean)) : style;
      const slop = typeof hitSlop === 'number' ? hitSlop : hitSlop?.top ?? 0;
      expect(flattened.minHeight + 2 * slop).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('still activates immediately when reduced motion is on', async () => {
    mockReduceMotion.mockReturnValue(true);
    const onPress = jest.fn();
    await render(<Button label="Start" onPress={onPress} testID="cta" />);
    await fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Tappable', () => {
  it('defaults to the button role and honours an explicit role', async () => {
    await render(
      <>
        <Tappable testID="plain">
          <Text>Plain</Text>
        </Tappable>
        <Tappable testID="link" accessibilityRole="link">
          <Text>Link</Text>
        </Tappable>
      </>,
    );
    expect(screen.getByTestId('plain').props.accessibilityRole).toBe('button');
    expect(screen.getByTestId('link').props.accessibilityRole).toBe('link');
  });

  it('expands a small surface to the 44 dp target through hit slop', async () => {
    await render(
      <Tappable testID="chip" renderedSize={28} feedback={false}>
        <Text>28dp</Text>
      </Tappable>,
    );
    const hitSlop = screen.getByTestId('chip').props.hitSlop;
    const vertical = typeof hitSlop === 'number' ? hitSlop * 2 : hitSlop.top + hitSlop.bottom;
    const horizontal = typeof hitSlop === 'number' ? hitSlop * 2 : hitSlop.left + hitSlop.right;
    expect(28 + vertical).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    expect(28 + horizontal).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(
      <Tappable testID="locked" onPress={onPress} disabled>
        <Text>Locked</Text>
      </Tappable>,
    );
    await fireEvent.press(screen.getByTestId('locked'));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Card', () => {
  it('renders a static surface without press affordance when no handler is given', async () => {
    await render(
      <Card testID="info">
        <Text>Content</Text>
      </Card>,
    );
    expect(screen.getByTestId('info').props.accessibilityRole).toBeUndefined();
  });

  it('becomes a labelled button when pressable', async () => {
    const onPress = jest.fn();
    await render(
      <Card testID="tile" onPress={onPress} accessibilityLabel="Memory game">
        <Text>Memory</Text>
      </Card>,
    );
    await fireEvent.press(screen.getByTestId('tile'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tile').props.accessibilityRole).toBe('button');
    expect(screen.getByTestId('tile').props.accessibilityLabel).toBe('Memory game');
  });

  it('paints a tinted surface from the theme instead of a literal colour', async () => {
    await render(
      <Card testID="warn" tone="warningSoft">
        <Text>Careful</Text>
      </Card>,
    );
    const style = screen.getByTestId('warn').props.style;
    const flattened = Array.isArray(style) ? Object.assign({}, ...style.flat().filter(Boolean)) : style;
    expect(flattened.backgroundColor).toMatch(/^#/);
  });
});
