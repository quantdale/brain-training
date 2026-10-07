/**
 * Playfield structural guard for the target hit-test defect (Campaign 076
 * certification): the target marker must never intercept touches. Android
 * reports gesture locationX/Y relative to the hit-tested child, so an
 * interactive target child makes the field's normalized hit test compute a
 * miss for every genuine on-target tap. The marker is decorative; touches
 * must always resolve to the field Pressable.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { testId } from '@/sdk';

import { Playfield } from '../components/playfield';
import { GAME_ID } from '../types';

describe('Playfield target hit-test guard', () => {
  it('renders the target marker as touch-transparent', async () => {
    await render(
      <Playfield
        target={{ x: 0.5, y: 0.5 }}
        radius={0.075}
        onTap={() => {}}
        testID={testId(GAME_ID, 'field')}
      />,
    );
    const target = screen.getByTestId(testId(GAME_ID, 'target'));
    expect(target.props.pointerEvents).toBe('none');
  });
});
