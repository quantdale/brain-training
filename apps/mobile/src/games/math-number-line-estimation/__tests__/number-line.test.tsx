/**
 * Number-line geometry guard (Campaign 076 certification defect): inside the
 * centered feedback card the line wrapper shrink-wrapped to its content and
 * collapsed the track (absolute-positioned children add no intrinsic width),
 * rendering the resolved line as a ~60px pill with squashed labels. The
 * wrapper must stretch to its container in every phase.
 */
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { testId } from '@/sdk';

import { NumberLine } from '../components/number-line';
import { GAME_ID } from '../types';

describe('NumberLine geometry', () => {
  it('stretches the wrapper to its container instead of shrink-wrapping', async () => {
    await render(
      <NumberLine lineMin={0} lineMax={10} target={7} onEstimate={() => {}} />,
    );
    expect(screen.getByTestId(testId(GAME_ID, 'number-line-wrap'))).toHaveStyle({
      alignSelf: 'stretch',
    });
  });
});
