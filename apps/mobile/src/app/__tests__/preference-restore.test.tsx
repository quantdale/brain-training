/** Real root/providers, Profile controls, portability engine and DataManagement.
 * Only device file IO is replaced; the canonical SQLite store stays real. */
import { describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import RootLayout from '@/app/_layout';
import ProfileScreen from '@/app/(tabs)/profile';
import DataManagementScreen from '@/app/data-management';
import { useSettings, type SettingsContextValue } from '@/components/settings/settings-provider';
import { enqueuePreferenceWrite } from '@/components/settings/profile-preferences';
import { liveAudioHaptics } from '@/sdk/audio-haptics';
import { getDb } from '@/db';
import { exportLocalDataBundle } from '@/data-portability';
import { rootLayoutRoutes } from '@/test-utils';
import { useTheme as useNavigationTheme } from 'expo-router';
import { useTheme } from '@/hooks/use-theme';
import { Colors } from '@/constants/theme';

jest.mock('@/data-portability/file-transport', () => ({
  createFileBackupTransport: () => ({
    listBackups: async () => [], listStrandedArtifacts: async () => [],
  }),
}));

let current: SettingsContextValue;
let navigationDark = false;
let paletteBackground = '';
function RestoreRoute() {
  const preferences = useSettings();
  const navigationTheme = useNavigationTheme();
  const palette = useTheme();
  useEffect(() => { navigationDark = navigationTheme.dark; paletteBackground = palette.background; }, [navigationTheme, palette]);
  const [showData, setShowData] = useState(false);
  useEffect(() => { current = preferences; }, [preferences]);
  return <><Text testID="live-preferences">{JSON.stringify({ ...preferences.settings, theme: preferences.themeId })}</Text>
    <Pressable testID="switch-screen" onPress={() => setShowData(!showData)} />
    {showData ? <DataManagementScreen /> : <ProfileScreen />}</>;
}

async function mount() {
  await renderRouter({ _layout: RootLayout, ...rootLayoutRoutes({ 'data-management': RestoreRoute }) }, { initialUrl: '/data-management' });
  // Keep Router's fake clock through cleanup; changing timer modes after
  // mounting leaves async act/Animated work unsettled on the CI Node 22 host.
  await screen.findByTestId('profile-settings-theme-light');
}
async function preview(text: string, mode: 'merge' | 'replace') {
  await fireEvent.changeText(screen.getByTestId('data-import-input'), text);
  await fireEvent.press(screen.getByTestId('data-preview-' + mode));
  await screen.findByTestId('data-preview-output');
}
async function apply(mode: 'merge' | 'replace') {
  await fireEvent.press(screen.getByTestId('data-import-' + mode));
  if (mode === 'replace') await fireEvent.press(screen.getByTestId('data-import-replace'));
}
async function expectPreferences(sfx: boolean, haptics: boolean, theme: string) {
  await waitFor(() => expect(screen.getByTestId('live-preferences')).toHaveTextContent(JSON.stringify({ sfx, haptics, theme })));
  expect(liveAudioHaptics.getSettings()).toMatchObject({ sfxEnabled: sfx, hapticsEnabled: haptics });
  expect(navigationDark).toBe(theme === 'dark');
  expect(paletteBackground).toBe(Colors[theme === 'dark' ? 'dark' : 'light'].background);
  await fireEvent.press(screen.getByTestId('switch-screen'));
  await screen.findByTestId('settings-sfx');
  expect(screen.getByTestId('settings-sfx').props.value).toBe(sfx);
  expect(screen.getByTestId('settings-haptics').props.value).toBe(haptics);
  expect(screen.getByTestId('profile-settings-theme-' + theme).props.accessibilityState.selected).toBe(true);
  expect((await getDb().profile.get())?.settings).toMatchObject({ sfx, haptics, theme });
}

describe('authoritative preference restoration', () => {
  it.each(['replace', 'merge'] as const)('hydrates live controls, engine and refs after %s', async (mode) => {
    await mount();
    await getDb().profile.update({ settings: { sfx: false, haptics: false, theme: 'dark' } });
    const { text } = await exportLocalDataBundle(getDb());
    await act(async () => { current.setSetting('sfx', true); current.setSetting('haptics', true); });
    await fireEvent.press(screen.getByTestId('profile-settings-theme-light'));
    await fireEvent.press(screen.getByTestId('switch-screen'));
    await screen.findByTestId('data-import-input');
    await preview(text, mode);
    await apply(mode);
    await screen.findByText(new RegExp(mode === 'replace' ? 'Replace complete' : 'Merge complete'));
    await expectPreferences(false, false, 'dark');
    await fireEvent(screen.getByTestId('settings-sfx'), 'valueChange', true);
    // Wait for the writer itself before reading SQLite; async waitFor polling
    // can resolve before its fake-clock act scope has finished settling.
    await act(async () => { await enqueuePreferenceWrite(async () => undefined); });
    expect((await getDb().profile.get())?.settings).toMatchObject({ sfx: true, haptics: false, theme: 'dark' });
    expect(current.settings).toEqual({ sfx: true, haptics: false });
  });

  it('drains pending sensory AND theme writes before import; blocked controls cannot replay afterward', async () => {
    await mount();
    await getDb().profile.update({ settings: { sfx: false, haptics: false, theme: 'dark' } });
    const { text } = await exportLocalDataBundle(getDb());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const profile = getDb().profile;
    const update = profile.update.bind(profile);
    let started = false;
    const writes: string[] = [];
    const spy = jest.spyOn(profile, 'update').mockImplementation(async (input) => {
      if (input?.settings && ('sfx' in input.settings || 'theme' in input.settings)) {
        writes.push('theme' in input.settings ? 'theme' : 'sensory');
        if (!started) { started = true; await gate; }
      }
      return update(input);
    });
    try {
      await act(async () => { current.setSetting('sfx', true); current.setSetting('haptics', true); });
      await fireEvent.press(screen.getByTestId('profile-settings-theme-light'));
      expect(started).toBe(true);
      await fireEvent.press(screen.getByTestId('switch-screen'));
      await screen.findByTestId('data-import-input');
      await preview(text, 'replace');
      await apply('replace');
      expect(screen.queryByText(/Replace complete/)).toBeNull();
      // Controls arriving during the barrier must neither change live state
      // nor enqueue old intent.
      const before = { ...current.settings, theme: current.themeId };
      await act(async () => { current.setSetting('haptics', false); current.setThemeId('dark'); });
      expect({ ...current.settings, theme: current.themeId }).toEqual(before);
      await act(async () => { release(); await gate; });
      await screen.findByText(/Replace complete/);
      expect(writes).toEqual(['sensory', 'sensory', 'theme']);
      await expectPreferences(false, false, 'dark');
    } finally {
      release();
      spy.mockRestore();
    }
  });

  it('hydrates defaults after wipe and profile reseeding', async () => {
    await mount();
    await act(async () => { current.setSetting('sfx', false); current.setSetting('haptics', false); });
    await fireEvent.press(screen.getByTestId('profile-settings-theme-dark'));
    await fireEvent.press(screen.getByTestId('switch-screen'));
    await screen.findByTestId('data-wipe-confirm');
    await fireEvent.changeText(screen.getByTestId('data-wipe-confirm'), 'DELETE');
    await fireEvent.press(screen.getByTestId('data-wipe-button'));
    await fireEvent.press(screen.getByTestId('data-wipe-button'));
    await screen.findByText(/All local training data wiped/);
    await waitFor(() => expect(current.settings).toEqual({ sfx: true, haptics: true }));
    expect(current.themeId).toBe('system');
    expect(liveAudioHaptics.getSettings()).toMatchObject({ sfxEnabled: true, hapticsEnabled: true });
  });
});
