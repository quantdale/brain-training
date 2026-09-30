/**
 * SymbolOptions — the answer choices for a Rule Grid round.
 *
 * Each candidate is a `GameButton` labelled with the player-facing symbol.
 * Pressing a candidate dispatches the selection (the screen maps it to an
 * `answer` action). Each button carries a stable `symbol-option.<value>` testID.
 *
 * After scoring, the screen supplies `visualFor`: the true symbol renders as
 * a `correct` verdict chip and the player's own wrong pick as a `wrong` chip,
 * so both states stay visible together (PATTERNS-PLAY 6). Verdicts are
 * multi-channel: the fill changes AND a ✓/✕ glyph is prepended, so colour is
 * never the only signal. The glyph duplicates meaning only for sighted
 * users — the accessible name carries the verdict in words. Glyphs opt out
 * of font scaling so the row keeps its geometry. `dim` candidates render as
 * disabled buttons to read as locked. On-slots, never a literal: dark-mode
 * fills carry dark glyphs. No animation here, so there is nothing for
 * reduced motion to collapse.
 */
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { GameButton } from '@/components/game-ui';

import { GAME_ID } from '../types';
import { MIN_TOUCH_TARGET } from '@/components/a11y';

export type SymbolOptionVisual = 'idle' | 'correct' | 'wrong' | 'dim';

export interface SymbolOptionsProps {
  readonly options: readonly number[];
  readonly onSelect: (value: number) => void;
  /** Map a symbol value (0-based) to the player-facing label. */
  readonly renderSymbol: (value: number) => string;
  readonly disabled?: boolean;
  /**
   * Verdict resolver for the scored round (derived from the reducer's
   * resolved outcome). Omit while the round is live — every candidate then
   * renders as an idle `GameButton`.
   */
  readonly visualFor?: (value: number) => SymbolOptionVisual;
}

const VerdictChip = memo(function VerdictChip({
  label,
  visual,
  testID,
}: {
  label: string;
  visual: 'correct' | 'wrong';
  testID: string;
}) {
  const theme = useTheme();
  const backgroundColor = visual === 'correct' ? theme.success : theme.danger;
  const foregroundColor = visual === 'correct' ? theme.successOn : theme.dangerOn;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={visual === 'correct' ? `Correct: ${label}` : `Wrong pick: ${label}`}
      accessibilityState={{ disabled: true, selected: true }}
      disabled
      style={[styles.chip, { backgroundColor, borderColor: theme.border }]}>
      <ThemedText type="bodyLarge" style={{ color: foregroundColor }} allowFontScaling={false}>
        {visual === 'correct' ? '✓' : '✕'}
      </ThemedText>
      <ThemedText type="bodyLarge" style={{ color: foregroundColor }}>
        {label}
      </ThemedText>
    </Pressable>
  );
});

export function SymbolOptions({ options, onSelect, renderSymbol, disabled, visualFor }: SymbolOptionsProps) {
  return (
    <View style={styles.row} testID={testId(GAME_ID, 'symbol-options')}>
      {options.map((value) => {
        const visual = visualFor?.(value) ?? 'idle';
        if (visual === 'correct' || visual === 'wrong') {
          return (
            <VerdictChip
              key={value}
              label={renderSymbol(value)}
              visual={visual}
              testID={testId(GAME_ID, 'symbol-option', String(value))}
            />
          );
        }
        return (
          <GameButton
            key={value}
            testID={testId(GAME_ID, 'symbol-option', String(value))}
            label={renderSymbol(value)}
            onPress={() => onSelect(value)}
            disabled={disabled || visual === 'dim'}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: 1.5,
  },
});
