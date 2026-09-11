/**
 * StreamVerdictBanner — the inline verdict for the just-resolved stream item.
 *
 * Cue Keeper resolves an item and advances to the next one in the SAME reducer
 * transition (the next item's response window opens immediately), so there is
 * no feedback phase to linger in and the GO/SIGNAL controls already belong to
 * the next item by the time a verdict exists. This banner is therefore the
 * feedback surface: it derives everything from the reducer's authoritative
 * `lastItem` outcome — never from the tap handler's optimistic guess — so an
 * input that races a timeout can never present success.
 *
 * Verdicts are multi-channel (PATTERNS-PLAY 6): the banner takes the verdict
 * family's soft fill AND a 3 dp verdict boundary AND a ✓/✕/⏱ badge, so a miss
 * never reads as a hit. The resolved prompt is restated (its glyph plus
 * whether it was a signal) so the cue the player answered stays mounted while
 * the verdict shows, and both response options are rendered in the same frame:
 * the wrong pick in the danger family beside the correct response in the
 * success family, with the untouched option neutral. The badges are decorative
 * for assistive tech — the banner's accessible label carries the verdict in
 * words ("Correct" / "Wrong pick" / "Timed out") and each option chip's name
 * states its role ("Wrong pick: GO" / "Correct: SIGNAL").
 */
import { StyleSheet, View } from "react-native";

import { testId } from "@/sdk";
import { ThemedText } from "@/components/themed-text";
import { Radii, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

import { glyphById } from "../glyphs";
import { GAME_ID } from "../types";
import type { LastItemOutcome, StreamItem } from "../types";

/** The two explicit stream responses (a timeout is the absence of one). */
type ResponseChoice = "go" | "signal";

/** How one response option participated in the resolved verdict. */
type OptionRole = "correct" | "wrong" | "neutral";

const RESPONSE_LABEL: Readonly<Record<ResponseChoice, string>> = {
  go: "GO",
  signal: "SIGNAL",
};

export interface StreamVerdictBannerProps {
  /** The reducer's resolved outcome for the last item (authoritative). */
  readonly outcome: LastItemOutcome;
  /** The resolved item, used to restate the prompt the verdict answers. */
  readonly item: StreamItem;
}

function OptionChip({ choice, role }: { choice: ResponseChoice; role: OptionRole }) {
  const theme = useTheme();
  const label = RESPONSE_LABEL[choice];
  const fill =
    role === "correct"
      ? theme.successSoft
      : role === "wrong"
        ? theme.dangerSoft
        : theme.surface;
  const edge =
    role === "correct" ? theme.success : role === "wrong" ? theme.danger : theme.border;
  const badgeFill =
    role === "correct" ? theme.success : role === "wrong" ? theme.danger : null;
  const badgeOn =
    role === "correct" ? theme.successOn : role === "wrong" ? theme.dangerOn : null;
  const badgeGlyph = role === "correct" ? "✓" : role === "wrong" ? "✕" : null;
  const accessibilityLabel =
    role === "correct"
      ? `Correct: ${label}`
      : role === "wrong"
        ? `Wrong pick: ${label}`
        : label;

  return (
    <View
      testID={testId(GAME_ID, "verdict-option", choice)}
      style={[
        styles.option,
        {
          backgroundColor: fill,
          borderColor: edge,
          borderWidth: role === "neutral" ? 1.5 : 3,
        },
      ]}
      accessibilityLabel={accessibilityLabel}>
      <ThemedText
        type="label"
        themeColor={
          role === "correct" ? "success" : role === "wrong" ? "danger" : "textSecondary"
        }>
        {label}
      </ThemedText>
      {badgeGlyph !== null && badgeFill !== null && badgeOn !== null ? (
        <View
          testID={testId(GAME_ID, "verdict-option-badge", choice)}
          style={[styles.optionBadge, { backgroundColor: badgeFill }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText type="label" style={{ color: badgeOn }} allowFontScaling={false}>
            {badgeGlyph}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

export function StreamVerdictBanner({ outcome, item }: StreamVerdictBannerProps) {
  const theme = useTheme();
  const glyph = glyphById(item.glyphId);
  const { correct, wasSignal, response } = outcome;
  const timedOut = response === "timeout";
  const correctChoice: ResponseChoice = wasSignal ? "signal" : "go";
  const tappedChoice: ResponseChoice | null =
    response === "go" || response === "signal" ? response : null;

  const verdict = correct
    ? ({ word: "Correct", glyph: "✓", kind: "success", testID: "verdict-correct" } as const)
    : timedOut
      ? ({ word: "Timed out", glyph: "⏱", kind: "warning", testID: "verdict-timeout" } as const)
      : ({ word: "Wrong pick", glyph: "✕", kind: "danger", testID: "verdict-wrong" } as const);

  const roleFor = (choice: ResponseChoice): OptionRole => {
    if (choice === correctChoice) return "correct";
    if (tappedChoice === choice) return "wrong";
    return "neutral";
  };

  const itemFact = `${glyph.label} was ${wasSignal ? "a signal" : "not a signal"}.`;
  const spoken = correct
    ? `Correct. ${itemFact} You tapped ${RESPONSE_LABEL[correctChoice]}.`
    : timedOut
      ? `Timed out. ${itemFact} Correct was ${RESPONSE_LABEL[correctChoice]}.`
      : `Wrong pick. ${itemFact} You tapped ${RESPONSE_LABEL[tappedChoice ?? correctChoice]}. Correct was ${RESPONSE_LABEL[correctChoice]}.`;

  return (
    <View
      testID={testId(GAME_ID, "verdict")}
      style={[
        styles.banner,
        {
          backgroundColor: theme[`${verdict.kind}Soft`],
          borderColor: theme[verdict.kind],
        },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={spoken}>
      <View style={styles.headerRow}>
        <View
          testID={testId(GAME_ID, "verdict-badge")}
          style={[styles.badge, { backgroundColor: theme[verdict.kind] }]}
          importantForAccessibility="no-hide-descendants">
          <ThemedText
            type="label"
            style={{ color: theme[`${verdict.kind}On`] }}
            allowFontScaling={false}>
            {verdict.glyph}
          </ThemedText>
        </View>
        <ThemedText
          type="bodyLarge"
          themeColor={verdict.kind}
          testID={testId(GAME_ID, verdict.testID)}>
          {verdict.word}
        </ThemedText>
        <View style={styles.promptGroup}>
          <ThemedText
            type="numeral"
            style={{ color: glyph.color }}
            testID={testId(GAME_ID, "verdict-prompt")}
            allowFontScaling={false}>
            {glyph.glyph}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {wasSignal ? "was a signal" : "was not a signal"}
          </ThemedText>
        </View>
      </View>
      <View style={styles.optionRow}>
        <OptionChip choice="go" role={roleFor("go")} />
        <OptionChip choice="signal" role={roleFor("signal")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.large,
    // Explicit verdict boundary (weight channel) — neutral surfaces sit at 1.5.
    borderWidth: 3,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  // Opaque verdict badge: the icon/shape half of the verdict channel.
  badge: {
    minWidth: Spacing.four,
    height: Spacing.four,
    paddingHorizontal: Spacing.one,
    borderRadius: Radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  // Resolved-prompt restatement pushed to the trailing edge so the verdict
  // word keeps the leading side.
  promptGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    marginLeft: "auto",
  },
  optionRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.three,
  },
  option: {
    minWidth: 96,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radii.medium,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.one,
  },
  optionBadge: {
    width: Spacing.four,
    height: Spacing.four,
    borderRadius: Radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
