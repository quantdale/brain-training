/**
 * Visual-baseline canary snapshots (campaign 003, item 8 — light, not a full
 * hardening campaign).
 *
 * The canary set pins the SHELL screens' stable first-run/empty states:
 * Home (no games registered → workout empty state), Games (empty state),
 * Progress (db-unavailable fallback) and Profile (db-unavailable fallback).
 *
 * Each of the four canary screens is ALSO rendered as a BARE route (no
 * `(tabs)` layout) for its baseline: the native tab host stamps a per-render
 * random `screenId` into the tree, which would make raw router-tree snapshots
 * non-deterministic.
 *
 * The bare-tree renders are deterministic across dates and runs by construction
 * — with the db unavailable every screen renders its static fallback, and the
 * empty game registry keeps the date-seeded workout out of the snapshot.
 *
 * The random-`screenId` instability itself is solved by the normalization seam
 * in `./router-tree-normalizer.ts`, which lets ONE integrated test pin the real
 * NativeTabs navigation tree (all four triggers + focused-tab wiring + screen
 * content) deterministically — see the last test in this file.
 *
 * Game-level visual determinism is covered separately by each game's seeded
 * generator/screen tests (fixed seeds → fixed boards), so no game screen is
 * snapshot here. A full pixel/seed baseline suite belongs to a hardening
 * campaign, not Phase 3.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import HomeScreen from '@/app/(tabs)/index';
import GamesScreen from '@/app/(tabs)/games';
import ProfileScreen from '@/app/(tabs)/profile';
import ProgressScreen from '@/app/(tabs)/progress';
import AppTabs from '@/components/app-tabs';
import { SettingsProvider } from '@/components/settings/settings-provider';
import { registerGameDefinitions } from '@/registry/registry';
import { expectConsoleNoise } from '@/test-utils';

import { normalizeRouterTree } from './router-tree-normalizer';

/**
 * This suite deliberately renders the shell screens with NO initialized
 * database, so the Home dashboard's workout loader logs its expected
 * diagnostic. Scope that message to the tests that render Home rather than
 * letting it read as unexpected noise.
 */
function scopeDbUnavailableNoise(fn: () => Promise<void>): Promise<void> {
  return expectConsoleNoise(
    /\[workout\] load failed/,
    fn,
    { max: 8 },
  );
}

/** Render one screen as a bare route so no tab host enters the tree. */
function renderBare(Screen: ComponentType, initialUrl: string) {
  // Register the screen under the requested URL — otherwise non-"/" URLs
  // ("/games", "/progress", "/profile") fall through to the "Unmatched Route"
  // fallback and the snapshot pins that fallback instead of the real screen.
  const routeKey = initialUrl.replace(/^\//, '') || 'index';
  return renderRouter({ [routeKey]: () => <Screen /> } as Record<string, ComponentType>, {
    initialUrl,
  });
}

describe('visual baselines (canary set)', () => {
  it('Home — first-run dashboard snapshot', async () => {
    registerGameDefinitions([]);
    await scopeDbUnavailableNoise(async () => {
      await renderBare(HomeScreen, '/');
    });
    expect(screen.toJSON()).toMatchSnapshot();
  });

  it('Games — empty catalog snapshot', async () => {
    registerGameDefinitions([]);
    await renderBare(GamesScreen, '/games');
    expect(screen.toJSON()).toMatchSnapshot();
  });

  it('Progress — db-unavailable fallback snapshot', async () => {
    // The fallback heatmap labels its trailing 30-day window from the current
    // date, which broke this snapshot every calendar day. Pin the clock to
    // local noon 2026-09-11 (the date the Campaign 026 snapshot was recorded)
    // so the render stays deterministic across dates, runs and timezones.
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 11, 12, 0, 0));
    try {
      registerGameDefinitions([]);
      await renderBare(ProgressScreen, '/progress');
      expect(screen.toJSON()).toMatchSnapshot();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Profile — db-unavailable fallback snapshot', async () => {
    registerGameDefinitions([]);
    // Profile consumes the settings provider (theme selection state).
    const wrapped = () => (
      <SettingsProvider>
        <ProfileScreen />
      </SettingsProvider>
    );
    await renderBare(wrapped, '/profile');
    expect(screen.toJSON()).toMatchSnapshot();
  });

  it('(tabs) shell — integrated NativeTabs navigation tree snapshot', async () => {
    // The REAL integrated navigation surface, made snapshot-stable by the
    // router-tree normalizer (strips only the per-render random route-key
    // suffixes). Pins: all four triggers mount inside the native tab host,
    // their labels/icons/testIDs match TAB_DEFINITIONS, the initial tab is
    // wired as selected, and each tab's screen content renders its expected
    // first-run/db-unavailable fallback INSIDE the shell.
    registerGameDefinitions([]);
    await scopeDbUnavailableNoise(async () => {
      await renderRouter(
        {
          '(tabs)/_layout': () => <AppTabs />,
          '(tabs)/index': () => <HomeScreen />,
          '(tabs)/games': () => <GamesScreen />,
          '(tabs)/progress': () => <ProgressScreen />,
          '(tabs)/profile': () => (
            <SettingsProvider>
              <ProfileScreen />
            </SettingsProvider>
          ),
        },
        { initialUrl: '/' },
      );
    });
    expect(normalizeRouterTree(screen.toJSON())).toMatchSnapshot();
  });
});
