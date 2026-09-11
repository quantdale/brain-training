/**
 * CuePanel — the recall-phase view: the current stimulus cue plus the round's
 * response palette.
 *
 * Accessibility: the cue names the stimulus identity; every response option is
 * labeled with its own letter identity while the cue is live. Verdicts are
 * only ever applied from the reducer's authoritative per-cue outcome (the
 * screen replays the just-answered cue through `CueFeedback`), so the answer
 * cannot be read off the accessibility tree before the player answers.
 *
 * Verdict vocabulary (campaign 025): a verdict option changes its fill
 * (`successSoft` / `dangerSoft`), its boundary (`success` / `danger`, thicker
 * at verdict) and adds a ✓/✕ badge marked decorative for screen readers; the
 * option's accessible name carries the outcome in words ("Correct: letter B" /
 * "Wrong pick: letter D"). Never colour alone.
 *
 * Options are memoized with stable handlers so re-renders between cues skip
 * unchanged buttons.
 */
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { testId } from "@/sdk";
import { MinTouchTarget, Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { responseById, stimulusById } from "../pairs";
import { GAME_ID } from "../types";
import type { PairRecallRound } from "../types";

/** Reducer-authoritative outcome of the cue currently being replayed. */
export interface CueVerdict {
  /** The response the player actually picked. */
  readonly responseId: number;
  /** The cue's true partner response id. */
  readonly correctResponseId: number;
  /** True when the pick was the true partner. */
  readonly correct: boolean;
}

/** Per-option verdict applied to the palette (null = untouched/neutral). */
export type OptionVerdict = "correct" | "wrong" | null;

export interface CuePanelProps {
  /** The round being recalled (cue order + palette come from it). */
  round: PairRecallRound;
  /** Index into the round's `cueOrder` for the cue rendered. */
  cueIndex: number;
  disabled?: boolean;
  /** Stable tap handler supplied by the screen (avoids per-render closures). */
  onRespond?: (responseId: number) => void;
  /**
   * Authoritative verdict to render on the palette. Absent for the live cue;
   * present only when replaying the just-answered cue.
   */
  verdict?: CueVerdict | null;
  /** testID leaf for the cue card; defaults to the live "cue". */
  cueTestIDKey?: string;
  /** testID leaf for the palette container; defaults to the live "palette". */
  paletteTestIDKey?: string;
  /** testID leaf for the palette options; defaults to the live "response". */
  optionTestIDKey?: string;
}

const ResponseOption = memo(function ResponseOption({
  responseId,
  disabled,
  onRespond,
  verdict,
  testIDKey,
}: {
  responseId: number;
  disabled: boolean;
  onRespond?: (responseId: number) => void;
  verdict: OptionVerdict;
  testIDKey: string;
}) {
  const theme = useTheme();
  const response = responseById(responseId);
  const backgroundColor =
    verdict === "correct"
      ? theme.successSoft
      : verdict === "wrong"
        ? theme.dangerSoft
        : theme.surface;
  const borderColor =
    verdict === "correct"
      ? theme.success
      : verdict === "wrong"
        ? theme.danger
        : theme.border;
  const borderWidth = verdict !== null ? 3 : 1.5;
  const verdictGlyph =
    verdict === "correct" ? "✓" : verdict === "wrong" ? "✕" : null;
  const verdictFill =
    verdict === "correct"
      ? theme.success
      : verdict === "wrong"
        ? theme.danger
        : null;
  const verdictOn =
    verdict === "correct"
      ? theme.successOn
      : verdict === "wrong"
        ? theme.dangerOn
        : null;
  const accessibilityLabel =
    verdict === "correct"
      ? `Correct: ${response.label}`
      : verdict === "wrong"
        ? `Wrong pick: ${response.label}`
        : response.label;

  return (
    <Pressable
      testID={testId(GAME_ID, testIDKey, String(responseId))}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onRespond ? () => onRespond(responseId) : undefined}
      style={({ pressed }) => [
        styles.option,
        { backgroundColor, borderColor, borderWidth },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.letter, { color: theme.text }]} allowFontScaling={false}>
        {response.glyph}
      </Text>
      {verdictGlyph !== null && verdictFill !== null && verdictOn !== null ? (
        <View
          testID={testId(GAME_ID, `${testIDKey}-verdict`, String(responseId))}
          style={[styles.verdict, { backgroundColor: verdictFill }]}
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            style={[styles.verdictGlyph, { color: verdictOn }]}
            allowFontScaling={false}
          >
            {verdictGlyph}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

/** Map the cue-level authoritative outcome onto one palette option. */
function optionVerdictFor(
  verdict: CueVerdict | null | undefined,
  responseId: number,
): OptionVerdict {
  if (verdict === null || verdict === undefined) {
    return null;
  }
  if (responseId === verdict.responseId) {
    return verdict.correct ? "correct" : "wrong";
  }
  // The true partner is revealed alongside a wrong pick so the mapping, not
  // only the error, is learned from the verdict frame.
  return !verdict.correct && responseId === verdict.correctResponseId
    ? "correct"
    : null;
}

export function CuePanel({
  round,
  cueIndex,
  disabled = false,
  onRespond,
  verdict = null,
  cueTestIDKey = "cue",
  paletteTestIDKey = "palette",
  optionTestIDKey = "response",
}: CuePanelProps) {
  const theme = useTheme();
  const pairIndex = round.cueOrder[cueIndex];
  const pair = round.pairs[pairIndex];
  const stimulus = stimulusById(pair.stimulusId);

  return (
    <View style={styles.panel}>
      <View
        style={styles.cueCard}
        testID={testId(GAME_ID, cueTestIDKey)}
        accessibilityLabel={`Which partner goes with ${stimulus.label}?`}
      >
        <Text
          style={[styles.stimulus, { color: stimulus.color }]}
          allowFontScaling={false}
        >
          {stimulus.glyph}
        </Text>
        <Text style={[styles.cueQuestion, { color: theme.textSecondary }]}>→ ?</Text>
      </View>
      <View style={styles.palette} testID={testId(GAME_ID, paletteTestIDKey)}>
        {round.responseOptions.map((responseId) => (
          <ResponseOption
            key={responseId}
            responseId={responseId}
            disabled={disabled}
            onRespond={onRespond}
            verdict={optionVerdictFor(verdict, responseId)}
            testIDKey={optionTestIDKey}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.three,
    alignItems: "center",
  },
  cueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderRadius: Radii.large,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  stimulus: {
    fontSize: 44,
    fontWeight: "700",
  },
  cueQuestion: {
    fontSize: 28,
  },
  palette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    justifyContent: "center",
  },
  option: {
    minWidth: 56,
    // Explicit touch-target floor; the palette wraps well above it on every
    // tier, and real size (not hitSlop) is used so adjacent options never
    // overlap.
    minHeight: MinTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.medium,
    borderWidth: 1.5,
    paddingVertical: Spacing.oneHalf,
    paddingHorizontal: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
  letter: {
    fontSize: 22,
    fontWeight: "700",
  },
  // Verdict badge: opaque verdict-family fill with its `*On` glyph so the icon
  // reads on the soft option fill. The fill + glyph pair is the non-colour
  // verdict channel; the accessible name carries the words.
  verdict: {
    position: "absolute",
    top: -Spacing.one,
    right: -Spacing.one,
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  verdictGlyph: {
    fontSize: 13,
    fontWeight: "700",
  },
});
