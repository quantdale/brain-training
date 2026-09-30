/**
 * VerdictCue — the shared speed-round verdict vocabulary for Reaction Time.
 *
 * The cue is the Drops speed-round model (Campaign 025), not a bottom sheet: a
 * sheet would cover the round result and add friction to a ≤3s loop. It
 * presents the reducer's authoritative `roundOutcome` through three channels at
 * once — a soft family fill, a base-family boundary, and a filled glyph badge
 * (✓ / ✕ / ⏱) — plus a visible text label and an accessible name with a polite
 * live region, so an outcome never reads as colour alone.
 *
 * The slot is fixed-size and non-interactive: while no outcome exists it
 * renders a decorative empty outline (hidden from assistive tech), so showing
 * or clearing the cue never shifts the result card or steals taps. The pop
 * scale collapses to a static badge under reduced motion.
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
import type { RoundOutcome } from '../types';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

export interface VerdictCueProps {
  /** Reducer outcome of the just-resolved round; null while a round is live. */
  readonly outcome: RoundOutcome | null;
}

type VerdictFamily = 'success' | 'danger' | 'warning';

/** Outcome copy: visible label, glyph badge, accessible name. */
const OUTCOME_COPY: Record<
  RoundOutcome,
  {
    readonly label: string;
    readonly glyph: string;
    readonly family: VerdictFamily;
    readonly accessibilityLabel: string;
  }
> = {
  passed: { label: 'Passed', glyph: '✓', family: 'success', accessibilityLabel: 'Last round: passed' },
  withheld: { label: 'Held', glyph: '✓', family: 'success', accessibilityLabel: 'Last round: held' },
  failed: { label: 'Too slow', glyph: '✕', family: 'danger', accessibilityLabel: 'Last round: too slow' },
  timeout: { label: 'Timed out', glyph: '⏱', family: 'warning', accessibilityLabel: 'Last round: timed out' },
  'false-start': {
    label: 'False start',
    glyph: '✕',
    family: 'danger',
    accessibilityLabel: 'Last round: false start',
  },
  'no-go-false-start': {
    label: 'Tapped ✕',
    glyph: '✕',
    family: 'danger',
    accessibilityLabel: 'Last round: tapped the no-go signal',
  },
};

export function VerdictCue({ outcome }: VerdictCueProps) {
  const theme = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion || outcome === null) {
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
  }, [reducedMotion, scale, outcome]);

  if (outcome === null) {
    return (
      <View
        style={[styles.cue, styles.cueEmpty, { borderColor: theme.border }]}
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  const copy = OUTCOME_COPY[outcome];
  const softFill =
    copy.family === 'success'
      ? theme.successSoft
      : copy.family === 'warning'
        ? theme.warningSoft
        : theme.dangerSoft;
  const badgeFill =
    copy.family === 'success'
      ? theme.success
      : copy.family === 'warning'
        ? theme.warning
        : theme.danger;
  const badgeOn =
    copy.family === 'success'
      ? theme.successOn
      : copy.family === 'warning'
        ? theme.warningOn
        : theme.dangerOn;
  const labelColor =
    copy.family === 'success'
      ? theme.successSoftText
      : copy.family === 'warning'
        ? theme.warningSoftText
        : theme.dangerSoftText;

  return (
    <View
      testID={testId(GAME_ID, 'verdict-cue')}
      style={[styles.cue, { backgroundColor: softFill, borderColor: badgeFill }]}
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
