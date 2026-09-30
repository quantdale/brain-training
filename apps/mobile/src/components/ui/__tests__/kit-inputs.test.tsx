/**
 * UI-kit inputs contract tests (packet 2: form, selection, rows, feedback).
 *
 * Same contract as `kit-contract.test.tsx` — activation blocking, accessible
 * names/roles/states, the 44 dp floor — applied to the second half of the kit:
 * `TextField` stays editable in error state, `Chip` reports selection and
 * blocks while disabled, `ListRow` only fires when pressable, `Skeleton`
 * exposes no accessible content, queued toasts flush once and dismiss, and
 * `EmptyState` fires its single action exactly once.
 */

import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';


import { Badge } from '@/components/ui/badge';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Skeleton, SkeletonText } from '@/components/ui/skeleton';
import { TextField } from '@/components/ui/text-field';
import { ToastHost, resetToastQueueForTests, showToast, toastQueueTitlesForTests } from '@/components/ui/toast';
import { Motion } from '@/theme/tokens';

// `mock`-prefixed name: jest.mock factories are hoisted and may only close
// over variables whose name starts with `mock`.
const mockReduceMotion = jest.fn<() => boolean>(() => false);
jest.mock('@/components/a11y/reduced-motion', () => ({
  usePrefersReducedMotion: () => mockReduceMotion(),
  motionValue: (reduced: boolean, animated: unknown, fallback: unknown) =>
    reduced ? fallback : animated,
  reduceDuration: (reduced: boolean, duration: number) => (reduced ? 0 : duration),
}));

beforeEach(() => {
  mockReduceMotion.mockReturnValue(false);
  resetToastQueueForTests();
});

