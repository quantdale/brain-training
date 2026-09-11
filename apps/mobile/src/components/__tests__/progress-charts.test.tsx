/**
 * Progress chart primitive tests (campaign 024).
 *
 * Pins the readability contract: every chart exposes a textual summary, a
 * zero state and visible label context, and segment identity comes from the
 * theme tokens — never the old fixed-hex palette. Assertions read props and
 * visible copy rather than re-rendering pixels, so they fail only when the
 * contract breaks.
 */

import { describe, expect, it } from '@jest/globals';

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { CalendarDay } from '@/analytics';
import { DomainColors } from '@/theme/tokens';
import {
  CalendarHeatmap,
  CompareBars,
  HeatmapRow,
  LabeledBars,
  MiniBarChart,
  StackedShareBar,
} from '@/components/progress-charts';

/** Fixed-hex palette the share bar used before the token migration. */
const LEGACY_SHARE_HEXES = [
  '#7C9EFF',
  '#69D2A8',
  '#FFB86B',
  '#FF7B9C',
  '#6BD5E1',
  '#C792EA',
  '#F7D774',
  '#A0AAB8',
];

function day(over: Partial<CalendarDay> & { dateKey: string }): CalendarDay {
  return { offsetDays: 0, count: 0, hasSession: false, ...over };
}

describe('MiniBarChart', () => {
  it('renders the zero state with the caller label when there are no values', async () => {
    await render(<MiniBarChart values={[]} testID="chart" emptyLabel="Nothing here yet" />);
    expect(screen.getByText('Nothing here yet')).toBeOnTheScreen();
    expect(screen.getByTestId('chart').props.accessibilityLabel).toBe('Nothing here yet');
  });

  it('exposes the caller summary and renders aligned day labels', async () => {
    await render(
      <MiniBarChart
        values={[2, 4, 1]}
        testID="chart"
        labels={['Mon', 'Tue', 'Wed']}
        summary="Sessions per day, busiest Tuesday."
      />,
    );
    expect(screen.getByTestId('chart').props.accessibilityLabel).toBe(
      'Sessions per day, busiest Tuesday.',
    );
    expect(screen.getByText('Mon')).toBeOnTheScreen();
    expect(screen.getByText('Wed')).toBeOnTheScreen();
  });

  it('ignores label context that does not line up with the values', async () => {
    await render(<MiniBarChart values={[2, 4]} testID="chart" labels={['Mon']} />);
    expect(screen.queryByText('Mon')).toBeNull();
  });
});

describe('StackedShareBar', () => {
  it('paints domain identity from the theme, never the legacy fixed hexes', async () => {
    await render(
      <StackedShareBar
        testID="share"
        segments={[
          { key: 'Memory', fraction: 0.5 },
          { key: 'Speed', fraction: 0.5 },
        ]}
      />,
    );
    const memoryFill = screen.getByTestId('share-memory').props.style.backgroundColor;
    const speedFill = screen.getByTestId('share-speed').props.style.backgroundColor;
    expect([DomainColors.light.memory.base, DomainColors.dark.memory.base]).toContain(memoryFill);
    expect([DomainColors.light.speed.base, DomainColors.dark.speed.base]).toContain(speedFill);
    expect(LEGACY_SHARE_HEXES).not.toContain(memoryFill);
    expect(LEGACY_SHARE_HEXES).not.toContain(speedFill);
  });

  it('announces the share breakdown and renders a labelled zero state', async () => {
    await render(
      <StackedShareBar
        testID="share"
        segments={[
          { key: 'Memory', fraction: 0.75 },
          { key: 'Speed', fraction: 0.25 },
        ]}
      />,
    );
    expect(screen.getByTestId('share').props.accessibilityLabel).toBe('Memory 75%, Speed 25%');

    await render(<StackedShareBar testID="share-empty" segments={[]} />);
    expect(screen.getByTestId('share-empty').props.accessibilityLabel).toBe('No data');
  });
});

