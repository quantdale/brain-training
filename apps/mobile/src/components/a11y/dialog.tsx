/**
 * A11yDialog — accessible modal dialog primitive.
 *
 * Cross-platform modal semantics in one component:
 * - `role=dialog` + `accessibilityViewIsModal` (iOS) +
 *   `importantForAccessibility="yes"` (Android) so content behind the dialog
 *   leaves the traversal order while it is open.
 * - Screen-reader cursor is parked on the card on open
 *   (`useInitialA11yFocus`) and the title is announced.
 * - Android hardware back and scrim taps route through `onRequestClose` when
 *   provided; an explicit labelled Close button ships with it (icon-only X
 *   buttons are the classic screen-reader trap).
 *
 * Deliberately self-contained (no `game-ui` imports): shared game-ui
 * primitives consume this module family's leaf files, so importing them back
 * here would create an import cycle.
 */
import { useEffect, useRef, type PropsWithChildren } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';

import { announce } from '@/components/a11y/announcements';
import { useInitialA11yFocus } from '@/components/a11y/focus';
import { MinTouchTarget } from '@/components/a11y/touch-target';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface A11yDialogProps extends PropsWithChildren {
  /** Controls mount/unmount; false renders nothing. */
  visible: boolean;
  /** Heading text; announced on open and used as the dialog label. */
  title: string;
  /**
   * Called on Android hardware back and scrim tap; when provided, a labelled
   * Close button is rendered. Omit for non-dismissable dialogs.
   */
  onRequestClose?: () => void;
  testID?: string;
  /** Set false to skip the open announcement (another region announces it). */
  announceOnShow?: boolean;
}

export function A11yDialog({
  visible,
  title,
  onRequestClose,
  testID,
  announceOnShow = true,
  children,
}: A11yDialogProps) {
  const theme = useTheme();
  const cardRef = useInitialA11yFocus<View>(visible);

  // Latest-value refs so the open announcement reads fresh copy while firing
  // exactly once per open: callers routinely pass fresh inline closures for
  // `onRequestClose` on every render, and keying the announcement on that
  // identity would re-announce the title on every parent re-render (e.g.
  // every gameplay tick) while the dialog is open.
  const announceStateRef = useRef({ title, announceOnShow });
  useEffect(() => {
    // Latest-value ref pattern: updated after every commit so the
    // [visible]-keyed announcement effect below always reads fresh props
    // without re-announcing on parent re-renders.
    announceStateRef.current = { title, announceOnShow };
  });

  useEffect(() => {
    if (!visible || !announceStateRef.current.announceOnShow) {
      return;
    }
    announce(announceStateRef.current.title);
  }, [visible]);

  useEffect(() => {
    if (!visible || !onRequestClose) {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onRequestClose();
      return true;
    });
    return () => subscription.remove();
  }, [visible, onRequestClose]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.scrim} testID={testID ? `${testID}-scrim` : undefined}>
      {/* Scrim swallows outside touches (modal); tapping it dismisses when
          the dialog is dismissable. Sits under the card in z-order. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Dismiss dialog"
        testID={testID ? `${testID}-scrim-dismiss` : undefined}
        onPress={onRequestClose}
        disabled={!onRequestClose}
      />
      <View
        ref={cardRef}
        style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        testID={testID}
        // The ARIA-style `role` prop is used here because RN 0.86's legacy
        // `accessibilityRole` union has no 'dialog' member.
        role="dialog"
        aria-label={title}
        accessibilityViewIsModal
        importantForAccessibility="yes">
        <ThemedText type="subtitle">{title}</ThemedText>
        <View style={styles.body}>{children}</View>
        {onRequestClose ? (
          <Pressable
            testID={testID ? `${testID}-close` : 'a11y-dialog-close'}
            accessibilityRole="button"
            accessibilityLabel="Close dialog"
            accessibilityState={{ disabled: false }}
            onPress={onRequestClose}
            style={[styles.close, MinTouchTarget]}>
            <ThemedText type="smallBold" themeColor="accent">
              Close
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderRadius: Radii.large,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  body: {
    gap: Spacing.three,
  },
  close: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
  },
});
