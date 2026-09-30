/**
 * VerdictCue — the shared speed-round verdict vocabulary for Quick Compare.
 *
 * The cue is the Drops speed-round model (Campaign 025), not a bottom sheet: a
 * sheet would cover the comparison the player is reviewing and would add a tap
 * to the ≤3s loop. It presents the reducer's authoritative `lastVerdict`
 * through three channels at once — a soft family fill, a base-family boundary,
 * and a filled glyph badge (✓ / ✕ / ⏱) — plus a visible text label and an
 * accessible name with a polite live region, so the outcome never reads as
 * colour alone.
 *
 * The slot is fixed-size and non-interactive: while no verdict exists it
 * renders a decorative empty outline (hidden from assistive tech), so showing
 * or clearing the cue never shifts the board or steals taps. The pop scale
 * collapses to a static badge under reduced motion.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { usePrefersReducedMotion } from '@/components/a11y/reduced-motion';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testId } from '@/sdk';
import { Motion } from '@/theme/tokens';

import { GAME_ID } from '../types';
import type { CompareVerdict } from '../types';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

export interface VerdictCueProps {
  /** Reducer verdict of the just-resolved round; null while the round is live. */
  readonly verdict: CompareVerdict | null;
}

/** Verdict copy: visible label, glyph badge, accessible name. */
const VERDICT_COPY: Record<
  CompareVerdict,
  { readonly label: string; readonly glyph: string; readonly accessibilityLabel: string }
> = {
  correct: { label: 'Correct', glyph: '✓', accessibilityLabel: 'Last pick: correct' },
  incorrect: { label: 'Wrong pick', glyph: '✕', accessibilityLabel: 'Last pick: wrong' },
  miss: { label: 'Timed out', glyph: '⏱', accessibilityLabel: 'Last pick: timed out' },
};

export function VerdictCue({ verdict }: VerdictCueProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion || verdict === null) {
      scale.setValue(1);
      return;
    }
    scale.setValue(0.6);
    const pop = Animated.timing(scale, {
      toValue: 1,
      duration: Motion.quick,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    pop.start();
    return () => {
      pop.stop();
    };
  }, [reducedMotion, scale, verdict]);

  if (verdict === null) {
    return (
      <View
        style={[styles.cue, styles.cueEmpty, { borderColor: theme.border }]}
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  const copy = VERDICT_COPY[verdict];
  const softFill =
    verdict === 'correct'
      ? theme.successSoft
      : verdict === 'miss'
        ? theme.warningSoft
        : theme.dangerSoft;
  const boundary =
    verdict === 'correct'
      ? theme.success
      : verdict === 'miss'
        ? theme.warning
        : theme.danger;
  const badgeFill =
    verdict === 'correct' ? theme.success : verdict === 'miss' ? theme.warning : theme.danger;
  const badgeOn =
    verdict === 'correct'
      ? theme.successOn
      : verdict === 'miss'
        ? theme.warningOn
        : theme.dangerOn;
  const labelColor =
    verdict === 'correct'
      ? theme.successSoftText
      : verdict === 'miss'
        ? theme.warningSoftText
        : theme.dangerSoftText;

  return (
    <View
      testID={testId(GAME_ID, 'verdict-cue')}
      style={[styles.cue, { backgroundColor: softFill, borderColor: boundary }]}
      accessible
      accessibilityLabel={copy.accessibilityLabel}
      accessibilityLiveRegion="polite">
      {/* Glyph badge is the shape channel; the accessible name carries the
      verdict so the badge itself is decorative for screen readers. */}
      <Animated.View
        style={[styles.badge, { backgroundColor: badgeFill, transform: [{ scale }] }]}
        importantForAccessibility="no-hide-descendants">
        <ThemedText type="label" style={{ color: badgeOn }} allowFontScaling={false}>
          {copy.glyph}
        </ThemedText>
      </Animated.View>
      <ThemedText type="smallBold" style={{ color: labelColor }}>
        {copy.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  cue: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minWidth: 200,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: 2,
  },
  cueEmpty: {
    borderWidth: 1.5,
  },
  badge: {
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
