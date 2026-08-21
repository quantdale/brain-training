/**
 * Sensory settings card — the single, real settings UI for sound and haptics.
 *
 * Background music is intentionally NOT exposed here: BGM is deferred
 * (constitution §20 / DEFERRED_DECISIONS.md) and a silent, non-functional music
 * toggle would misrepresent reality. The engine still supports `musicEnabled`
 * for when BGM lands.
 */
import { Switch, View } from 'react-native';

import { useSettings } from '@/components/settings/settings-provider';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { SettingKey } from '@/components/settings/settings-provider';

const ROWS: { key: SettingKey; label: string; caption: string }[] = [
  { key: 'sfx', label: 'Sound effects', caption: 'Gameplay and UI sounds' },
  { key: 'haptics', label: 'Haptics', caption: 'Vibration feedback' },
];

export function SensorySettingsCard() {
  const { settings, setSetting } = useSettings();
  return (
    <ThemedView type="surface" style={styles.card} testID="settings-card">
      <ThemedText type="subtitle">Settings</ThemedText>
      {ROWS.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.text}>
            <ThemedText type="smallBold">{row.label}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {row.caption}
            </ThemedText>
          </View>
          <Switch
            testID={`settings-${row.key}`}
            value={settings[row.key]}
            onValueChange={(value) => setSetting(row.key, value)}
            // Label carries the caption too: the switch is the only focusable
            // element in the row, so a screen reader user would otherwise never
            // hear what the toggle actually controls. State ("on/off") is
            // announced by the platform from `value`.
            accessibilityLabel={`${row.label}. ${row.caption}`}
          />
        </View>
      ))}
    </ThemedView>
  );
}

const styles = {
  card: {
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
} as const;
