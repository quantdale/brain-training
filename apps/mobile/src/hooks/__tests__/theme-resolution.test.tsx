/**
 * Settings-driven theme resolution (frontier audit `settings-driven-color-theme`).
 *
 * `useTheme` must return the palette for the persisted player theme resolved
 * against the OS scheme (`resolveThemeMode(themeId, osScheme)`) — not the raw
 * OS scheme alone. These tests pin the full themeId × OS matrix and the live
 * recolor contract when the picker changes the id in-session.
 */
import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  SettingsProvider,
  useSettings,
} from '@/components/settings/settings-provider';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(),
}));

type Scheme = string | null | undefined;

const schemeMock = useColorScheme as unknown as { mockReturnValue(v: Scheme): void };

function settingsWrapper(themeId: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <SettingsProvider initialThemeId={themeId}>{children}</SettingsProvider>;
  };
}

async function renderTheme(themeId: string, scheme: Scheme) {
  schemeMock.mockReturnValue(scheme);
  return renderHook(() => useTheme(), { wrapper: settingsWrapper(themeId) });
}

describe('useTheme follows the persisted player theme', () => {
  it('Light ignores a dark OS scheme', async () => {
    const { result } = await renderTheme('light', 'dark');
    expect(result.current).toBe(Colors.light);
  });

  it('Dark ignores a light OS scheme', async () => {
    const { result } = await renderTheme('dark', 'light');
    expect(result.current).toBe(Colors.dark);
  });

  it('System tracks the OS scheme (dark)', async () => {
    const { result } = await renderTheme('system', 'dark');
    expect(result.current).toBe(Colors.dark);
  });

  it('System tracks the OS scheme (light)', async () => {
    const { result } = await renderTheme('system', 'light');
    expect(result.current).toBe(Colors.light);
  });

  it('Light stays light when the OS scheme is unknown', async () => {
    const { result } = await renderTheme('light', null);
    expect(result.current).toBe(Colors.light);
  });

  it('Dark stays dark when the OS scheme is unknown', async () => {
    const { result } = await renderTheme('dark', undefined);
    expect(result.current).toBe(Colors.dark);
  });

  it('an unknown persisted id behaves as system', async () => {
    const { result } = await renderTheme('neon', 'dark');
    expect(result.current).toBe(Colors.dark);
  });
});

describe('theme picker recolors live', () => {
  function useThemeAndPicker() {
    const theme = useTheme();
    const { setThemeId } = useSettings();
    return { theme, setThemeId };
  }

  it('changing the id recolors consumers without a restart', async () => {
    schemeMock.mockReturnValue('dark');
    const { result } = await renderHook(() => useThemeAndPicker(), {
      wrapper: settingsWrapper('system'),
    });

    // System + dark OS → dark palette.
    expect(result.current.theme).toBe(Colors.dark);

    await act(() => {
      result.current.setThemeId('light');
    });

    // Light selection must win over the dark OS scheme immediately.
    expect(result.current.theme).toBe(Colors.light);
  });

  it('falls back to the system palette without a SettingsProvider', async () => {
    schemeMock.mockReturnValue('dark');
    const { result } = await renderHook(() => useTheme());

    expect(result.current).toBe(Colors.dark);
  });
});
