/**
 * W15 campaign011 — ScreenShell bottom-inset math under controlled insets.
 *
 * Pins the contract documented on `resolveBottomPadding` (campaign009 audit B5):
 * - Web: floating-bar reserve (`BottomTabInset`) + spacing (24) — asserted as
 *   the exact token composition, independent of device insets (see the web
 *   test for the load-time caveat).
 * - Native tab routes: standard 24pt spacing only — the tab host absorbs the
 *   device bottom inset itself, so adding it would double-compensate.
 * - Native pushed routes: max(real bottom inset, 24). Exercises the packet
 *   matrix 0 / 34 / 50 where 34 ≈ notched-iPhone home-indicator zone
 *   (`HomeIndicatorInset`) and 50 ≈ iOS tab-bar-height-class inset.
 * - Missing insets provider (isolated harness): falls back to 24 instead of
 *   throwing (defensive `?? 0` + max floor).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';

import { ScreenShell } from '@/components/screen-shell';

let mockSegments: readonly string[] = [];

jest.mock('expo-router', () => ({
  // Cast: requireActual is typed `unknown` under @types/jest 29.
  ...(jest.requireActual('expo-router') as Record<string, unknown>),
  // Overridden per-test via `mockSegments`; default = pushed route.
  useSegments: () => mockSegments,
}));

/** Latest render result — RNTL v14 `render` is async; traverse via `.root`. */
let latestView: Awaited<ReturnType<typeof render>>;

function Harness({ children }: { children: ReactNode }): ReactNode {
  return children;
}

/** Render ScreenShell inside an explicit insets provider (or none when null). */
async function renderShell(insetsBottom: number | null): Promise<void> {
  let tree = <ScreenShell>
      <View testID="shell-content" />
    </ScreenShell>;
  if (insetsBottom !== null) {
    tree = (
      <SafeAreaInsetsContext.Provider value={{ top: 0, bottom: insetsBottom, left: 0, right: 0 }}>
        {tree}
      </SafeAreaInsetsContext.Provider>
    );
  }
  latestView = await render(<Harness>{tree}</Harness>);
}

/** Extract the effective paddingBottom from the shell ScrollView's style list. */
function paddingBottomOfShell(): number {
  // RNTL v14's TestInstance exposes queryAll(predicate) only — target the
  // shell ScrollView by its unique contentContainerStyle prop.
  const root = latestView.root;
  if (!root) {
    throw new Error('Render root unavailable');
  }
  const matches = root.queryAll(
    (instance) =>
      typeof instance.props === 'object' &&
      instance.props !== null &&
      'contentContainerStyle' in instance.props
  );
  const scrollView = matches.at(-1);
  if (!scrollView) {
    throw new Error('ScreenShell ScrollView (contentContainerStyle) not found in rendered tree');
  }
  const raw = scrollView.props.contentContainerStyle;
  const flat = (Array.isArray(raw) ? raw : [raw]).flat(Infinity).filter(Boolean) as (Record<string, unknown> | false | '' | null | undefined)[];
  for (const entry of flat) {
    if (entry && typeof entry === 'object' && 'paddingBottom' in entry) {
      return entry.paddingBottom as number;
    }
  }
  throw new Error(`No paddingBottom found in contentContainerStyle: ${JSON.stringify(raw)}`);
}

describe('ScreenShell bottom inset math (campaign009 B5 regression)', () => {
  beforeEach(() => {
    mockSegments = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pushed route with zero inset floors at standard 24pt spacing', async () => {
    await renderShell(0);
    expect(paddingBottomOfShell()).toBe(Spacing.four);
  });

  it('pushed route honors the ~34pt home-indicator zone verbatim', async () => {
    await renderShell(34);
    expect(paddingBottomOfShell()).toBe(34);
    expect(paddingBottomOfShell()).toBeGreaterThanOrEqual(Spacing.four);
  });

  it('pushed route honors a 50pt inset verbatim', async () => {
    await renderShell(50);
    expect(paddingBottomOfShell()).toBe(50);
  });

  it('native tab route ignores the device inset (tab host absorbs it)', async () => {
    mockSegments = ['(tabs)', 'index'];
    await renderShell(50);
    expect(paddingBottomOfShell()).toBe(Spacing.four);
  });

  it('missing insets provider degrades to 24pt instead of throwing', async () => {
    await renderShell(null);
    expect(paddingBottomOfShell()).toBe(Spacing.four);
  });

  it('web reserves floating-tab-bar height + spacing regardless of insets', async () => {
    // Platform.OS is a data property — replaceProperty + explicit restore.
    const replacedOs = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      mockSegments = ['(tabs)', 'index'];
      await renderShell(50);
      // Web padding must come from the shared tokens, not be recomputed.
      // Note: BottomTabInset itself is a load-time Platform.select, so under
      // jest-expo (module graph loaded as ios) it holds 50 — the literal 64/88
      // pairing only exists in a true web bundle. The pinned invariant is the
      // exact composition `BottomTabInset + Spacing.four`.
      expect(paddingBottomOfShell()).toBe(BottomTabInset + Spacing.four);
    } finally {
      replacedOs.restore();
    }
  });
});

/**
 * Release-APK device defect (campaign022): ScrollView content containers
 * size to intrinsic height, so the shell row never reached viewport height.
 * GameHost (`flex: 1`) and tutorial cards (clamped by `maxHeight: '88%'`)
 * collapsed to content height, laying first-run tutorial buttons outside
 * their own card with zero rendered height — untappable on fresh installs.
 * The contract: the content container must grow to fill the viewport.
 */
function contentStyleField<K extends string>(field: K): unknown {
  const root = latestView.root;
  if (!root) {
    throw new Error('Render root unavailable');
  }
  const matches = root.queryAll(
    (instance) =>
      typeof instance.props === 'object' &&
      instance.props !== null &&
      'contentContainerStyle' in instance.props,
  );
  const scrollView = matches.at(-1);
  if (!scrollView) {
    throw new Error('ScreenShell ScrollView (contentContainerStyle) not found in rendered tree');
  }
  const raw = scrollView.props.contentContainerStyle;
  const flat = (Array.isArray(raw) ? raw : [raw]).flat(Infinity).filter(Boolean) as Record<string, unknown>[];
  for (const entry of flat) {
    if (entry && typeof entry === 'object' && field in entry) {
      return entry[field];
    }
  }
  return undefined;
}

describe('ScreenShell viewport growth (release-APK tutorial-clip regression)', () => {
  beforeEach(() => {
    mockSegments = [];
  });

  it('content container grows to fill the viewport (flexGrow, not flex)', async () => {
    await renderShell(0);
    // flexGrow is the safe form: flex: 1 on a contentContainer breaks
    // scroll-when-taller measurement (RN documented pattern).
    expect(contentStyleField('flexGrow')).toBe(1);
    expect(contentStyleField('flex')).toBeUndefined();
  });
});
