/**
 * Web tab bar — floating pill bottom nav built on expo-router/ui Tabs.
 *
 * Mirrors the native tab bar: same four tabs from `TAB_DEFINITIONS`, same
 * testIDs, plus a provisional brand slot. Icons render via expo-symbols
 * (Material symbol names on web).
 */

import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { AppIcon, type AppIconName } from './ui/app-icon';

import { TAB_DEFINITIONS } from '@/constants/tabs';
import { MIN_TOUCH_TARGET } from '@/components/a11y';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TAB_DEFINITIONS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton testID={tab.testID} label={tab.label} icon={tab.icon} />
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & {
  testID: string;
  label: string;
  icon: AppIconName;
};

export function TabButton({
  children,
  testID,
  label,
  icon,
  isFocused,
  ...props
}: TabButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      {...props}
      testID={testID}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'accent' : 'background'}
        style={[styles.tabButtonView, !isFocused && styles.inactiveTab]}>
        <AppIcon
          color={isFocused ? theme.accentOn : theme.textSecondary}
          name={icon}
          size={18}
        />
        <ThemedText
          type="caption"
          themeColor={isFocused ? 'accentOn' : 'textSecondary'}
          style={styles.tabLabel}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, { borderColor: theme.borderStrong }]}>
        <ThemedText type="smallBold" style={styles.brandText}>
          Brain Training
        </ThemedText>

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: Spacing.two,
    width: '100%',
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.medium,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  // Touch-target contract: the Pressable (not just the pill) meets the 44pt
  // minimum so the full tab is reliably tappable and switch-accessible.
  tabButton: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Radii.medium,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  inactiveTab: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabLabel: {
    lineHeight: 18,
  },
});
