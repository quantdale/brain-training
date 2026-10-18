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
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { TutorialFrame } from '@/components/game-ui';
import { ScreenShell } from '@/components/screen-shell';
import { Tutorial as GridTutorial } from '@/games/spatial-grid-nav/components/tutorial';
import { Tutorial as TransformTutorial } from '@/games/spatial-transform-match/components/tutorial';

function flatStyle(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as never) as unknown as Record<string, unknown>;
}

describe('TutorialFrame layout', () => {
  // The game route uses ScreenShell's vertical ScrollView. On Android, the
  // inner tutorial must negotiate nested drags with that real ancestor. RNTL
  // checks the wiring here; the compact/2x APK journey proves native scrolling.
  it.each([
    { gameId: 'spatial-grid-nav', Tutorial: GridTutorial },
    { gameId: 'spatial-transform-match', Tutorial: TransformTutorial },
  ])('enables nested scrolling for the $gameId demo inside the route shell', async ({ gameId, Tutorial }) => {
    await render(<ScreenShell><Tutorial onComplete={() => {}} /></ScreenShell>);
    await fireEvent.press(screen.getByTestId(`${gameId}.tutorial-next`));
    expect(screen.getByTestId(`${gameId}.tutorial-scroll`).props.nestedScrollEnabled).toBe(true);
  });

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