describe('CompareBars', () => {
  it('exposes the caller summary and clamps fills into 0–100%', async () => {
    await render(
      <CompareBars
        testID="compare"
        summary="This window 9 sessions, previous window 3."
        rows={[
          { key: 'current', label: 'This window', valueLabel: '9', fraction: 2 },
          { key: 'previous', label: 'Previous', valueLabel: '3', fraction: -1 },
        ]}
      />,
    );
    expect(screen.getByTestId('compare').props.accessibilityLabel).toBe(
      'This window 9 sessions, previous window 3.',
    );
    expect(StyleSheet.flatten(screen.getByTestId('compare-current-fill').props.style).width).toBe('100%');
    expect(StyleSheet.flatten(screen.getByTestId('compare-previous-fill').props.style).width).toBe('0%');
  });

  it('renders a labelled zero state for an empty comparison', async () => {
    await render(<CompareBars testID="compare-empty" rows={[]} />);
    expect(screen.getByText('No data in this window')).toBeOnTheScreen();
  });
});

describe('LabeledBars', () => {
  it('shows a value caption per bar and summarises the distribution', async () => {
    await render(
      <LabeledBars
        testID="bars"
        bars={[
          { key: 'mon', label: 'Mon', value: 3 },
          { key: 'tue', label: 'Tue', value: 1 },
        ]}
      />,
    );
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('Tue')).toBeOnTheScreen();
    expect(screen.getByTestId('bars').props.accessibilityLabel).toBe('Mon 3, Tue 1');
  });

  it('renders the zero state when every bucket is empty', async () => {
    await render(
      <LabeledBars
        testID="bars-empty"
        bars={[{ key: 'mon', label: 'Mon', value: 0 }]}
        emptyLabel="No sessions yet"
      />,
    );
    expect(screen.getByText('No sessions yet')).toBeOnTheScreen();
  });
});

describe('HeatmapRow', () => {
  it('carries the week-level summary on the row, not on every cell', async () => {
    await render(
      <HeatmapRow
        testID="week"
        intensities={[0.5, 0]}
        weekLabel="Week of Sep 1: 2 sessions over 1 active day"
      />,
    );
    const row = screen.getByTestId('week');
    expect(row.props.accessibilityLabel).toBe('Week of Sep 1: 2 sessions over 1 active day');
    expect(screen.getByTestId('week-0').props.accessible).toBe(false);
  });
});

describe('CalendarHeatmap', () => {
  const days = [
    day({ dateKey: '2026-09-01', offsetDays: 6, count: 2, hasSession: true }),
    day({ dateKey: '2026-09-02', offsetDays: 5, count: 0, hasSession: false }),
    day({ dateKey: '2026-09-03', offsetDays: 4, count: 0, hasSession: false }),
    day({ dateKey: '2026-09-04', offsetDays: 3, count: 1, hasSession: true }),
    day({ dateKey: '2026-09-05', offsetDays: 2, count: 0, hasSession: false }),
    day({ dateKey: '2026-09-06', offsetDays: 1, count: 0, hasSession: false }),
    day({ dateKey: '2026-09-07', offsetDays: 0, count: 0, hasSession: false }),
  ];

  it('shows the visible date range and labels each week for assistive tech', async () => {
    await render(<CalendarHeatmap testID="cal" days={days} maxCount={2} />);
    expect(screen.getByText('Sep 1 – Sep 7')).toBeOnTheScreen();
    expect(screen.getByTestId('cal').props.accessibilityLabel).toBe(
      '2 of 7 days active, 3 sessions, Sep 1 – Sep 7',
    );
    expect(screen.getByTestId('cal-w0').props.accessibilityLabel).toBe(
      'Week of Sep 1: 3 sessions over 2 active days',
    );
  });

  it('renders a zero state instead of an empty grid', async () => {
    const idle = days.map((d) => ({ ...d, count: 0, hasSession: false }));
    await render(<CalendarHeatmap testID="cal-empty" days={idle} maxCount={0} />);
    expect(screen.getByText('No sessions in this view yet')).toBeOnTheScreen();
    expect(screen.getByTestId('cal-empty-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('cal-empty-w0')).toBeNull();
  });
});
