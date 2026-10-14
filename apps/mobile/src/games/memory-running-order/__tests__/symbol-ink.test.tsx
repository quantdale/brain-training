import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import { contrastRatio } from '@/theme/contrast';
import { SymbolView } from '../components/symbol-view';
import { RUNNING_ORDER_SYMBOLS } from '../symbols';

let mockTheme = Colors.light;
jest.mock('@/hooks/use-theme', () => ({ useTheme: () => mockTheme }));

describe('Running Order rendered symbol ink', () => {
  it.each((['light', 'dark'] as const).flatMap((scheme) => RUNNING_ORDER_SYMBOLS.flatMap((symbol) =>
    ([null, 'correct', 'wrong'] as const).map((verdict) => [scheme, symbol, verdict] as const))))(
    '%s preserves readable large-text ink for %j with %s verdict', async (scheme, symbol, verdict) => {
      mockTheme = Colors[scheme];
      const view = await render(<SymbolView symbolId={symbol.id} size={36} verdict={verdict} testID="ink-symbol" />);
      const glyph = view.getByText(symbol.glyph);
      const ink = StyleSheet.flatten(glyph.props.style).color as string;
      // The glyph is essential 36 px task content on the actual mechanic surface.
      const wrap = view.getByTestId('ink-symbol');
      const actualFill = StyleSheet.flatten(wrap.props.style).backgroundColor as string | undefined;
      expect(contrastRatio(ink, actualFill ?? mockTheme.surface)).toBeGreaterThanOrEqual(3);
      expect(wrap.props.accessibilityLabel).toContain(symbol.label);
    },
  );
});
