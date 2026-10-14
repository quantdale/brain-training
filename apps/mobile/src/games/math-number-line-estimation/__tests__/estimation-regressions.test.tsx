import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { NumberLine } from '../components/number-line';
import NumberLineScreen from '../screen';
import { GAME_ID } from '../types';
import { createFakeClock, createInMemoryTutorialStore, testId } from '@/sdk';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), navigate: jest.fn() }) }));
beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('Number Line actual estimation task', () => {
  it('plays from the numeric target actually shown to the player and reveals its position only after submit', async () => {
    const store = createInMemoryTutorialStore();
    store.setTutorialState(GAME_ID, { completed: true, replayRequested: false, version: '1.0.0' });
    await render(<NumberLineScreen clock={createFakeClock(0)} tutorialStore={store} sessionSeed="observed-target" numberLineWidth={300} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'start')));
    const displayedTarget = Number(screen.getByTestId(testId(GAME_ID, 'target-value')).props.children);
    const displayedMin = Number(screen.getByTestId(testId(GAME_ID, 'line-label-min')).props.children);
    const displayedMax = Number(screen.getByTestId(testId(GAME_ID, 'line-label-max')).props.children);
    const fraction = (displayedTarget - displayedMin) / (displayedMax - displayedMin);
    expect(screen.queryByTestId(testId(GAME_ID, 'line-flag'))).toBeNull();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number-line')), { nativeEvent: { locationX: fraction * 300 } });
    expect(screen.queryByTestId(testId(GAME_ID, 'line-flag'))).toBeNull();
    expect(screen.queryByTestId(testId(GAME_ID, 'round-hit'))).toBeNull();
    expect(screen.getByTestId(testId(GAME_ID, 'line-selection'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit-estimate')));
    expect(screen.getByTestId(testId(GAME_ID, 'round-hit'))).toBeTruthy();
    expect(screen.getByTestId(testId(GAME_ID, 'line-flag'))).toHaveStyle({ left: `${fraction * 100}%` });
    expect(screen.getByTestId(testId(GAME_ID, 'reveal'))).toHaveTextContent(`The target was ${displayedTarget}. You estimated ${displayedTarget}.`);
  });

  it('provides adjustable actions, a position value and a single explicit commit', async () => {
    const onEstimate = jest.fn();
    await render(<NumberLine lineMin={0} lineMax={100} target={37} onEstimate={onEstimate} width={300} />);
    const line = () => screen.getByTestId(testId(GAME_ID, 'number-line'));
    expect(line()).toHaveStyle({ height: 48 });
    expect(line().props.accessibilityValue).toEqual(expect.objectContaining({ min: 0, max: 100, now: 50 }));
    await fireEvent(line(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(line().props.accessibilityValue.now).toBe(51);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'estimate-decrease')));
    expect(line().props.accessibilityValue.now).toBe(50);
    expect(onEstimate).not.toHaveBeenCalled();
    await fireEvent(line(), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    await fireEvent(line(), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onEstimate).toHaveBeenCalledTimes(1);
    expect(onEstimate).toHaveBeenCalledWith(50);
  });

  it('keeps paused adjustments and commit disabled', async () => {
    const onEstimate = jest.fn();
    await render(<NumberLine lineMin={0} lineMax={100} target={37} onEstimate={onEstimate} width={300} disabled />);
    await fireEvent(screen.getByTestId(testId(GAME_ID, 'number-line')), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'estimate-increase')));
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit-estimate')));
    expect(screen.queryByTestId(testId(GAME_ID, 'line-selection'))).toBeNull();
    expect(onEstimate).not.toHaveBeenCalled();
  });

  it('never renders the exact target flag during live estimation', async () => {
    await render(<NumberLine lineMin={0} lineMax={100} target={37} onEstimate={() => {}} width={300} />);
    expect(screen.queryByTestId(testId(GAME_ID, 'line-flag'))).toBeNull();
  });

  it('shows a numeric target while withholding its position until feedback', async () => {
    await render(<NumberLine lineMin={0} lineMax={100} target={37} onEstimate={() => {}} width={300} />);
    expect(screen.getByText('37')).toBeTruthy();
    expect(screen.queryByTestId(testId(GAME_ID, 'line-flag'))).toBeNull();
  });

  it('keeps a tap adjustable and commits only through the reachable submit action', async () => {
    const onEstimate = jest.fn();
    await render(<NumberLine lineMin={0} lineMax={100} target={37} onEstimate={onEstimate} width={300} />);
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'number-line')), { nativeEvent: { locationX: 150 } });
    expect(onEstimate).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId(testId(GAME_ID, 'submit-estimate')));
    expect(onEstimate).toHaveBeenCalledWith(50);
  });
});
