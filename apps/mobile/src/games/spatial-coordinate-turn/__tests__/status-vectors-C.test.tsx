import { statusIconNames } from '@/test-utils/status-icons';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';


import { OptionArrow } from '../components/compass';

describe('Coordinate Turn status and puzzle direction', () => {
  it('retains the diagonal direction and action while a wrong verdict becomes a vector', async () => {
    const press = jest.fn();
    const result = await render(<OptionArrow dir="NE" index={0} selected={false} correct={false} onPress={press} />);
    expect(screen.getByRole('button', { name: 'Direction NE' })).toBeOnTheScreen();
    expect(screen.getByText('↗')).toBeOnTheScreen();
    expect((statusIconNames(screen.root!)[0] ?? null)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Direction NE' }));
    expect(press).toHaveBeenCalledTimes(1);
    await result.rerender(<OptionArrow dir="NE" index={0} selected correct={false} onPress={press} disabled />);
    expect(screen.getByRole('button', { name: 'Direction NE, wrong pick' })).toBeDisabled();
    expect(screen.getByText('↗')).toBeOnTheScreen();
    expect(statusIconNames(screen.root!)[0]).toBe('close');
  });
});
