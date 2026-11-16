/** Independent review's committed-mutation/read-failure probe, extended with
 * safe recovery. Real root, providers, Profile/DataManagement and SQLite;
 * only device file IO and a post-commit profile read are controlled. */
import { expect, it, jest } from '@jest/globals';
import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { act } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import RootLayout from '@/app/_layout';
import DataManagementScreen from '@/app/data-management';
import ProfileScreen from '@/app/(tabs)/profile';
import { useSettings, type SettingsContextValue } from '@/components/settings/settings-provider';
import { enqueuePreferenceWrite, preferenceChangesBlocked } from '@/components/settings/profile-preferences';
import { liveAudioHaptics } from '@/sdk/audio-haptics';
import { getDb, resetDatabaseForTests } from '@/db';
import { applyImport, exportLocalDataBundle, wipeLocalData } from '@/data-portability';
import { rootLayoutRoutes } from '@/test-utils';

let mockFailHydration = false;
let mockArmAfterReseed = false;
jest.mock('@/data-portability', () => {
  const actual = jest.requireActual<typeof import('@/data-portability')>('@/data-portability');
  return { ...actual,
    applyImport: jest.fn(async (...args: Parameters<typeof actual.applyImport>) => {
      const result = await actual.applyImport(...args);
      if (args[2] === 'merge') mockFailHydration = true;
      else mockArmAfterReseed = true;
      return result;
    }),
    wipeLocalData: jest.fn(async (...args: Parameters<typeof actual.wipeLocalData>) => {
      await actual.wipeLocalData(...args);
      mockArmAfterReseed = true;
    }),
  };
});
jest.mock('@/progression', () => {
  const actual = jest.requireActual<typeof import('@/progression')>('@/progression');
  return { ...actual, refreshProgression: async (...args: Parameters<typeof actual.refreshProgression>) => {
    const result = await actual.refreshProgression(...args);
    if (mockArmAfterReseed) { mockArmAfterReseed = false; mockFailHydration = true; }
    return result;
  } };
});
jest.mock('@/data-portability/file-transport', () => ({
  createFileBackupTransport: () => ({ listBackups: async () => [], listStrandedArtifacts: async () => [] }),
}));
let current: SettingsContextValue;
function Route() {
  const value = useSettings();
  const [showProfile, setShowProfile] = useState(false);
  useEffect(() => { current = value; }, [value]);
  return <><Pressable testID="switch-screen" onPress={() => setShowProfile(!showProfile)} />
    {showProfile ? <ProfileScreen /> : <DataManagementScreen />}</>;
}

