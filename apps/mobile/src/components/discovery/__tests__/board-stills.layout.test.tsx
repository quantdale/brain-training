import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet, type ViewStyle } from 'react-native';

import { registry } from '@/registry/registry.generated';

import { GameBoardStill, type BoardStillColors } from '../board-stills';
import { GameWorldArt } from '../game-identity';

const colors: BoardStillColors = {
  base: '#cb182b', soft: '#fbe9e9', on: '#fff', ink: '#343434',
  secondary: '#8d8d8d', surface: '#fff',
};

async function stylesFor(gameId: string): Promise<ViewStyle[]> {
  const result = await render(<GameBoardStill gameId={gameId} colors={colors} variant={0} scale={1} />);
  return result.container.queryAll((view) => view.type === 'View').map((view) => StyleSheet.flatten(view.props.style) as ViewStyle);
}

function box(styles: ViewStyle[], width: string): ViewStyle {
  const found = styles.find((style) => style.width === width);
  expect(found).toBeDefined();
  return found!;
}

describe('device-scale discovery board still geometry', () => {
  it('bounds percent-width board art to stage height on cards and details', async () => {
    const game = registry.find((item) => item.id === 'memory')!;
    for (const [size, height] of [['card', 112], ['stage', 180]] as const) {
      const result = await render(<GameWorldArt game={game} size={size} />);
      const boardWidth = 150 * height / 112;
      const frames = result.container.queryAll((node) => {
        const style = StyleSheet.flatten(node.props.style) as ViewStyle | undefined;
        return style?.width === boardWidth && style?.height === height;
      });
      expect(frames).toHaveLength(1);
      await result.unmount();
    }
  });
  it('keeps the target and all four options inside the compact board frame', async () => {
    const styles = await stylesFor('attention-odd-one-out');
    const row = styles.find((style) => style.top === '52%');
    expect(row).toMatchObject({ position: 'absolute', left: '8%', right: '8%' });
    expect(styles.filter((style) => style.width === '21%')).toHaveLength(4);
    // From compact tile through full-width detail, target ends before the
    // option row, and the four options stay inside the visible frame.
    for (const [width, height] of [[160, 112], [230, 112], [320, 180]]) {
      expect(height * 0.06 + width * 0.2).toBeLessThan(height * 0.52);
      expect(height * 0.52 + width * 0.84 * 0.21 / 0.9).toBeLessThan(height);
    }
  });

  it('positions the lens and number-line flag over their boards instead of in flow', async () => {
    expect(box(await stylesFor('attention-visual-search'), '26%')).toMatchObject({ position: 'absolute', left: '38%', top: '25%' });
    const styles = await stylesFor('math-number-line-estimation');
    expect(box(styles, '80%')).toMatchObject({ position: 'absolute', left: '10%', top: '58%' });
    expect(box(styles, '7%')).toMatchObject({ position: 'absolute', left: '49%', top: '42%' });
  });

  it('overlays a centered needle within the compass ring', async () => {
    const styles = await stylesFor('spatial-coordinate-turn');
    expect(box(styles, '48%')).toMatchObject({ position: 'absolute', left: '26%', top: '8%', aspectRatio: 1 });
    expect(box(styles, '6%')).toMatchObject({ position: 'absolute', left: '47%', top: '20%' });
    expect(box(styles, '20%')).toMatchObject({ position: 'absolute', left: '40%', top: '59%' });
  });

  it('uses different signal-bar heights on the vigilance board', async () => {
    const bars = (await stylesFor('attention-sustained-vigilance')).filter((style) => style.height && style.backgroundColor === colors.secondary);
    expect(bars.map((bar) => bar.height)).toEqual(['50%', '80%', '35%', '60%']);
  });
});
