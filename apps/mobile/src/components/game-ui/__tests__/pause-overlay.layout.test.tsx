/**
 * PauseOverlay action-row layout contract (Change 065).
 *
 * Resume/Quit sat in a non-wrapping row with no scroll: at a 2x system font
 * scale or a compact width the pair clipped instead of stacking. This pins
 * the wrap + centered-content contract so a future style edit cannot silently
 * re-clip a control.
 *
 * RNTL v14 `render` is async — the render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { PauseOverlay } from '@/components/game-ui';
import { testId } from '@/sdk';

interface StyleNode {
  props?: { style?: unknown };
  parent?: StyleNode | null;
}

function flatStyle(style: unknown): Record<string, unknown> {
  const flat = StyleSheet.flatten(style as never);
  return (flat ?? {}) as Record<string, unknown>;
}

/** Nearest ancestor laid out as a row — the action row itself. */
function rowAncestorStyle(node: StyleNode): Record<string, unknown> | null {
  let current: StyleNode | null | undefined = node.parent;
  while (current) {
    const flat = flatStyle(current.props?.style);
    if (flat.flexDirection === 'row') {
      return flat;
    }
    current = current.parent;
  }
  return null;
}

describe('PauseOverlay layout', () => {
  it('wraps and centers the action row instead of clipping Resume/Quit', async () => {
    await render(
      <PauseOverlay gameId="memory" onResume={() => {}} onQuit={() => {}} />,
    );
    // Quit is a secondary button (no primary "lip" wrapper), so the walk up
    // from its host pressable reaches the action row deterministically.
    const quit = screen.getByTestId(testId('memory', 'quit'));

    const style = rowAncestorStyle(quit);
    expect(style).not.toBeNull();
    expect(style?.flexDirection).toBe('row');
    expect(style?.flexWrap).toBe('wrap');
    expect(style?.justifyContent).toBe('center');
  });
});
