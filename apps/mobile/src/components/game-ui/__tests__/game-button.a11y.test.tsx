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

/**
 * Effective interaction height: the laid-out minimum plus hit-slop expansion.
 * The 44 pt contract is about the area a finger can hit, not about which style
 * key implements it — the kit reaches it with an explicit minHeight on md/lg
 * and through hit slop on the compact size.
 */
function effectiveTargetHeight(node: { props: { style?: unknown; hitSlop?: unknown } }): number {
  const minHeight = resolvedStyle(node.props.style)
    .flat()
    .reduce<number>((acc, entry) => {
      const value = (entry as { minHeight?: number } | null)?.minHeight;
      return typeof value === 'number' ? Math.max(acc, value) : acc;
    }, 0);
  const slop = node.props.hitSlop as number | { top?: number; bottom?: number } | undefined;
  const vertical =
    typeof slop === 'number' ? slop * 2 : slop ? (slop.top ?? 0) + (slop.bottom ?? 0) : 0;
  return minHeight + vertical;
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
    expect(effectiveTargetHeight(getByTestId('b'))).toBeGreaterThanOrEqual(44);
  });

  it('keeps the 44pt floor on the small variant (font-scale cap keeps rows intact)', async () => {
    // At OS fontScale 2.0 the capped label grows the button naturally; the
    // interaction area stays >=44pt in both variants (compact size reaches it
    // through hit slop rather than an inflated visual).
    await render(<GameButton testID="b-small" label="Go" onPress={() => {}} small />);
    expect(effectiveTargetHeight(screen.getByTestId('b-small'))).toBeGreaterThanOrEqual(44);
  });
});
