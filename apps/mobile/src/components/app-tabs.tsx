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
      backgroundColor={colors.background}
      indicatorColor={colors.accent}
      iconColor={colors.textSecondary}
      labelStyle={{ selected: { color: colors.accent } }}>
      {TAB_DEFINITIONS.map((tab) => (
        <NativeTabs.Trigger
          key={tab.name}
          name={tab.name}
          testID={tab.testID}
          accessibilityLabel={tab.label}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
