/**
 * StimulusStage — the playfield for the Sustained Vigilance game.
 *
 * Renders the single-stimulus stream surface: the current digit card (blank
 * during the inter-stimulus interval), an inline verdict flash after each
 * trial resolves, and the large GO button. Purely presentational — all state
 * and timing live in the reducer; this component only projects it.
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): the card takes the verdict
 * family's soft fill AND a 3 dp verdict border AND a ✓/✕/⏱ badge, so a miss
 * never reads as a hit. The badge is decorative for screen readers — the
 * card's accessibility label carries the verdict in words. Geometry never
 * changes (fixed 160 dp card, corner badge, always-mounted verdict line), so
 * the 250 ms ticker cannot cause layout churn when a verdict lands, and the
 * digit stays visible exactly as before (the parent owns `digit`).
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

/** Player-facing copy + verdict family per trial verdict. */
const VERDICT_COPY: Readonly<
  Record<
    TrialVerdict,
    { label: string; glyph: string; kind: 'success' | 'danger' | 'warning'; spoken: string }
  >
> = {
  hit: { label: 'Go!', glyph: '✓', kind: 'success', spoken: 'Correct, tapped in time.' },
  'correct-hold': {
    label: 'Held — nice',
    glyph: '✓',
    kind: 'success',
    spoken: 'Correct, held on the stop number.',
  },
  commission: {
    label: 'That was the stop number',
    glyph: '✕',
    kind: 'danger',
    spoken: 'Wrong pick, that was the stop number.',
  },
  omission: { label: 'Missed one', glyph: '⏱', kind: 'warning', spoken: 'Missed, no tap in time.' },
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
  const verdict = outcome !== null ? VERDICT_COPY[outcome] : null;
  // The verdict is derived from the reducer's resolved outcome only — never
  // from the tap — so a post-deadline input cannot present success while the
  // trial scores a miss.
  const cardFill = verdict === null ? theme.surface : theme[`${verdict.kind}Soft`];
  const cardEdge = verdict === null ? theme.border : theme[verdict.kind];

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.card,
          {
            borderColor: cardEdge,
            borderWidth: verdict === null ? 1 : 3,
            backgroundColor: cardFill,
          },
        ]}
        testID={testId(GAME_ID, 'stage')}
        accessible
        accessibilityRole="text"
        accessibilityLabel={
          verdict !== null
            ? `${verdict.spoken} ${digit !== null ? `Number ${digit} shown.` : 'Blank.'} Stop number ${stopDigit}.`
            : digit !== null
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
        {verdict !== null ? (
          <View
            style={[styles.verdictBadge, { backgroundColor: theme[verdict.kind] }]}
            testID={testId(GAME_ID, 'stage-verdict')}
            importantForAccessibility="no-hide-descendants">
            <ThemedText
              type="label"
              style={{ color: theme[`${verdict.kind}On`] }}
              allowFontScaling={false}>
              {verdict.glyph}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <ThemedText
        type="bodyLarge"
        themeColor={verdict?.kind ?? 'textSecondary'}
        testID={testId(GAME_ID, 'verdict')}>
        {verdict !== null ? verdict.label : responded ? '' : `Tap GO — hold on ${stopDigit}`}
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
  // Verdict badge: content-sized disc pinned to the card corner. Absolute so
  // showing/clearing it never moves the digit or the surrounding layout.
  verdictBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
