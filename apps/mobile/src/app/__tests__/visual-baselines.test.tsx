/**
 * Visual-baseline canary snapshots (campaign 003, item 8 — light, not a full
 * hardening campaign).
 *
 * The canary set pins the SHELL screens' stable first-run/empty states:
 * Home (no games registered → workout empty state), Games (empty state),
 * Progress (db-unavailable fallback) and Profile (db-unavailable fallback).
 *
 * Each screen is rendered as a BARE route (no `(tabs)` layout): the native
 * tab host stamps a per-render random `screenId` into the tree, which would
 * make router-tree snapshots non-deterministic. The bare-tree renders are
 * deterministic across dates and runs by construction — with the db
 * unavailable every screen renders its static fallback, and the empty game
 * registry keeps the date-seeded workout out of the snapshot.
 *
 * Game-level visual determinism is covered separately by each game's seeded
 * generator/screen tests (fixed seeds → fixed boards), so no game screen is
 * snapshot here. A full pixel/seed baseline suite belongs to a hardening
 * campaign, not Phase 3.
 */
import { describe, expect, it } from '@jest/globals';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { ComponentType } from 'react';

import HomeScreen from '@/app/(tabs)/index';
import GamesScreen from '@/app/(tabs)/games';
import ProfileScreen from '@/app/(tabs)/profile';
import ProgressScreen from '@/app/(tabs)/progress';
import { SettingsProvider } from '@/components/settings/settings-provider';
import { registerGameDefinitions } from '@/registry/registry';

/** Render one screen as a bare route so no tab host enters the tree. */
function renderBare(Screen: ComponentType, initialUrl: string) {
  return renderRouter({ index: Screen }, { initialUrl });
}

describe('visual baselines (canary set)', () => {
  it('Home — first-run dashboard snapshot', async () => {
    registerGameDefinitions([]);
    await renderBare(HomeScreen, '/');
    expect(screen.toJSON()).toMatchSnapshot();
  });

  it('Games — empty catalog snapshot', async () => {
    registerGameDefinitions([]);
    await renderBare(GamesScreen, '/games');
    expect(screen.toJSON()).toMatchSnapshot();
  });

  it('Progress — db-unavailable fallback snapshot', async () => {
    registerGameDefinitions([]);
    await renderBare(ProgressScreen, '/progress');
    expect(screen.toJSON()).toMatchSnapshot();
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
});
