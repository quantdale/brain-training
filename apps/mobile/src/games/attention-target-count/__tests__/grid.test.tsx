/**
 * Grid accessibility — the non-interactive display grid must stay out of the
 * assistive-tech tree (cells used to surface as unlabelled `image` nodes),
 * and become labelled buttons when a press handler is supplied.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Grid } from '../components/grid';

describe('Grid accessibility', () => {
  it('hides non-interactive cells from the accessibility tree', async () => {
    await render(<Grid cells={['★', '☆', '★']} testIdCell={(i) => `cell-${i}`} />);
    for (const id of ['cell-0', 'cell-1', 'cell-2']) {
      const cell = screen.getByTestId(id);
      expect(cell.props.accessible).toBe(false);
      expect(cell.props.accessibilityRole).toBeUndefined();
      expect(cell.props.accessibilityLabel).toBeUndefined();
    }
  });

  it('labels interactive cells and marks them as buttons', async () => {
    const onCellPress = jest.fn();
    await render(
      <Grid cells={['★', '☆']} testIdCell={(i) => `cell-${i}`} onCellPress={onCellPress} />,
    );
    const first = screen.getByTestId('cell-0');
    expect(first.props.accessible).toBe(true);
    expect(first.props.accessibilityRole).toBe('button');
    expect(first.props.accessibilityLabel).toBe('Cell 1');
    expect(screen.getByTestId('cell-1').props.accessibilityLabel).toBe('Cell 2');
    await fireEvent.press(first);
    expect(onCellPress).toHaveBeenCalledWith(0);
  });

  it('keeps a disabled interactive cell labelled and announced as disabled', async () => {
    await render(
      <Grid cells={['★']} testIdCell={() => 'cell-0'} onCellPress={() => {}} disabled />,
    );
    const cell = screen.getByTestId('cell-0');
    expect(cell.props.accessibilityRole).toBe('button');
    expect(cell.props.accessibilityLabel).toBe('Cell 1');
    expect(cell.props.accessibilityState).toMatchObject({ disabled: true });
  });
});
