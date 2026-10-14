import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Stimulus } from '../components/stimulus';

describe('static stimulus semantics', () => {
  it('exposes the exact displayed color, shape and number as one image', async () => {
    await render(<Stimulus card={{ color: 'yellow', shape: 'triangle', number: 3 }} testID="target" disabled />);
    const image = screen.getByRole('image', { name: 'yellow triangle 3' });
    expect(image.props.testID).toBe('target');
    expect(image.props.accessible).toBe(true);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
