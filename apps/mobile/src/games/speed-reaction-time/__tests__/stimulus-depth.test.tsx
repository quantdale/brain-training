/**
 * Stimulus-depth regression: the trigger is this screen's focal surface, so
 * it must carry the `Elevation.raised` depth tokens (boxShadow + elevation)
 * instead of reading as a flat card. Presentation only — no timing contract
 * is asserted or affected here.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { testId } from '@/sdk';
import { Elevation } from '@/constants/theme';
import { TriggerButton } from '../components/trigger';
import { GAME_ID } from '../types';

describe('Reaction Time stimulus depth', () => {
  it.each([
    ['waiting', false, false],
    ['GO', true, false],
    ['HOLD', true, true],
  ] as const)('lifts the %s stimulus surface with the raised elevation tokens', async (...args) => {
    const [, active, hold] = args;
    const onPress = jest.fn();
    await render(
      <TriggerButton active={active} hold={hold} testID={testId(GAME_ID, 'trigger')} onPress={onPress} />,
    );
    const surface = StyleSheet.flatten(screen.getByTestId(testId(GAME_ID, 'trigger')).props.style);
    expect(surface.elevation).toBe(Elevation.raised.elevation);
    expect(surface.boxShadow).toBe(Elevation.raised.boxShadow);
  });
});
