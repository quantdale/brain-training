// Jest globals imported explicitly (repo has no @types/jest).
import TestRenderer, { act } from 'react-test-renderer';
import { useEffect } from 'react';
import { describe, expect, it, jest } from '@jest/globals';

import { SettingsProvider, useSettings, type Settings, type SettingsContextValue } from '../settings-provider';

// Probe that captures the live context value into a sink ref for assertions.
function Probe({ sinkRef }: { sinkRef: { current: SettingsContextValue | null } }) {
  const ctx = useSettings();
  useEffect(() => {
    sinkRef.current = ctx;
  });
  return null;
}

describe('SettingsProvider persistence', () => {
  it('seeds initialSettings and persists merged changes via onSettingsChange', () => {
    const sinkRef = { current: null as SettingsContextValue | null };
    const onChange = jest.fn<(settings: Settings) => void>();
    act(() => {
      TestRenderer.create(
        <SettingsProvider initialSettings={{ sfx: false }} onSettingsChange={onChange}>
          <Probe sinkRef={sinkRef} />
        </SettingsProvider>,
      );
    });

    expect(sinkRef.current).not.toBeNull();
    expect(sinkRef.current!.settings.sfx).toBe(false);
    expect(sinkRef.current!.settings.haptics).toBe(true); // untouched default preserved

    act(() => sinkRef.current!.setSetting('sfx', true));

    expect(sinkRef.current!.settings.sfx).toBe(true);
    expect(onChange).toHaveBeenCalledWith({ sfx: true, haptics: true });
  });

  it('persists haptics toggle independently', () => {
    const sinkRef = { current: null as SettingsContextValue | null };
    const onChange = jest.fn<(settings: Settings) => void>();
    act(() => {
      TestRenderer.create(
        <SettingsProvider onSettingsChange={onChange}>
          <Probe sinkRef={sinkRef} />
        </SettingsProvider>,
      );
    });

    act(() => sinkRef.current!.setSetting('haptics', false));

    expect(sinkRef.current!.settings.haptics).toBe(false);
    expect(onChange).toHaveBeenCalledWith({ sfx: true, haptics: false });
  });
});
