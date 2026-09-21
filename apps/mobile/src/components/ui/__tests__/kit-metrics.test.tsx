/**
 * UI-kit metrics contract tests.
 *
 * The metrics packet owns every determinate meter, hero ring, count-up,
 * stat row, header and segmented switch in the app, so these assertions pin
 * the things a per-screen re-implementation would get wrong: clamping and
 * the integer-percentage `accessibilityValue` contract, metric identity
 * colour, exact tab selection, and activation blocking on icon controls.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { AnimatedNumber } from '@/components/ui/animated-number';
import { IconButton } from '@/components/ui/icon-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { ProgressRing } from '@/components/ui/progress-ring';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatBlock } from '@/components/ui/stat-block';
import { Colors, METRIC_COLOR_KEYS, MinTouchTarget } from '@/theme/tokens';

// `mock`-prefixed name: jest.mock factories are hoisted and may only close
// over variables whose name starts with `mock`.
const mockReduceMotion = jest.fn<() => boolean>(() => false);
jest.mock('@/components/a11y/reduced-motion', () => ({
  usePrefersReducedMotion: () => mockReduceMotion(),
  motionValue: (reduced: boolean, animated: unknown, fallback: unknown) =>
    reduced ? fallback : animated,
  reduceDuration: (reduced: boolean, duration: number) => (reduced ? 0 : duration),
}));

function flatten(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  mockReduceMotion.mockReturnValue(false);
});

describe('ProgressBar', () => {
  it('clamps out-of-range values and reports an integer percentage', async () => {
    await render(
      <>
        <ProgressBar value={2} testID="over" />
        <ProgressBar value={-0.5} testID="under" />
        <ProgressBar value={0.456} testID="mid" />
      </>,
    );
    expect(screen.getByTestId('over').props.accessibilityRole).toBe('progressbar');
    expect(screen.getByTestId('over').props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 100 });
    expect(screen.getByTestId('under').props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 0 });
    const mid = screen.getByTestId('mid').props.accessibilityValue;
    expect(mid).toMatchObject({ min: 0, max: 100, now: 46 });
    expect(Number.isInteger(mid.now)).toBe(true);
  });

  it('renders the muted rollback segment only when a rollback value is given', async () => {
    await render(<ProgressBar value={0.8} rollbackValue={0.5} testID="roll" />);
    const segment = flatten(screen.getByTestId('roll-rollback').props.style);
    expect(segment.width).toBe('50%');
    expect(segment.opacity).toBeLessThan(1);
  });

  it('omits the rollback segment without a rollback value', async () => {
    await render(<ProgressBar value={0.8} testID="plain" />);
    expect(screen.queryByTestId('plain-rollback')).toBeNull();
  });
});

describe('ProgressRing', () => {
  it('clamps and reports the same progress contract', async () => {
    await render(
      <>
        <ProgressRing value={3} testID="over" />
        <ProgressRing value={-2} testID="under" />
      </>,
    );
    expect(screen.getByTestId('over').props.accessibilityRole).toBe('progressbar');
    expect(screen.getByTestId('over').props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 100 });
    expect(screen.getByTestId('under').props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 0 });
  });

  it('fills the first round(value * segments) ticks', async () => {
    await render(<ProgressRing value={0.5} segments={8} testID="ring" />);
    const ticks = screen.queryAllByTestId(/ring-tick-/);
    expect(ticks).toHaveLength(8);
    const colours = ticks.map((tick) => flatten(tick.props.style).backgroundColor);
    const distinct = colours.filter((colour, index) => colours.indexOf(colour) === index);
    expect(distinct).toHaveLength(2);
    expect(colours.filter((colour) => colour === colours[0])).toHaveLength(4);
  });
});

describe('AnimatedNumber', () => {
  it('renders the final value immediately under reduced motion', async () => {
    mockReduceMotion.mockReturnValue(true);
    await render(<AnimatedNumber value={987.2} testID="num" />);
    expect(screen.getByText('987')).toBeTruthy();
  });

  it('formats through the format prop', async () => {
    mockReduceMotion.mockReturnValue(true);
    await render(<AnimatedNumber value={42.4} format={(n) => `${Math.round(n)} XP`} />);
    expect(screen.getByText('42 XP')).toBeTruthy();
  });
});

describe('StatBlock', () => {
  it('paints the value in the metric identity colour', async () => {
    await render(<StatBlock label="Experience" value="1,200" metric="xp" testID="stat" />);
    expect(screen.getByText('1,200')).toBeTruthy();
    const colour = flatten(screen.getByTestId('stat-value').props.style).color;
    expect([Colors.light[METRIC_COLOR_KEYS.xp], Colors.dark[METRIC_COLOR_KEYS.xp]]).toContain(colour);
  });
});

describe('SegmentedControl', () => {
  it('marks exactly the active option selected and reports the option value', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
        value="week"
        onChange={onChange}
        testID="scope"
      />,
    );
    expect(screen.getByTestId('scope').props.accessibilityRole).toBe('tablist');
    const week = screen.getByTestId('scope-option-week');
    const month = screen.getByTestId('scope-option-month');
    expect(week.props.accessibilityRole).toBe('tab');
    expect(week.props.accessibilityState).toMatchObject({ selected: true });
    expect(month.props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(month);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('month');
  });

  it('lays out compact options at the 44 dp floor, not just via hit slop', async () => {
    // uiautomator exposes the option's laid-out bounds to assistive tech, so a
    // compact row must be a real 44 dp node; hit-slop expansion is invisible
    // to the Android accessibility tree and read as a 32 dp target.
    await render(
      <SegmentedControl
        options={[
          { value: '7d', label: '7d' },
          { value: '30d', label: '30d' },
        ]}
        value="7d"
        onChange={() => {}}
        compact
        testID="compact"
      />,
    );
    for (const id of ['compact-option-7d', 'compact-option-30d']) {
      expect(flatten(screen.getByTestId(id).props.style).minHeight).toBeGreaterThanOrEqual(
        MinTouchTarget,
      );
    }
  });
});

describe('IconButton', () => {
  it('blocks presses while disabled and exposes its label', async () => {
    const onPress = jest.fn();
    await render(
      <IconButton icon={<Text>★</Text>} label="Retry level" onPress={onPress} disabled testID="retry" />,
    );
    const control = screen.getByTestId('retry');
    expect(control.props.accessibilityRole).toBe('button');
    expect(control.props.accessibilityLabel).toBe('Retry level');
    await fireEvent.press(control);
    expect(onPress).not.toHaveBeenCalled();
    expect(control.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('fires onPress when enabled', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon={<Text>★</Text>} label="Retry level" onPress={onPress} testID="retry" />);
    await fireEvent.press(screen.getByTestId('retry'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ScreenHeader', () => {
  it('renders a labelled 44 dp back control that fires onBack', async () => {
    const onBack = jest.fn();
    await render(<ScreenHeader title="Memory" onBack={onBack} testID="header" />);
    const back = screen.getByTestId('header-back');
    expect(back.props.accessibilityRole).toBe('button');
    expect(back.props.accessibilityLabel).toBe('Back');
    expect(flatten(back.props.style).height).toBeGreaterThanOrEqual(MinTouchTarget);
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('omits the back control without onBack', async () => {
    await render(<ScreenHeader title="Memory" />);
    expect(screen.queryByTestId('screen-header-back')).toBeNull();
  });
});
