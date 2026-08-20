/**
 * Visual Search Tile accessibility (task 07).
 *
 * The board is a find-the-odd-one-out discrimination task. A screen-reader
 * user must be able to explore tiles, but the tile's accessibility label must
 * never disclose which tile is the target — that would leak the answer.
 * Correctness is conveyed only after a tap via `accessibilityState`. RNTL v14
 * `render` is async, so every render is awaited.
 */
import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { testId } from '@/sdk';

import { Tile } from '../components/tile';
import { GAME_ID } from '../types';

describe('VisualSearch Tile accessibility (no answer leak)', () => {
  it('keeps a neutral label for the target tile during play', async () => {
    const { getByTestId } = await render(
      <Tile index={2} visual="target" onPressTile={() => {}} />,
    );
    const el = getByTestId(testId(GAME_ID, 'tile', '2'));
    expect(el.props.accessibilityLabel).toBe('Tile 3');
    expect(el.props.accessibilityLabel).not.toMatch(/odd one|target|answer/i);
  });

  it('keeps a neutral label for a distractor tile', async () => {
    const { getByTestId } = await render(
      <Tile index={5} visual="idle" onPressTile={() => {}} />,
    );
    expect(getByTestId(testId(GAME_ID, 'tile', '5')).props.accessibilityLabel).toBe('Tile 6');
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

  it('exposes the button role and disabled state', async () => {
    const { getByTestId } = await render(
      <Tile index={0} visual="idle" disabled onPressTile={() => {}} />,
    );
    const el = getByTestId(testId(GAME_ID, 'tile', '0'));
    expect(el.props.accessibilityRole).toBe('button');
    expect(el.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