describe('TextField', () => {
  it('shows the error state and keeps the input editable', async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField
        label="Name"
        value=""
        onChangeText={onChangeText}
        placeholder="Your name"
        error="Name is required"
        testID="name"
      />,
    );
    expect(screen.getByText('Name is required')).toBeTruthy();
    const input = screen.getByTestId('name');
    expect(input.props.editable).toBe(true);
    await fireEvent.changeText(input, 'Ada');
    expect(onChangeText).toHaveBeenCalledWith('Ada');
  });

  it('defaults its accessible name to the label', async () => {
    await render(<TextField label="Name" value="" onChangeText={() => {}} testID="name" />);
    expect(screen.getByTestId('name').props.accessibilityLabel).toBe('Name');
  });

  it('offers a labelled clear affordance that calls onClear', async () => {
    const onClear = jest.fn();
    await render(
      <TextField label="Name" value="Ada" onChangeText={() => {}} onClear={onClear} testID="name" />,
    );
    await fireEvent.press(screen.getByLabelText('Clear Name'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('hides the clear affordance when there is nothing to clear', async () => {
    await render(
      <TextField label="Name" value="" onChangeText={() => {}} onClear={() => {}} testID="name" />,
    );
    expect(screen.queryByLabelText('Clear Name')).toBeNull();
  });
});

describe('Chip', () => {
  it('exposes selection and fires when pressed', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Memory" selected onPress={onPress} testID="chip" />);
    expect(screen.getByTestId('chip').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('chip'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('blocks presses while disabled and reports it', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Memory" onPress={onPress} disabled testID="chip" />);
    await fireEvent.press(screen.getByTestId('chip'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('chip').props.accessibilityState.disabled).toBe(true);
  });

  it('is a real 44 dp target, not a small pill with invisible slop', async () => {
    // The hierarchy audit measures laid-out bounds, so the target must be real
    // height: a filter row of 34 dp pills is genuinely harder to hit.
    await render(<Chip label="Memory" onPress={() => {}} testID="chip" />);
    const style = screen.getByTestId('chip').props.style;
    const flat = (Array.isArray(style) ? style.flat() : [style]).filter(Boolean) as {
      minHeight?: number;
    }[];
    const minHeight = flat.reduce((acc, entry) => Math.max(acc, entry.minHeight ?? 0), 0);
    expect(minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });
});

describe('Badge', () => {
  it('switches the soft fill per family instead of hardcoding one colour', async () => {
    await render(
      <>
        <Badge label="Done" tone="success" testID="ok" />
        <Badge label="Risky" tone="danger" testID="risk" />
      </>,
    );
    const flatten = (id: string) => {
      const style = screen.getByTestId(id).props.style;
      return (Array.isArray(style) ? Object.assign({}, ...style.flat().filter(Boolean)) : style) as {
        backgroundColor: string;
      };
    };
    expect(flatten('ok').backgroundColor).toMatch(/^#/);
    expect(flatten('risk').backgroundColor).toMatch(/^#/);
    expect(flatten('ok').backgroundColor).not.toBe(flatten('risk').backgroundColor);
  });
});

describe('ListRow', () => {
  it('fires as a labelled button with a chevron when pressable', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Session" subtitle="Yesterday" onPress={onPress} testID="row" />);
    expect(screen.getByTestId('row').props.accessibilityRole).toBe('button');
    // The chevron is decoration: it must NOT carry an id, or prefix-based row
    // discovery counts every row twice.
    expect(screen.queryByTestId('row-chevron')).toBeNull();
    expect(screen.getByText('›')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders static rows as plain views with no press affordance', async () => {
    await render(<ListRow title="Session" subtitle="Yesterday" testID="row" />);
    expect(screen.getByTestId('row').props.accessibilityRole).toBeUndefined();
    expect(screen.getByTestId('row').props.onPress).toBeUndefined();
    expect(screen.queryByTestId('row-chevron')).toBeNull();
  });
});

describe('EmptyState', () => {
  it('fires its single action exactly once', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        title="No sessions yet"
        message="Play a game to see history"
        actionLabel="Browse games"
        onAction={onAction}
        testID="empty"
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByText('Browse games'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('058: never truncates the guidance message', async () => {
    const longMessage =
      'This game is not in your library. It may have been renamed or removed — browse the library to find something to play.';
    await render(<EmptyState title="Unknown game" message={longMessage} testID="empty" />);
    // No one-line cap: sighted users keep the full guidance.
    expect(screen.getByText(longMessage).props.numberOfLines).toBeUndefined();
  });
});

describe('Skeleton', () => {
  it('exposes no accessible content for lone placeholders', async () => {
    await render(<Skeleton testID="skel" />);
    expect(screen.queryByTestId('skel')).toBeNull();
  });

  it('labels the text variant once while hiding its bars', async () => {
    await render(<SkeletonText lines={3} testID="para" />);
    expect(screen.getByTestId('para').props.accessibilityLabel).toBe('Loading');
    expect(screen.queryByTestId('para-line-0')).toBeNull();
    expect(screen.queryByTestId('para-line-2')).toBeNull();
  });
});

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('flushes toasts queued before mount one at a time, then auto-dismisses', async () => {
    showToast({ title: 'Saved' });
    showToast({ title: 'Synced', detail: 'All progress uploaded' });
    await render(<ToastHost />);
    await act(async () => {
      jest.advanceTimersByTime(Motion.celebration * 4);
    });
    expect(screen.queryByText('Saved')).toBeNull();
    expect(screen.getByText('Synced')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(Motion.celebration * 4);
    });
    expect(screen.queryByText('Synced')).toBeNull();
  });
  it('061: bounds the pre-mount queue, dropping oldest first', () => {
    for (let i = 1; i <= 9; i += 1) {
      showToast({ title: `toast-${i}` });
    }
    expect(toastQueueTitlesForTests()).toEqual([
      'toast-2',
      'toast-3',
      'toast-4',
      'toast-5',
      'toast-6',
      'toast-7',
      'toast-8',
      'toast-9',
    ]);
  });

  it('never blocks touches and announces politely', async () => {
    showToast({ title: 'Saved' });
    await render(<ToastHost testID="host" />);
    expect(screen.getByTestId('host').props.pointerEvents).toBe('none');
    expect(screen.getByTestId('toast').props.accessibilityLiveRegion).toBe('polite');
  });
});