it.each(['merge', 'replace', 'wipe'] as const)('keeps %s committed, blocks stale writes, and retries hydration without repeating mutation', async (operation) => {
  await resetDatabaseForTests();
  mockFailHydration = false;
  mockArmAfterReseed = false;
  jest.mocked(applyImport).mockClear();
  jest.mocked(wipeLocalData).mockClear();
  await renderRouter({ _layout: RootLayout, ...rootLayoutRoutes({ 'data-management': Route }) }, { initialUrl: '/data-management' });
  // Router starts with fake timers. Keep one clock through render, actions
  // and cleanup: switching mid-tree stalls React's async act on Node 22.
  await screen.findByTestId('data-import-input');
  const profile = getDb().profile;
  await profile.update({ settings: { sfx: false, haptics: false, theme: 'dark' } });
  const { text } = await exportLocalDataBundle(getDb());
  if (operation === 'wipe') {
    await act(async () => { current.setSetting('sfx', false); current.setSetting('haptics', false); current.setThemeId('dark'); });
  } else {
    expect(current.settings).toEqual({ sfx: true, haptics: true });
  }
  const originalGet = profile.get.bind(profile);
  let pendingReadGate: Promise<void> | undefined;
  let releaseRead: (() => void) | undefined;
  const readSpy = jest.spyOn(profile, 'get').mockImplementation(async (...args) => {
    if (mockFailHydration) { mockFailHydration = false; throw new Error('adversarial hydration read failure'); }
    const gate = pendingReadGate;
    pendingReadGate = undefined;
    if (gate) await gate;
    return originalGet(...args);
  });
  const updateSpy = jest.spyOn(profile, 'update');
  try {
    if (operation === 'wipe') {
      await fireEvent.changeText(screen.getByTestId('data-wipe-confirm'), 'DELETE');
      await fireEvent.press(screen.getByTestId('data-wipe-button'));
      await fireEvent.press(screen.getByTestId('data-wipe-button'));
    } else {
      await fireEvent.changeText(screen.getByTestId('data-import-input'), text);
      await fireEvent.press(screen.getByTestId('data-preview-' + operation));
      await screen.findByTestId('data-preview-output');
      await fireEvent.press(screen.getByTestId('data-import-' + operation));
      if (operation === 'replace') await fireEvent.press(screen.getByTestId('data-import-replace'));
    }
    const success = operation === 'wipe' ? /All local training data wiped/ : operation === 'merge' ? /Merge complete/ : /Replace complete/;
    // A hydration error cannot turn a committed mutation into "Import failed".
    await screen.findByText(success);
    expect(screen.queryByText(/Import failed:|Wipe failed:/)).toBeNull();
    await screen.findByTestId('data-preferences-retry');
    expect(preferenceChangesBlocked()).toBe(true);
    const stale = { ...current.settings, theme: current.themeId };
    updateSpy.mockClear();
    await act(async () => { current.setSetting('sfx', false); current.setThemeId('light'); });
    expect({ ...current.settings, theme: current.themeId }).toEqual(stale);
    expect(updateSpy).not.toHaveBeenCalled();
    if (operation !== 'wipe') expect((await profile.get())?.settings).toMatchObject({ sfx: false, haptics: false, theme: 'dark' });

    // Failed retry stays blocked; only another canonical read is attempted.
    mockFailHydration = true;
    await fireEvent.press(screen.getByTestId('data-preferences-retry'));
    await screen.findByTestId('data-preferences-retry');
    expect(preferenceChangesBlocked()).toBe(true);
    expect(jest.mocked(applyImport)).toHaveBeenCalledTimes(operation === 'wipe' ? 0 : 1);
    expect(jest.mocked(wipeLocalData)).toHaveBeenCalledTimes(operation === 'wipe' ? 1 : 0);

    // Unmount DataManagement: recovery state and retry must survive in Profile.
    await fireEvent.press(screen.getByTestId('switch-screen'));
    await screen.findByTestId('profile-settings-theme-light');
    await fireEvent.press(screen.getByTestId('profile-settings-theme-light'));
    expect(updateSpy).not.toHaveBeenCalled();
    pendingReadGate = new Promise<void>((resolve) => { releaseRead = resolve; });
    const readsBeforeRetry = readSpy.mock.calls.length;
    await fireEvent.press(screen.getByTestId('profile-preferences-retry'));
    await fireEvent.press(screen.getByTestId('profile-preferences-retry'));
    expect(readSpy.mock.calls.length).toBe(readsBeforeRetry + 1);
    expect(preferenceChangesBlocked()).toBe(true);
    // Remount DataManagement while retry is pending: neither route owns its
    // lifetime. No import text/preview or wipe confirmation is required.
    await fireEvent.press(screen.getByTestId('switch-screen'));
    await screen.findByTestId('data-preferences-retry');
    await act(async () => { releaseRead!(); });
    await waitFor(() => expect(preferenceChangesBlocked()).toBe(false));
    expect(screen.queryByTestId('data-preferences-retry')).toBeNull();
    const wiped = operation === 'wipe';
    expect(current.settings).toEqual({ sfx: wiped, haptics: wiped });
    expect(current.themeId).toBe(wiped ? 'system' : 'dark');
    expect(liveAudioHaptics.getSettings()).toMatchObject({ sfxEnabled: wiped, hapticsEnabled: wiped });
    await act(async () => { current.setSetting('sfx', !wiped); });
    // Drain the owned writer lane, not an async predicate inside fake-clock
    // waitFor: its act scope can still be settling when the assertion resolves.
    await act(async () => { await enqueuePreferenceWrite(async () => undefined); });
    expect((await profile.get())?.settings).toMatchObject({ sfx: !wiped, haptics: wiped });
    expect(jest.mocked(applyImport)).toHaveBeenCalledTimes(wiped ? 0 : 1);
    expect(jest.mocked(wipeLocalData)).toHaveBeenCalledTimes(wiped ? 1 : 0);
  } finally { releaseRead?.(); readSpy.mockRestore(); updateSpy.mockRestore(); }
});
