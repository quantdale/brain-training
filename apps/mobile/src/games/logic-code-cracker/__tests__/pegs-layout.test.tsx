import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { CurrentGuess } from '../components/current-guess';
import { SecretReveal } from '../components/secret-reveal';

describe('Code Cracker static peg geometry', () => {
  it.each(['guess', 'secret'] as const)('fits a six-peg %s into compact width without breaking circles', async (kind) => {
    const colors = [0, 1, 2, 3, 4, 5];
    await render(kind === 'guess'
      ? <CurrentGuess currentGuess={colors} codeLength={colors.length} />
      : <SecretReveal secretCode={colors} />);
    await fireEvent(screen.getByTestId(`logic-code-cracker.${kind}-pegs`), 'layout', {
      nativeEvent: { layout: { width: 264, height: 44, x: 0, y: 0 } },
    });
    const pegs = screen.getAllByTestId(new RegExp(`^logic-code-cracker\\.${kind}-peg\\.`));
    expect(pegs).toHaveLength(6);
    let totalPegWidth = 0;
    for (const peg of pegs) {
      const style = StyleSheet.flatten(peg.props.style);
      expect(style.width).toBeGreaterThanOrEqual(24);
      expect(style.height).toBe(style.width);
      totalPegWidth += style.width;
    }
    expect(totalPegWidth + Spacing.two * (pegs.length - 1)).toBeLessThanOrEqual(264);
  });
});
