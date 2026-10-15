import { statusIconNames } from '@/test-utils/status-icons';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';


import { CommandList, GridBoard } from '../components/grid';

describe('Grid Navigator status and puzzle symbols', () => {
  it('renders a vector verdict while retaining the directional start and commands', async () => {
    await render(<>
      <GridBoard side={3} start={{ row: 0, col: 0 }} startDir="E" testID="board"
        markers={[{ cell: { row: 1, col: 1 }, color: '#eef', icon: 'check', iconColor: '#080' }]} />
      <CommandList testID="commands" commands={[{ type: 'left' }, { type: 'right' }]} />
    </>);
    expect(screen.getByTestId('spatial-grid-nav.start-marker')).toHaveTextContent('→');
    expect(screen.getByText('1. Turn left')).toBeOnTheScreen();
    expect(screen.getByText('2. Turn right')).toBeOnTheScreen();
    expect(statusIconNames(screen.root!)[0]).toBe('check');
    expect(screen.root!.queryAll((node) => node.type === 'RNSVGGroup').some((group) => Number(group.props.strokeWidth) === 2)).toBe(true);
    expect(screen.queryByText('✓', { includeHiddenElements: true })).toBeNull();
  });
});
