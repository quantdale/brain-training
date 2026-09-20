/**
 * SessionHeader layout contract (Campaign 055P pixel certification).
 *
 * The in-session HUD strip is a single instrument row. At compact widths or a
 * 2x system font scale its four slots cannot fit; without wrapping, the
 * trailing pause control overflowed the strip and was clipped past the screen
 * edge (observed on device: only 6x44 dp visible at font-scale-2, and the
 * default-scale pause already bled past the strip frame). This pins the wrap
 * contract so a future style edit cannot silently re-clip a control.
 *
 * RNTL v14 `render` is async — the render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { SessionHeader } from '@/components/game-ui';

function flatStyle(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as never) as unknown as Record<string, unknown>;
}

describe('SessionHeader layout', () => {
  it('wraps its row instead of clipping the trailing control off the strip', async () => {
    await render(
      <SessionHeader
        round="Round 1/5"
        progress={{ value: 1, total: 5 }}
        score="Score 0"
        trailing={<Text testID="hud-trailing">Pause</Text>}
      />,
    );
    const trailing = screen.getByTestId('hud-trailing');
    const strip = trailing.parent;
    expect(strip).not.toBeNull();
    const style = flatStyle(strip?.props.style);
    expect(style.flexDirection).toBe('row');
    expect(style.flexWrap).toBe('wrap');
  });
});
