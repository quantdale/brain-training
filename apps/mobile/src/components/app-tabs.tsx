/**
 * Four existing routes, rendered by Expo Router's bundled tab navigator.
 * Shared SVG icons keep controls recognizable across platforms; route
 * ownership, lazy screens, safe-area handling and back history stay in Router.
 */
import { Tabs } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { TAB_DEFINITIONS } from '@/constants/tabs';
import { useTheme } from '@/hooks/use-theme';
import { Fonts, Radii, Spacing, Typography } from '@/theme/tokens';

/** Fixed four-item chrome has a bounded text scale; accessible names stay full. */
export function nativeTabLabelFontSize(fontScale: number): number {
  return fontScale >= 1.5 ? 11 : Typography.caption.size;
}

export default function AppTabs() {
  const colors = useTheme();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const labelSize = nativeTabLabelFontSize(fontScale);
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentText,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          height: 64 + insets.bottom,
        },
        tabBarItemStyle: { paddingVertical: Spacing.one, minHeight: 56 },
      }}>
      {TAB_DEFINITIONS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarAccessibilityLabel: tab.label,
            tabBarButtonTestID: tab.testID,
            tabBarIcon: ({ focused }) => (
              <View
                pointerEvents="none"
                style={{
                  backgroundColor: focused ? colors.accentSoft : 'transparent',
                  borderRadius: Radii.pill,
                  paddingHorizontal: Spacing.three,
                  paddingVertical: Spacing.one,
                }}>
                <AppIcon name={tab.icon} size={22} color={focused ? colors.accentText : colors.textSecondary} />
              </View>
            ),
            tabBarLabel: ({ color }) => (
              <ThemedText
                type="caption"
                maxFontSizeMultiplier={1.35}
                style={{ color, fontSize: labelSize, fontFamily: Fonts.sans, fontWeight: '600' }}>
                {tab.label}
              </ThemedText>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
