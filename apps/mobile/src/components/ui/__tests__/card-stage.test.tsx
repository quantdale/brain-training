/** Card `stage` variant contract (change 076 task 3.2, lock section 1).
 *  The stage is the immersive charcoal panel: white reading type, border
 *  instead of shadow, raised elevation — in BOTH schemes. */

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card } from '@/components/ui/card';

// Dark-scheme case: the hook re-exports RN's useColorScheme, so the test
// mocks the module before importing the component tree.
const mockColorScheme = jest.fn<() => string>(() => 'light');
jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => mockColorScheme(),
}));

describe('Card stage variant (076 lock)', () => {
  it('paints the locked stage surface in light mode with a border', async () => {
    render(<Card variant="stage" testID="stage-card-light"><Text>artifact</Text></Card>);
    await waitFor(() => expect(screen.getByTestId('stage-card-light')).toBeOnTheScreen());
    const card = screen.getByTestId('stage-card-light');
    const style = Array.isArray(card.props.style) ? card.props.style : [card.props.style];
    const flat = Object.assign({}, ...style.filter(Boolean));
    expect(flat.backgroundColor).toBe('#1F2124');
    expect(flat.borderWidth).toBe(1.5);
  });

  it('keeps the stage surface charcoal in dark mode', async () => {
    mockColorScheme.mockReturnValue('dark');
    render(<Card variant="stage" testID="stage-card-dark"><Text>artifact</Text></Card>);
    await waitFor(() => expect(screen.getByTestId('stage-card-dark')).toBeOnTheScreen());
    const card = screen.getByTestId('stage-card-dark');
    const style = Array.isArray(card.props.style) ? card.props.style : [card.props.style];
    const flat = Object.assign({}, ...style.filter(Boolean));
    expect(flat.backgroundColor).toBe('#1B1D21');
  });
});
