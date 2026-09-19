/**
 * `CollectibleTile` — the collectible object plate (campaign 055).
 *
 * Campaign 052: "the cosmetics are small and the locked catalog feels more like
 * inventory than a desirable collection", and the emoji previews "read as
 * finished reward art". This tile keeps the exact economy semantics (same
 * cosmetic definitions, prices and unlock rules) but renders each cosmetic as a
 * code-native object derived from its own preview colour and slot, inside a
 * consistent plate. Owned, equipped and locked items share one grid so the
 * collection reads as a set the player is completing.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Tappable } from '@/components/ui/tappable';
import { HAIRLINE } from '@/components/ui/radius';
import { useTheme } from '@/hooks/use-theme';
import { Radii, Spacing, type ColorTheme, type ThemeColor } from '@/theme/tokens';
import type { CosmeticSlot } from '@/cosmetics';

/** Ownership state of a collectible. */
export type CollectibleState = 'equipped' | 'owned' | 'locked';

export interface CollectibleTileProps {
  name: string;
  slot: CosmeticSlot;
  /** Registry preview descriptor (colour and optional emoji accent). */
  preview: { emoji?: string; color?: string };
  state: CollectibleState;
  /** Supporting line: unlock condition for locked, state for owned. */
  detail?: string;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const DEFAULT_OBJECT_COLOR = '#6C5CE7';

/**
 * The object itself, one shape language per slot:
 * `avatarFrame` a keyed ring, `accent` a colour ramp, `celebration` a burst.
 */
function CollectibleObject({ slot, color }: { slot: CosmeticSlot; color: string }) {
  if (slot === 'accent') {
    return (
      <View style={styles.ramp} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[1, 0.66, 0.36].map((opacity, index) => (
          <View
            key={index}
            style={[styles.rampBar, { backgroundColor: color, opacity, width: `${86 - index * 18}%` }]}
          />
        ))}
      </View>
    );
  }
  if (slot === 'celebration') {
    return (
      <View style={styles.burst} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.burstCore, { backgroundColor: color }]} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <View
            key={angle}
            style={[styles.burstRay, { backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }]}
          />
        ))}
      </View>
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.ringOuter, { borderColor: color }]}>
      <View style={[styles.ringInner, { borderColor: color, opacity: 0.45 }]} />
    </View>
  );
}

/** One collectible plate with its identity plinth. */
export function CollectibleTile({
  name,
  slot,
  preview,
  state,
  detail,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: CollectibleTileProps) {
  const theme = useTheme();
  const color = preview.color ?? DEFAULT_OBJECT_COLOR;
  const locked = state === 'locked';
  const plateTone: ThemeColor = locked ? 'surfaceSunken' : 'surface';
  const stateLabel = state === 'equipped' ? 'Equipped' : state === 'owned' ? 'Owned' : 'Locked';

  const plate = (
    <>
      <View
        style={[
          styles.plate,
          {
            backgroundColor: theme[plateTone],
            borderColor: state === 'equipped' ? theme.accent : theme.border,
            borderWidth: state === 'equipped' ? 2 : HAIRLINE,
          },
        ]}>
        <View style={[styles.object, locked && styles.objectLocked]}>
          <CollectibleObject slot={slot} color={color} />
        </View>
        {locked ? (
          <ThemedText
            type="label"
            themeColor="textMuted"
            style={styles.lockGlyph}
            allowFontScaling={false}
            aria-hidden>
            {'🔒'}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.plinth}>
        <ThemedText type="bodySmall" numberOfLines={2} style={styles.name}>
          {name}
        </ThemedText>
        {state === 'equipped' ? (
          <Badge label="Equipped" size="sm" tone="accent" />
        ) : detail ? (
          <ThemedText type="caption" themeColor={locked ? 'textMuted' : 'textSecondary'} numberOfLines={2}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
    </>
  );

  const label =
    accessibilityLabel ??
    `${name}, ${slotLabel(slot)}, ${stateLabel}${detail ? `. ${detail}` : ''}`;

  if (onPress) {
    return (
      <Tappable
        testID={testID}
        onPress={onPress}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        feedback="tap"
        style={styles.tile}
        pressedStyle={{ opacity: 0.9 }}>
        {plate}
      </Tappable>
    );
  }

  return (
    <View testID={testID} accessibilityLabel={label} style={styles.tile}>
      {plate}
    </View>
  );
}

function slotLabel(slot: CosmeticSlot): string {
  if (slot === 'avatarFrame') return 'avatar frame';
  if (slot === 'accent') return 'accent colour';
  return 'celebration';
}

/** Plate background per theme is exported so callers can keep tones consistent. */
export function collectiblePlateColor(theme: ColorTheme, state: CollectibleState): string {
  return state === 'locked' ? theme.surfaceSunken : theme.surface;
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: Spacing.one,
  },
  plate: {
    aspectRatio: 1,
    borderRadius: Radii.small,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  object: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  objectLocked: {
    opacity: 0.4,
  },
  ringOuter: {
    width: 64,
    height: 64,
    borderRadius: Radii.medium,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 34,
    height: 34,
    borderRadius: Radii.small,
    borderWidth: 3,
  },
  ramp: {
    width: 64,
    gap: 5,
    alignItems: 'flex-start',
  },
  rampBar: {
    height: 10,
    borderRadius: 3,
  },
  burst: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burstCore: {
    width: 20,
    height: 20,
    borderRadius: Radii.small,
    zIndex: 2,
  },
  burstRay: {
    position: 'absolute',
    width: 6,
    height: 58,
    borderRadius: 3,
    opacity: 0.55,
  },
  lockGlyph: {
    position: 'absolute',
    bottom: Spacing.one,
    right: Spacing.one,
  },
  plinth: {
    gap: Spacing.half,
    alignItems: 'flex-start',
  },
  name: {
    minHeight: 36,
  },
});
