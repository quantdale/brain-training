/**
 * Parent-facing layout inputs for actual Button / GameButton callers. Jest
 * does not run Yoga: the on-device NumberLine width change is the pixel repro,
 * and these guards pin the ownership that made it happen.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GameButton } from '@/components/game-ui/game-button';
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
});
