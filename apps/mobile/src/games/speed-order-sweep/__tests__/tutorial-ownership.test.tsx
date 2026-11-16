import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { testId } from '@/sdk';
import { Tutorial } from '../components/tutorial';
import type { TokenGridProps } from '../components/token-grid';
import { GAME_ID } from '../types';
let mockGrid: TokenGridProps;
jest.mock('../components/token-grid', () => {
  const actual = jest.requireActual<typeof import('../components/token-grid')>('../components/token-grid');
  const React = jest.requireActual<typeof import('react')>('react');
  return { ...actual, TokenGrid: (props: TokenGridProps) => { mockGrid = props; return React.createElement(actual.TokenGrid, props); } };
});
async function mount() {
  const result = await render(<Tutorial onComplete={jest.fn()} />);
  await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'tutorial-next')));
  return result;
}
function ids() { return mockGrid.round.order.map((value) => mockGrid.round.tokens.find((token) => token.value === value)!.id); }
describe('Order Sweep tutorial synchronous cursor', () => {
  it('accepts a rapid visible sweep, ignoring cleared-token duplicate delivery', async () => {
    await mount();
    const tap = mockGrid.onTap;
    const [first, second, third, fourth] = ids();
    await act(async () => { tap(first); tap(first); tap(second); });
    expect(mockGrid.clearedCount).toBe(2);
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-demo-status'))).toHaveTextContent(/2 left/);
    await act(async () => { tap(third); tap(fourth); });
    expect(screen.getByTestId(testId(GAME_ID, 'tutorial-done'))).toBeOnTheScreen();
  });
  it('retires the wrong attempt synchronously and rejects its callback after retry/unmount', async () => {
    const result = await mount();
    const old = mockGrid.onTap;
    const [first, second] = ids();
    await act(async () => { old(second); old(first); old(second); });
    expect(mockGrid.clearedCount).toBe(0);
    const currentBoard = mockGrid.round;
    await act(async () => old(second));
    expect(mockGrid.round).toBe(currentBoard);
    const retired = mockGrid.onTap;
    const currentIds = ids();
    await result.unmount();
    await act(async () => currentIds.forEach(retired));
  });
});
