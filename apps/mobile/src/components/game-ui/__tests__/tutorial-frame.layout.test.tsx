/**
 * TutorialFrame layout contract (Campaign 055P pixel certification).
 *
 * The frame is a bottom-anchored overlay card with `overflow: hidden`. Its
 * height cap must leave room for the tallest observed tutorial step: the
 * deduction-table demo grows when the "Try again" control appears after a
 * wrong answer, and an 88% cap resolved against the game screen left that
 * control with negative height — unreachable (device-verified). The cap stays
 * as a safety valve at the full overlay height.
 *
 * RNTL v14 `render` is async — the render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { TutorialFrame } from '@/components/game-ui';

function flatStyle(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as never) as unknown as Record<string, unknown>;
}

describe('TutorialFrame layout', () => {
  it('caps the card at the full overlay height so tall steps stay reachable', async () => {
    await render(
      <TutorialFrame gameId="contract">
        <Text>step</Text>
      </TutorialFrame>,
    );
    const card = screen.getByTestId('contract.tutorial');
    const style = flatStyle(card.props.style);
    expect(style.maxHeight).toBe('100%');
    expect(style.overflow).toBe('hidden');
  });
});
