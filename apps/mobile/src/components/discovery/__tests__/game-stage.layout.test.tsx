/** Layout ownership guards; native screenshots separately prove text geometry. */
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { registry } from '@/registry/registry.generated';
import { GameStage } from '../game-stage';

type Node = {
  props: { style?: StyleProp<ViewStyle> };
  children?: (Node | string)[];
};

function pathToText(node: Node, text: string): Node[] {
  if (node.children?.includes(text)) return [node];
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    const path = pathToText(child, text);
    if (path.length) return [node, ...path];
  }
  return [];
}

async function header() {
  const game = registry.find(item => item.id === 'logic-order-path')!;
  const view = await render(
    <GameStage game={game} kicker="Place" meta={
      <ThemedText type="eyebrow">Logic &amp; Problem Solving</ThemedText>
    } />,
  );
  const tree = view.toJSON() as Node;
  const kicker = pathToText(tree, 'Place');
  const meta = pathToText(tree, 'Logic & Problem Solving');
  expect(kicker.length).toBeGreaterThan(1);
  expect(meta.length).toBeGreaterThan(1);
  const common = kicker.filter((node, index) => node === meta[index]);
  return { view, kicker, meta, row: common.at(-1)! };
}

describe('GameStage identity metadata reflow', () => {
  it('allows the category to wrap to its own line instead of consuming the kicker width', async () => {
    const { row } = await header();
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      flexDirection: 'row', flexWrap: 'wrap',
    });
  });

  it('keeps the mark and readable kicker together, with intrinsic rather than zero-basis width', async () => {
    const { kicker, row } = await header();
    const group = kicker.at(-2)!;
    expect(group).not.toBe(row);
    expect(StyleSheet.flatten(group.props.style)).toMatchObject({
      flexDirection: 'row', maxWidth: '100%', flexShrink: 1,
    });
    const text = StyleSheet.flatten(kicker.at(-1)!.props.style);
    expect(text).toMatchObject({ flexShrink: 1 });
    expect(text.flex).toBeUndefined();
  });

  it('bounds the metadata to the content width without clipping or reducing text scaling', async () => {
    const { meta, row, view } = await header();
    const group = meta.at(-2)!;
    expect(group).not.toBe(row);
    expect(StyleSheet.flatten(group.props.style)).toMatchObject({
      maxWidth: '100%', flexShrink: 1,
    });
    for (const text of ['Place', 'Logic & Problem Solving']) {
      const node = view.getByText(text);
      expect(node.props.allowFontScaling).not.toBe(false);
      expect(node.props.maxFontSizeMultiplier).toBeGreaterThan(1);
      expect(node.props.numberOfLines).toBeUndefined();
    }
  });
});
