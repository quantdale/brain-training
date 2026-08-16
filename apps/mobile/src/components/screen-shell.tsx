/**
 * ScreenShell — shared scaffold for shell screens.
 *
 * Provides safe-area handling, scrolling, centered max-width content, and the
 * bottom inset needed for the floating web tab bar. On native, the tab bar is
 * excluded from the content area by the screens host, so no extra inset is
 * applied there.
 *
 * Screens render their own headers inside the shell.
 */

import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

export function ScreenShell({ children }: { children: ReactNode }) {
  const bottomPadding = Platform.OS === 'web' ? BottomTabInset + Spacing.four : Spacing.four;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}>
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  inner: {
    flexGrow: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
});
