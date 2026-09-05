/**
 * ScreenShell — shared scaffold for shell screens.
 *
 * Provides safe-area handling, scrolling, centered max-width content, and the
 * bottom inset needed for the floating web tab bar. On native tab routes, the
 * tab bar is excluded from the content area by the screens host, so no extra
 * inset is applied there. Pushed routes (`game/[id]`, `results`, `progress-*`,
 * `rewards`, `data-management`, …) render OUTSIDE the tab host, so their
 * content padding includes the device's real bottom inset (home-indicator /
 * gesture zone, campaign009 audit B5) instead of the fixed 24pt spacing that
 * let interactive controls sit in the gesture area on notched iPhones.
 *
 * Screens render their own headers inside the shell.
 */

import type { ReactNode } from 'react';
import { useContext } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';
import { useSegments } from 'expo-router';

import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/**
 * Bottom content padding for this shell instance.
 *
 * - Web: floating tab bar height + standard spacing (the bar overlays content).
 * - Native tab routes: standard spacing only; the tab host absorbs the device
 *   bottom inset itself.
 * - Native pushed routes: the device-reported bottom inset (≈34pt
 *   `HomeIndicatorInset` from `@/theme/tokens` on notched iPhones) floored at
 *   standard spacing. Read defensively from the
 *   insets context so a missing provider (isolated component harnesses) still
 *   yields today's 24pt behavior instead of throwing — the native
 *   `SafeAreaView` above does not require a provider either.
 */
function resolveBottomPadding(insetsBottom: number | null | undefined, isTabRoute: boolean): number {
  if (Platform.OS === 'web') {
    return BottomTabInset + Spacing.four;
  }
  if (isTabRoute) {
    return Spacing.four;
  }
  return Math.max(insetsBottom ?? 0, Spacing.four);
}

export function ScreenShell({ children }: { children: ReactNode }) {
  const insets = useContext(SafeAreaInsetsContext);
  // Tab routes live in the `(tabs)` group; every other segment is a pushed
  // stack route. Falls back to `[]` outside a router (treated as pushed).
  // Cast: typed routes narrow the segment union, but grouping segments are
  // erased from it at this call site.
  const isTabRoute = (useSegments() as readonly string[]).includes('(tabs)');
  const bottomPadding = resolveBottomPadding(insets?.bottom, isTabRoute);

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
    // ScrollView content containers size to intrinsic height by default, so
    // this row never reached viewport height; children that rely on flex
    // growth (GameHost flex:1, tutorial cards clamped by maxHeight %)
    // collapsed to content height, pushing first-run tutorial buttons past
    // the card bottom with zero rendered height (release-APK device defect).
    // flexGrow: 1 is the documented RN "fill viewport, scroll when taller"
    // contentContainer pattern (flex: 1 would break scroll measurement).
    flexGrow: 1,
  },
  inner: {
    flexGrow: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
});
