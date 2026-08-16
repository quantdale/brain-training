/**
 * Profile / More — placeholder identity + global settings toggles.
 *
 * Settings (SFX / music / haptics) are stored in-memory via the settings
 * provider (`src/components/settings/settings-provider.tsx`) per packet 001-a;
 * persistence wiring lands with the profile settings JSON from the
 * persistence packet (001-b).
 */

import { StyleSheet, Switch, View } from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { useSettings, type SettingKey } from '@/components/settings/settings-provider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radii, Spacing } from '@/constants/theme';

const SETTING_ROWS: { key: SettingKey; label: string; caption: string }[] = [
  { key: 'sfx', label: 'Sound effects', caption: 'Gameplay and UI sounds' },
  { key: 'music', label: 'Music', caption: 'Background music' },
  { key: 'haptics', label: 'Haptics', caption: 'Vibration feedback' },
];

export default function ProfileScreen() {
  const { settings, setSetting } = useSettings();

  return (
    <ScreenShell>
      <ThemedText type="title" testID="profile-title">
        Profile
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Identity, achievements and settings.
      </ThemedText>

      <ThemedView type="surface" style={styles.card} testID="profile-identity">
        <ThemedView type="accentSoft" style={styles.avatar}>
          <ThemedText type="headline" themeColor="accent">
            P
          </ThemedText>
        </ThemedView>
        <View style={styles.identityText}>
          <ThemedText type="bodyLarge">Local player</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Profile name and avatar customization arrive in a later wave.
          </ThemedText>
        </View>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="settings-card">
        <ThemedText type="subtitle">Settings</ThemedText>
        {SETTING_ROWS.map((row) => (
          <View key={row.key} style={styles.settingRow}>
            <View style={styles.settingText}>
              <ThemedText type="smallBold">{row.label}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">
                {row.caption}
              </ThemedText>
            </View>
            <Switch
              testID={`settings-${row.key}`}
              value={settings[row.key]}
              onValueChange={(value) => setSetting(row.key, value)}
              accessibilityLabel={`${row.label} toggle`}
            />
          </View>
        ))}
      </ThemedView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: {
    flex: 1,
    gap: Spacing.half,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  settingText: {
    flex: 1,
    gap: Spacing.half,
  },
});
