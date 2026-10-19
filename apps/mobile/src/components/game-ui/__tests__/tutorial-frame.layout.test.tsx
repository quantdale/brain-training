/**
 * TutorialFrame layout contract. Intrinsic steps must contribute their whole
 * height to ScreenShell's scroll range, including controls after long text.
 * The two independently scrolling demos retain Android nested scrolling.
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

  it('lets long intrinsic steps grow into the route scroll range without clipping their final action', async () => {
    await render(
      <ScreenShell>
        <TutorialFrame gameId="contract">
          <Text>{'Long instructions. '.repeat(200)}</Text>
          <Text testID="final-action">Got it</Text>
        </TutorialFrame>
      </ScreenShell>,
    );
    const card = screen.getByTestId('contract.tutorial');
    const style = flatStyle(card.props.style);
    expect(style.maxHeight).toBeUndefined();
    expect(style.height).toBeUndefined();
    expect(style.overflow).toBe('hidden');
  });
});
