/**
 * `ScreenHeader` — title block above screen content.
 *
 * One layout for every screen: an optional eyebrow kicker, the title with an
 * optional trailing-actions slot, and an optional subtitle. The back control
 * renders only when `onBack` is supplied and always meets the touch-target
 * floor with an explicit accessible name.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing, type TypographyName } from '@/theme/tokens';
import { ICON_BUTTON_SIZE, RADIUS_CAP } from './radius';
import { Tappable } from './tappable';

/** Props accepted by {@link ScreenHeader}. */
export interface ScreenHeaderProps {
  title: string;
  /** Kicker above the title. */
  eyebrow?: string;
  /** Supporting line below the title. */
  subtitle?: string;
  /** When supplied, renders the back control. */
  onBack?: () => void;
  /** Accessible name for the back control. */
  backLabel?: string;
  /** Trailing slot for header actions (icons, menus). */
  actions?: ReactNode;
  testID?: string;
  /** Typography slot for the title. */
  titleType?: TypographyName;
}

export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  onBack,
  backLabel = 'Back',
  actions,
  testID,
  titleType = 'title',
}: ScreenHeaderProps) {
  return (
    <View testID={testID} style={styles.header}>
      {eyebrow ? (
        <ThemedText type="eyebrow" themeColor="textSecondary" testID={testID ? `${testID}-eyebrow` : undefined}>
          {eyebrow}
        </ThemedText>
      ) : null}
      <View style={styles.titleRow}>
        {onBack ? (
          <Tappable
            testID={testID ? `${testID}-back` : 'screen-header-back'}
            onPress={onBack}
            accessibilityLabel={backLabel}
            accessibilityRole="button"
            renderedSize={ICON_BUTTON_SIZE}
            minTarget={MinTouchTarget}
            style={styles.back}>
            <ThemedText type="headline" aria-hidden>
              {'‹'}
            </ThemedText>
          </Tappable>
        ) : null}
        <View style={styles.titles}>
          <ThemedText type={titleType} testID={testID ? `${testID}-title` : undefined}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText
              type="bodySmall"
              themeColor="textSecondary"
              testID={testID ? `${testID}-subtitle` : undefined}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  back: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    borderRadius: RADIUS_CAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
    flexShrink: 1,
    gap: Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
