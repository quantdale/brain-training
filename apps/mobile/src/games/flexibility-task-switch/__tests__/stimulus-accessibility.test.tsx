import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TokenView, TOKEN_COLORS } from '../components/token-view';

function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const rgb = hex.slice(1).match(/../g)!.map(x => parseInt(x, 16) / 255);
    const linear = rgb.map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
describe('token stimulus semantics and glyph contrast', () => {
  it('exposes the actual generated attributes as a single static image', async () => {
    await render(<TokenView token={{ color: 'yellow', shape: 'triangle', number: 3 }} testID="target" disabled />);
    const image = screen.getByRole('image', { name: 'yellow triangle 3' });
    expect(image.props.testID).toBe('target');
    expect(image.props.accessible).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['red', 'blue', 'green', 'yellow'] as const)('keeps the actual shape glyph readable on unchanged %s stimulus fill', async color => {
    await render(<TokenView token={{ color, shape: 'triangle', number: 3 }} testID="target" />);
    const glyph = screen.getByText('▲', { includeHiddenElements: true });
    const ink = StyleSheet.flatten(glyph.props.style).color as string;
    expect(contrast(ink, TOKEN_COLORS[color])).toBeGreaterThanOrEqual(3);
  });
});
