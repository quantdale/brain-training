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
import { Radii, Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { SettingKey } from '@/components/settings/settings-provider';

const ROWS: { key: SettingKey; label: string; caption: string }[] = [
  { key: 'sfx', label: 'Sound effects', caption: 'Gameplay and UI sounds' },
  { key: 'haptics', label: 'Haptics', caption: 'Vibration feedback' },
];

export function SensorySettingsCard({ title = 'Settings' }: { title?: string }) {
  const { settings, setSetting } = useSettings();
  return (
    <ThemedView type="surface" style={styles.card} testID="settings-card">
      <ThemedText type="headline">{title}</ThemedText>
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
            style={styles.toggle}
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
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  // Android's intrinsic switch is only about 46×27dp. Expand the native
  // control's frame (not its drawing scale) so focus and touch share a 48dp target.
  toggle: {
    minWidth: 48,
    minHeight: 48,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
} as const;
