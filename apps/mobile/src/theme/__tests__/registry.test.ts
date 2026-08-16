/**
 * Theme registry tests (campaign 003 convergence): option lookup and
 * system/light/dark resolution rules.
 */
import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_THEME_ID,
  THEME_OPTIONS,
  getThemeOption,
  resolveThemeMode,
} from '@/theme/registry';

describe('theme registry', () => {
  it('offers system, light and dark options with system as the default', () => {
    expect(THEME_OPTIONS.map((option) => option.id)).toEqual(['system', 'light', 'dark']);
    expect(DEFAULT_THEME_ID).toBe('system');
  });

  it('getThemeOption falls back to the first option for unknown ids', () => {
    expect(getThemeOption('dark').id).toBe('dark');
    expect(getThemeOption('neon').id).toBe('system');
    expect(getThemeOption(undefined).id).toBe('system');
  });

  it('resolves modes: explicit overrides, system follows the OS scheme', () => {
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
    expect(resolveThemeMode('system', 'dark')).toBe('dark');
    expect(resolveThemeMode('system', 'light')).toBe('light');
    // Unknown scheme → light.
    expect(resolveThemeMode('system', undefined)).toBe('light');
    expect(resolveThemeMode(undefined, 'dark')).toBe('dark');
    // Unknown id → system behavior.
    expect(resolveThemeMode('neon', 'dark')).toBe('dark');
  });
});
