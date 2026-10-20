/**
 * Parent-facing layout inputs for actual Button / GameButton callers. Jest
 * does not run Yoga: the on-device NumberLine width change is the pixel repro,
 * and these guards pin the ownership that made it happen.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GameButton } from '@/components/game-ui/game-button';
import { Depth, Radii } from '@/theme/tokens';
import { Button, type ButtonVariant } from '../button';

type NativeNode = {
  props: { testID?: string; style?: StyleProp<ViewStyle> };
  children?: (NativeNode | string)[];
};

function outerStyle(tree: Awaited<ReturnType<typeof render>>) {
  const parent = tree.toJSON() as NativeNode;
  const box = parent.children?.[0] as NativeNode;
  return StyleSheet.flatten(box.props.style) ?? {};
}

const callerStyle: ViewStyle = {
  flexGrow: 1, flexShrink: 1, flexBasis: 120, maxWidth: '100%', minWidth: 120,
  width: '75%', marginHorizontal: 7, marginBottom: 9, alignSelf: 'center',
  paddingHorizontal: 19,
};

describe('Button parent-facing layout', () => {
  it.each((['primary', 'danger', 'success', 'secondary', 'ghost'] as ButtonVariant[])
    .flatMap((variant) => (['enabled', 'disabled', 'loading'] as const)
      .map((state) => ({ variant, state }))))(
    'keeps caller constraints on the parent-facing $variant / $state box',
    async ({ variant, state }) => {
      const tree = await render(
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Button label="Submit estimate" testID="action" variant={variant} fullWidth={false}
            disabled={state === 'disabled'} loading={state === 'loading'} style={callerStyle} />
        </View>,
      );
      expect(outerStyle(tree)).toMatchObject({
        flexGrow: 1, flexShrink: 1, flexBasis: 120, maxWidth: '100%', minWidth: 120,
        width: '75%', marginHorizontal: 7, marginBottom: 9, alignSelf: 'center',
      });
      const face = StyleSheet.flatten(screen.getByTestId('action').props.style) ?? {};
      // Padding belongs to the face once; it must not inflate the lip wrapper.
      expect(face.paddingHorizontal).toBe(19);
      if (outerStyle(tree).backgroundColor !== face.backgroundColor) {
        expect(outerStyle(tree).paddingHorizontal).toBeUndefined();
        expect(face.marginHorizontal).toBeUndefined();
        expect(face.marginBottom).not.toBe(9);
        expect(face.width).toBeUndefined();
        expect(face.flexBasis).toBeUndefined();
        expect(face.alignSelf).toBe('stretch');
      }
    },
  );

  it('keeps a real GameButton choice in the same flex cell when selected', async () => {
    const props = { label: 'Normal', testID: 'choice', onPress: jest.fn(), variant: 'secondary' as const };
    const tree = await render(<View><GameButton {...props} style={callerStyle} /></View>);
    const before = outerStyle(tree);
    await tree.rerender(<View><GameButton {...props} style={callerStyle} selected /></View>);
    const after = outerStyle(tree);
    for (const key of ['flexGrow', 'flexShrink', 'flexBasis', 'maxWidth', 'width', 'marginHorizontal', 'marginBottom', 'alignSelf'] as const) {
      expect(after[key]).toBe(before[key]);
    }
    expect(screen.getByTestId('choice').props.accessibilityState).toMatchObject({ selected: true, disabled: false });
    await fireEvent.press(screen.getByTestId('choice'));
    expect(props.onPress).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('preserves intrinsic versus stretched sizing (fullWidth=%s)', async (fullWidth) => {
    const tree = await render(<View style={{ alignItems: 'flex-start' }}>
      <Button label="Pause" testID="pause" fullWidth={fullWidth} />
    </View>);
    expect(outerStyle(tree).alignSelf).toBe(fullWidth ? 'stretch' : undefined);
    expect(outerStyle(tree).width).toBeUndefined();
    expect(outerStyle(tree).flexGrow).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId('pause').props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it.each((['primary', 'danger', 'success'] as const).flatMap((variant) =>
    (['enabled', 'disabled', 'loading'] as const).map((state) => ({ variant, state }))))(
    'keeps the $variant / $state feedback face intrinsically tall',
    async ({ variant, state }) => {
      await render(<View style={{ alignItems: 'center', gap: 16 }}>
        <Button label="Next round" testID="next" fullWidth={false} variant={variant}
          disabled={state === 'disabled'} loading={state === 'loading'} />
      </View>);
      // Native13/Yoga reproduced a >1400dp face: growth in this column consumes
      // the stage's available height and centres the label below the viewport.
      // This pins the offending layout input; actual Yoga/pixel proof is separate.
      const face = StyleSheet.flatten(screen.getByTestId('next').props.style);
      expect(face.flexGrow ?? 0).toBe(0);
      expect(face.minHeight).toBeGreaterThanOrEqual(48);
    },
  );

  it.each(['height', 'minHeight'] as const)('fills an explicitly sized %s cell', async (dimension) => {
    const tree = await render(<View><Button label="Continue" testID="sized"
      style={{ [dimension]: 72 }} /></View>);
    expect(outerStyle(tree)[dimension]).toBe(72);
    expect(StyleSheet.flatten(screen.getByTestId('sized').props.style).flexGrow).toBe(1);
  });

  it('keeps automatic height intrinsic for a real feedback GameButton', async () => {
    const tree = await render(<View style={{ alignItems: 'center' }}>
      <GameButton label="Next round" testID="game-next" onPress={jest.fn()} style={{ height: 'auto' }} />
    </View>);
    expect(outerStyle(tree).minWidth).toBe(120);
    const face = StyleSheet.flatten(screen.getByTestId('game-next').props.style);
    expect(face.flexGrow ?? 0).toBe(0);
    expect(face.paddingHorizontal).toBe(24);
  });
});

describe('Button lip geometry (F-10c regression)', () => {
  it('draws the physical-key shadow as a face-sized shifted bar, not a wrapper background', async () => {
    const tree = await render(
      <View><Button label="Submit estimate" testID="submit" variant="primary" /></View>,
    );
    // The taller-stadium wrapper background leaked gray wedges past the face's
    // rounded bottom corners (native14 "gray backing rectangle", RGB194 =
    // Depth.lip over light). The wrapper must not paint at all.
    expect(outerStyle(tree).backgroundColor).toBeUndefined();
    const face = StyleSheet.flatten(screen.getByTestId('submit').props.style) ?? {};
    expect(face.marginBottom).toBe(4);
    const lip = StyleSheet.flatten(screen.getByTestId('submit-lip').props.style) ?? {};
    // Same radius and width as the face, shifted 4 dp down: a uniform curved
    // shadow edge instead of a backing rectangle.
    expect(lip.position).toBe('absolute');
    expect(lip.top).toBe(4);
    expect(lip.left).toBe(0);
    expect(lip.right).toBe(0);
    expect(lip.bottom).toBe(0);
    expect(lip.borderRadius).toBe(Radii.pill);
    expect(lip.backgroundColor).toBe(Depth.lip);
  });

  it('renders no shadow bar when disabled (matches the native14 disabled frame)', async () => {
    const tree = await render(
      <View><Button label="Submit estimate" testID="submit-off" variant="primary" disabled /></View>,
    );
    expect(outerStyle(tree).backgroundColor).toBeUndefined();
    expect(screen.queryByTestId('submit-off-lip')).toBeNull();
  });

  it('keeps the shadow bar for danger/success and omits it for secondary/ghost', async () => {
    for (const variant of ['danger', 'success'] as const) {
      const tree = await render(
        <View><Button label="Act" testID={`b-${variant}`} variant={variant} /></View>,
      );
      expect(screen.getByTestId(`b-${variant}-lip`)).toBeOnTheScreen();
      expect(outerStyle(tree).backgroundColor).toBeUndefined();
    }
    for (const variant of ['secondary', 'ghost'] as const) {
      await render(
        <View><Button label="Act" testID={`b-${variant}`} variant={variant} /></View>,
      );
      expect(screen.queryByTestId(`b-${variant}-lip`)).toBeNull();
    }
  });
});
