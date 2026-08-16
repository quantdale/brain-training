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
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { TAB_DEFINITIONS } from '@/constants/tabs';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {TAB_DEFINITIONS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton testID={tab.testID} label={tab.label} sf={tab.sf} symbol={tab.web} />
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
  sf: (typeof TAB_DEFINITIONS)[number]['sf'];
  symbol: (typeof TAB_DEFINITIONS)[number]['web'];
};

export function TabButton({
  children,
  testID,
  label,
  sf,
  symbol,
  isFocused,
  ...props
}: TabButtonProps) {
  const theme = useTheme();

  return (
    <Pressable {...props} testID={testID} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'accentSoft' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <SymbolView
          tintColor={isFocused ? theme.accent : theme.textSecondary}
          name={{ ios: sf, web: symbol }}
          size={18}
        />
        <ThemedText
          type="caption"
          themeColor={isFocused ? 'accent' : 'textSecondary'}
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
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
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
    borderRadius: Spacing.five,
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
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.twoHalf,
    borderRadius: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  tabLabel: {
    lineHeight: 18,
  },
});
