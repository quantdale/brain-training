/** Resolve the installed app's actual palette from runtime inputs, never pixels
 * or the requested capture mode. The evidence must bind to the installed APK.
 * Cold-start capture rehydrates this persisted setting before route acceptance.
 */
export function resolvedThemeWitness(witness, installedApkSha256, activityConfig) {
  if (!witness || witness.apkSha256 !== installedApkSha256 || !/^[a-f0-9]{64}$/.test(witness.settingsSnapshotSha256 ?? '')) {
    return { observedTheme: 'UNKNOWN', reason: 'missing or differently bound persisted-setting witness' };
  }
  const match = /mCurrentConfig=\{([^}]+)/.exec(activityConfig ?? '');
  if (!match) return { observedTheme: 'UNKNOWN', reason: 'missing current application Activity configuration' };
  const systemTheme = /\bnight\b/.test(match[1]) ? 'dark' : 'light';
  const id = witness.persistedThemeId;
  if (!['system', 'light', 'dark'].includes(id)) {
    return { observedTheme: 'UNKNOWN', reason: 'unrecognized persisted preference' };
  }
  return {
    observedTheme: id === 'system' ? systemTheme : id,
    reason: 'installed useTheme resolution contract, persisted SQLite preference, and live Activity configuration',
    persistedThemeId: id,
    systemTheme,
    settingsSnapshotSha256: witness.settingsSnapshotSha256,
    activityConfig: match[0],
  };
}
