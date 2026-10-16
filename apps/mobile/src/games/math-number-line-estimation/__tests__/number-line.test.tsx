/**
 * Number-line geometry guard (Campaign 076 certification defect): inside the
 * centered feedback card the line wrapper shrink-wrapped to its content and
 * collapsed the track (absolute-positioned children add no intrinsic width),
 * rendering the resolved line as a ~60px pill with squashed labels. The
 * wrapper must stretch to its container in every phase.
 */
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { testId } from '@/sdk';

import { NumberLine } from '../components/number-line';
import { GAME_ID } from '../types';

type NativeNode = {
  props: { testID?: string; style?: StyleProp<ViewStyle> };
  children?: (NativeNode | string)[];
};

function pathTo(node: NativeNode, id: string): NativeNode[] | undefined {
  if (node.props.testID === id) return [node];
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    const path = pathTo(child, id);
    if (path) return [node, ...path];
  }
  return undefined;
}

/** First native box within the actual wrapping controls row, not the face. */
function submitLayout(tree: Awaited<ReturnType<typeof render>>) {
  const path = pathTo(tree.toJSON() as NativeNode, testId(GAME_ID, 'submit-estimate'));
  if (!path) throw new Error('Submit is missing');
  const controlsIndex = path.findIndex((node) => {
    const style = StyleSheet.flatten(node.props.style);
    return style?.flexDirection === 'row' && style.flexWrap === 'wrap';
  });
  if (controlsIndex < 0) throw new Error('Actual controls row is missing');
  return StyleSheet.flatten(path[controlsIndex + 1].props.style) ?? {};
}

describe('NumberLine geometry', () => {
  it('stretches the wrapper to its container instead of shrink-wrapping', async () => {
    await render(
      <NumberLine lineMin={0} lineMax={10} target={7} onEstimate={() => {}} />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'number-line-wrap'))).toHaveStyle({
      alignSelf: 'stretch',
    });
  });

  it('keeps Submit in its growing, constrained cell when choosing and committing a position', async () => {
    const submitted: number[] = [];
    const tree = await render(<NumberLine lineMin={0} lineMax={100} target={37}
      onEstimate={(value) => submitted.push(value)} width={300} />);
    const submit = () => screen.getByTestId(testId(GAME_ID, 'submit-estimate'));
    const expectedCell = { flexGrow: 1, maxWidth: '100%', minWidth: 120 };
    expect(submit().props.accessibilityState.disabled).toBe(true);
    expect(submitLayout(tree)).toMatchObject(expectedCell);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number-line')), { nativeEvent: { locationX: 150 } });
    expect(submit().props.accessibilityState.disabled).toBe(false);
    expect(submitLayout(tree)).toMatchObject(expectedCell);
    await fireEvent.press(submit());
    expect(submitted).toEqual([50]);
    expect(submit().props.accessibilityState.disabled).toBe(true);
    expect(submitLayout(tree)).toMatchObject(expectedCell);
  });
});
