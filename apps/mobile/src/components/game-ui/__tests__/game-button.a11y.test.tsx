/**
 * GameButton accessibility — shared primitive contract (task 07).
 *
 * Guards the cross-catalog a11y contract every game inherits via
 * `DifficultySelector` / per-game buttons: correct role, truthful
 * disabled/selected/busy state, an optional non-noisy hint, and a minimum
 * touch-target height. RNTL v14 `render` is async — every render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { GameButton } from '@/components/game-ui';

function resolvedStyle(style: unknown): unknown[] {
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return Array.isArray(resolved) ? resolved : [resolved];
}

describe('GameButton accessibility', () => {
  it('exposes the button role and truthful state', async () => {
    await render(<GameButton testID="b" label="Go" onPress={() => {}} selected disabled />);
    const el = screen.getByTestId('b');
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityState).toMatchObject({
      disabled: true,
      selected: true,
      busy: false,
    });
  });

  it('defaults to enabled, unselected, not busy', async () => {
    await render(<GameButton testID="b" label="Go" onPress={() => {}} />);
    expect(screen.getByTestId('b').props.accessibilityState).toMatchObject({
      disabled: false,
      selected: false,
      busy: false,
    });
  });

  it('forwards an accessibility hint without being noisy', async () => {
    await render(<GameButton testID="b" label="Go" onPress={() => {}} hint="Start the session" />);
    expect(screen.getByTestId('b').props.accessibilityHint).toBe('Start the session');
  });

  it('meets the minimum 44pt touch-target height', async () => {
    const { getByTestId } = await render(
      <GameButton testID="b" label="Go" onPress={() => {}} />,
    );
    const flat = resolvedStyle(getByTestId('b').props.style).flat();
    expect(flat).toContainEqual(expect.objectContaining({ minHeight: 44 }));
  });

  it('keeps the 44pt floor on the small variant (font-scale cap keeps rows intact)', async () => {
    // At OS fontScale 2.0 the capped label grows the button naturally; the
    // explicit minHeight stays the accessibility floor in both variants.
    await render(<GameButton testID="b-small" label="Go" onPress={() => {}} small />);
    const flat = resolvedStyle(screen.getByTestId('b-small').props.style).flat();
    expect(flat).toContainEqual(expect.objectContaining({ minHeight: 44 }));
  });
});
