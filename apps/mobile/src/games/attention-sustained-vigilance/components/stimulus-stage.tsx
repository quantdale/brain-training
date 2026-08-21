/**
 * StimulusStage — the playfield for the Sustained Vigilance game.
 *
 * Renders the single-stimulus stream surface: the current digit card (blank
 * during the inter-stimulus interval), an inline verdict flash after each
 * trial resolves, and the large GO button. Purely presentational — all state
 * and timing live in the reducer; this component only projects it.
 *
 * Accessibility: the card announces the currently shown digit plus the public
 * rule (the stop digit is not secret — the *order* of the stream is the
 * challenge). While paused the parent hides the whole content subtree from
 * the accessibility tree and covers it with the opaque pause overlay.
 */
import { StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import type { TrialVerdict } from '../types';
import { GAME_ID } from '../types';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GameButton } from './button';

/** Player-facing copy + theme slot per verdict. */
const VERDICT_COPY: Readonly<
  Record<TrialVerdict, { label: string; color: 'success' | 'danger' | 'warning' | 'accent' }>
> = {
  hit: { label: 'Go!', color: 'success' },
  'correct-hold': { label: 'Held — nice', color: 'accent' },
  commission: { label: 'That was the stop number', color: 'danger' },
  omission: { label: 'Missed one', color: 'warning' },
};

export interface StimulusStageProps {
  /** Digit currently displayed; null while the slot is blank (ISI). */
  readonly digit: number | null;
  /** The session's withheld digit (public rule). */
  readonly stopDigit: number;
  /** Verdict of the current/last trial; null while unresolved. */
  readonly outcome: TrialVerdict | null;
  /** True once the player tapped GO on the current trial. */
  readonly responded: boolean;
  /** Disables the GO control (paused / outside the stream phase). */
  readonly disabled: boolean;
  /** GO press handler (the reducer validates timing). */
  readonly onGo: () => void;
}

export function StimulusStage({
  digit,
  stopDigit,
  outcome,
  responded,
  disabled,
  onGo,
}: StimulusStageProps) {
  const theme = useTheme();
  const verdictCopy = outcome !== null ? VERDICT_COPY[outcome] : null;

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}
        testID={testId(GAME_ID, 'stage')}
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          digit !== null
            ? `Number ${digit} shown. Tap GO for every number except the stop number ${stopDigit}.`
            : `Blank. Keep watching for numbers; hold GO on the stop number ${stopDigit}.`
        }>
        <ThemedText
          type="display"
          themeColor={digit !== null ? 'text' : 'textSecondary'}
          style={digit === null ? styles.blankDigit : undefined}
          testID={testId(GAME_ID, 'stimulus-digit')}>
          {digit !== null ? String(digit) : '·'}
        </ThemedText>
      </View>

      <ThemedText
        type="bodyLarge"
        themeColor={verdictCopy?.color ?? 'textSecondary'}
        testID={testId(GAME_ID, 'verdict')}>
        {verdictCopy !== null
          ? verdictCopy.label
          : responded
            ? ''
            : `Tap GO — hold on ${stopDigit}`}
      </ThemedText>

      <GameButton
        testID={testId(GAME_ID, 'go-button')}
        label="GO"
        onPress={onGo}
        disabled={disabled || outcome !== null}
        hint={`Respond to every number except the stop number ${stopDigit}.`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  card: {
    width: 160,
    height: 160,
    borderRadius: Radii.large,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankDigit: {
    opacity: 0.25,
  },
});
