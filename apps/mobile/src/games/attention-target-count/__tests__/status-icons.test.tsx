import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CountOptions } from '../components/count-options';

describe('Target Count vector outcome markers', () => {
  it('shows wrong and correct vectors together while preserving locked numeric choices', async () => {
    const choose = jest.fn();
    await render(<CountOptions options={[1, 2]} disabled onSelect={choose}
      visualFor={(value) => value === 2 ? 'correct' : 'wrong'} />);
    for (const [label, path] of [
      ['Wrong pick: 1', 'M18 6 6 18'], ['Correct: 2', 'M20 6 9 17l-5-5'],
    ]) {
      const option = screen.getByLabelText(label);
      const vectors = option.queryAll((node) => node.type.startsWith('RNSVGSvgView'));
      expect(vectors).toHaveLength(1);
      expect(vectors[0].queryAll((node) => node.type === 'RNSVGPath' && node.props.d === path)).toHaveLength(1);
      expect(vectors[0].props.accessible).toBe(false);
      expect(option.props.accessibilityState).toMatchObject({ disabled: true, selected: true });
      await fireEvent.press(option);
    }
    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
    expect(choose).not.toHaveBeenCalled();
    expect(screen.queryAllByText(/[✓✕]/, { includeHiddenElements: true })).toHaveLength(0);
  });

  it('leaves live numeric choices neutral and tappable', async () => {
    const choose = jest.fn();
    await render(<CountOptions options={[1, 2]} onSelect={choose} />);
    const option = screen.getByLabelText('2');
    expect(option.queryAll((node) => node.type.startsWith('RNSVGSvgView'))).toHaveLength(0);
    await fireEvent.press(option);
    expect(choose).toHaveBeenCalledWith(2);
  });
});
