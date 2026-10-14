/**
 * Visual Search Tile accessibility (task 07).
 *
 * Describe the visible color feature so assistive-tech users can compare the
 * same tiles. Labels never classify a live tile as target/odd/correct; verdict
 * wording and selection state belong only to the resolved result.
 */
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { testId } from '@/sdk';

import { Tile } from '../components/tile';
import { GAME_ID } from '../types';

describe('VisualSearch Tile accessibility (no answer leak)', () => {
  it('describes the visible orange feature without classifying the target', async () => {
    const { getByTestId } = await render(
      <Tile index={2} visual="target" onPressTile={() => {}} />,
    );
    const el = getByTestId(testId(GAME_ID, 'tile', '2'));
    expect(el.props.accessibilityLabel).toBe('Tile 3, orange square');
    expect(el.props.accessibilityLabel).not.toMatch(/odd one|target|answer/i);
  });

  it('describes a distractor surface without classifying it', async () => {
    const { getByTestId } = await render(
      <Tile index={5} visual="idle" onPressTile={() => {}} />,
    );
    expect(getByTestId(testId(GAME_ID, 'tile', '5')).props.accessibilityLabel).toMatch(/^Tile 6, (white|dark blue) square$/);
  });

  it('reflects selected state only after a correct tap, never during play', async () => {
    const idle = await render(<Tile index={0} visual="target" onPressTile={() => {}} />);
    expect(idle.getByTestId(testId(GAME_ID, 'tile', '0')).props.accessibilityState).toMatchObject({
      disabled: false,
      selected: false,
    });

    const selected = await render(<Tile index={0} visual="selected" onPressTile={() => {}} />);
    expect(selected.getByTestId(testId(GAME_ID, 'tile', '0')).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('058: declares a touch-target floor by construction', async () => {
    const { getByTestId } = await render(
      <Tile index={1} visual="idle" onPressTile={() => {}} />,
    );
    const rawStyle = getByTestId(testId(GAME_ID, 'tile', '1')).props.style;
    const resolved =
      typeof rawStyle === 'function' ? rawStyle({ pressed: false }) : rawStyle;
    const flat = Array.isArray(resolved) ? Object.assign({}, ...resolved) : resolved;
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    expect(flat.minWidth).toBeGreaterThanOrEqual(44);
  });

  it('exposes the button role and disabled state', async () => {
    const { getByTestId } = await render(
      <Tile index={0} visual="idle" disabled onPressTile={() => {}} />,
    );
    const el = getByTestId(testId(GAME_ID, 'tile', '0'));
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
