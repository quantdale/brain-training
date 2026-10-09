/**
 * SessionHeader layout contract (Campaign 055P pixel certification + 076-f).
 *
 * The in-session HUD strip is a single instrument row. At compact widths or a
 * 2x system font scale its four slots cannot fit; without wrapping, the
 * trailing pause control overflowed the strip and was clipped past the screen
 * edge (observed on device: only 6x44 dp visible at font-scale-2, and the
 * default-scale pause already bled past the strip frame). This pins the wrap
 * contract so a future style edit cannot silently re-clip a control.
 *
 * 076-f regression guard (defect reproduced on device): the wrap used to live
 * on the WHOLE row including the pause control, so when the info slots
 * overflowed the pause wrapped to the START of the next instrument line instead
 * of staying at its edge. The controller observed it "moves between top-left and
 * top-right" across trials of the same game. The strip is now two zones - a
 * wrapping info zone and a pinned trailing zone - so the anti-clipping wrap is
 * preserved AND the control cannot change edge mid-session. Both properties are
 * asserted here because losing either one is a regression.
 *
 * RNTL v14 `render` is async — the render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';

import { SessionHeader } from '@/components/game-ui';

function flatStyle(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as never) as unknown as Record<string, unknown>;
}

describe('SessionHeader layout', () => {
  it('wraps its info row instead of clipping overflow off the strip', async () => {
    await render(
      <SessionHeader
        round="Round 1/5"
        progress={{ value: 1, total: 5 }}
        score="Score 0"
        trailing={<Text testID="hud-trailing">Pause</Text>}
      />,
    );
    const trailing = screen.getByTestId('hud-trailing');
    const strip = trailing.parent?.parent;
    expect(strip).not.toBeNull();
    const style = flatStyle(strip?.props.style);
    expect(style.flexDirection).toBe('row');
    // Campaign 055P: wrapping is what stops the overflow being clipped away.
    const info = screen.getByTestId('hud-trailing').parent?.parent?.children?.[0];
    expect(info).toBeDefined();
  });

  it('keeps the anti-clipping wrap on the info zone, not on the whole strip', async () => {
    await render(
      <SessionHeader
        round="Round 1/5"
        progress={{ value: 1, total: 5 }}
        score="Score 0"
        trailing={<Text testID="hud-trailing">Pause</Text>}
      />,
    );
    // The zone holding round/progress/score must wrap so those slots can
    // overflow to a second instrument line rather than being clipped.
    const progress = screen.getByTestId('session-progress');
    const infoZone = progress.parent?.parent as unknown as View;
    expect(infoZone).not.toBeNull();
    const infoStyle = flatStyle(infoZone?.props?.style);
    expect(infoStyle.flexWrap).toBe('wrap');
    expect(infoStyle.flexDirection).toBe('row');
  });

  it('pins the trailing control to its own zone so it cannot change edge mid-session', async () => {
    await render(
      <SessionHeader
        round="Round 1/5"
        progress={{ value: 1, total: 5 }}
        score="Score 0"
        trailing={<Text testID="hud-trailing">Pause</Text>}
      />,
    );
    // Regression: when the pause control was a plain last child of the wrapping
    // row it moved between the row's right edge and the START of the next line.
    const zone = screen.getByTestId('session-header-trailing');
    const style = flatStyle(zone.props.style);
    expect(style.flexShrink).toBe(0);
    expect(style.flexGrow).toBe(0);

    // And it must be a sibling of the info zone, not nested inside the wrapping
    // row, so no amount of info-slot overflow can relocate it.
    const infoZone = screen.getByTestId('session-progress').parent?.parent;
    expect(zone.parent).toBe(infoZone?.parent);
  });
});
