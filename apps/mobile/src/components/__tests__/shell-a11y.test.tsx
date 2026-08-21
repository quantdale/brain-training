/**
 * Shell a11y contract tests (W12) — the cross-shell accessibility guarantees
 * every owned surface inherits: truthful roles/states, minimum 44pt touch
 * targets on text-style buttons, and live-region announcements for async
 * state (loading, errors, results).
 *
 * Mirrors the per-primitive contracts in `game-ui/__tests__/*.a11y.test.tsx`.
 * RNTL v14 `render` is async — every render is awaited.
 */
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { AccessibilityInfo } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ErrorBoundary } from '@/components/error-boundary';
import { GameNotReady } from '@/components/game-not-ready';
import { TabButton } from '@/components/app-tabs.web';
import { SensorySettingsCard } from '@/components/sensory/sensory-settings-card';
import { SettingsProvider } from '@/components/settings/settings-provider';
import StorageUnavailable from '@/app/storage-unavailable';

/** Resolve a Pressable's style prop (may be a fn of press state) to a flat list. */
function resolvedStyle(style: unknown): unknown[] {
  const resolved = typeof style === 'function' ? style({ pressed: false }) : style;
  return Array.isArray(resolved) ? resolved.flat() : [resolved];
}

function expectMinTouchTarget(element: { props: { style?: unknown } }): void {
  const flat = resolvedStyle(element.props.style).flat();
  const heights = flat
    .filter((s): s is { minHeight?: number } => !!s && typeof s === 'object' && 'minHeight' in s)
    .map((s) => s.minHeight ?? 0);
  expect(Math.max(...heights)).toBeGreaterThanOrEqual(44);
}

function Bomb(): ReactNode {
  // Function component so `react/require-render-return` doesn't demand an
  // unreachable return after the throw.
  throw new Error('kaboom');
}

describe('GameNotReady accessibility', () => {
  it('exposes the back action as a button with a 44pt touch target', async () => {
    await render(<GameNotReady />);
    const button = screen.getByTestId('game-not-ready-back-to-library');
    expect(button.props.accessibilityRole).toBe('button');
    // The 44pt guarantee sits on the visible label (expo-router's Link asChild
    // clone hides the Pressable's own style from the rendered tree).
    expectMinTouchTarget(screen.getByText('Back to library'));
  });

  it('announces the loading body via a polite live region', async () => {
    await render(<GameNotReady variant="loading" />);
    const body = screen.getByText('Starting the game…');
    expect(body.props.accessibilityLiveRegion).toBe('polite');
  });

  it('announces the not-found body via a polite live region', async () => {
    await render(<GameNotReady variant="not-found" />);
    const body = screen.getByText(/not in the library/);
    expect(body.props.accessibilityLiveRegion).toBe('polite');
  });
});

describe('ErrorBoundary accessibility', () => {
  let announceSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => undefined as unknown as void);
    announceSpy.mockClear();
    // React logs caught render errors by design; keep test output clean.
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    announceSpy.mockRestore();
    (console.error as ReturnType<typeof jest.spyOn>).mockRestore();
  });

  it('announces the default fallback to screen readers and offers a 44pt retry button', async () => {
    await render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(announceSpy).toHaveBeenCalledWith(expect.stringContaining('Something went wrong'));
    const retry = screen.getByTestId('error-boundary-retry');
    expect(retry.props.accessibilityRole).toBe('button');
    expectMinTouchTarget(retry);
  });

  it('does not announce when the consumer supplies its own fallback', async () => {
    await render(
      <ErrorBoundary fallback={<></>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(announceSpy).not.toHaveBeenCalled();
  });
});

describe('Web tab bar accessibility', () => {
  it('exposes tab role with a truthful selected state and a 44pt touch target', async () => {
    await render(
      <TabButton testID="tab-games" label="Games" sf="square.grid.2x2" symbol="grid_view" isFocused />,
    );
    const focused = screen.getByTestId('tab-games');
    expect(focused.props.accessibilityRole).toBe('tab');
    expect(focused.props.accessibilityState).toMatchObject({ selected: true });
    expectMinTouchTarget(focused);

    await render(
      <TabButton
        testID="tab-games-blurred"
        label="Games"
        sf="square.grid.2x2"
        symbol="grid_view"
        isFocused={false}
      />,
    );
    const blurred = screen.getByTestId('tab-games-blurred');
    expect(blurred.props.accessibilityRole).toBe('tab');
    expect(blurred.props.accessibilityState).toMatchObject({ selected: false });
  });
});

describe('SensorySettingsCard accessibility', () => {
  it('labels each switch with its row label AND caption (the switch is the only focusable element)', async () => {
    await render(
      <SettingsProvider>
        <SensorySettingsCard />
      </SettingsProvider>,
    );
    expect(screen.getByTestId('settings-sfx').props.accessibilityLabel).toBe(
      'Sound effects. Gameplay and UI sounds',
    );
    expect(screen.getByTestId('settings-haptics').props.accessibilityLabel).toBe(
      'Haptics. Vibration feedback',
    );
  });
});

describe('StorageUnavailable accessibility', () => {
  it('marks the recovery message as a live region and exposes the retry button', async () => {
    await render(<StorageUnavailable error={new Error('disk full')} onRetry={() => {}} />);
    const container = screen.getByTestId('storage-unavailable');
    expect(container.props.accessibilityLiveRegion).toBe('polite');
    const retry = screen.getByTestId('storage-unavailable-retry');
    expect(retry.props.accessibilityRole).toBe('button');
  });
});
