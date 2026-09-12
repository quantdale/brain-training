/**
 * Native tab bar (Android/iOS) built on expo-router NativeTabs.
 *
 * Rendered from `TAB_DEFINITIONS` (src/constants/tabs.ts) so testIDs, labels
 * and icons stay in sync with the web tab bar. Icons: SF Symbols on iOS,
 * Material symbols on Android (both rendered by the native tab host).
 */

import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { TAB_DEFINITIONS } from '@/constants/tabs';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const colors = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      // Campaign 026: the active destination is a filled lozenge (accent fill,
      // on-accent label/icon) instead of a tint-only state.
      indicatorColor={colors.accent}
      iconColor={colors.textSecondary}
      // Every destination keeps its label: an icon-only inactive tab makes the
      // bar unreadable at a glance (campaign-024 baseline screenshot).
      //
      // Campaign 026 visual-QA correction: the native host renders the label
      // BELOW the indicator pill (on the bar surface), not inside it, so the
      // selected label must be surface-readable (`accent` text) while the icon
      // inside the filled pill takes `accentOn` via its own `selectedColor`.
      // Shipping `accentOn` for the label painted it white-on-surface and the
      // active destination lost its name in both themes (native screenshot).
      labelVisibilityMode="labeled"
      labelStyle={{ selected: { color: colors.accentText }, default: { color: colors.textSecondary } }}>
      {TAB_DEFINITIONS.map((tab) => (
        <NativeTabs.Trigger
          key={tab.name}
          name={tab.name}
          testID={tab.testID}
          accessibilityLabel={tab.label}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} selectedColor={colors.accentOn} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
