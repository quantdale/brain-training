/**
 * Progress → Mastery insights (Campaign 014 W5): a summary-first block over
 * the per-game mastery ladder — tier distribution now, plus the closest
 * milestones one tap away. Derived view only; no new persistence.
 */
import { StyleSheet, View } from "react-native";

import { SectionHeader } from "@/components/shell";
import { MilestoneStrip } from "@/components/mastery/mastery-card";
import { ThemedText } from "@/components/themed-text";
import { Badge, Card } from "@/components/ui";
import { Spacing, type ThemeColor } from "@/constants/theme";
import {
  MASTERY_TIERS,
  type MasteryTier,
} from "@/mastery";
import { useMasterySummaries } from "@/mastery/use-mastery";
import { getGameDefinition } from "@/registry/registry";

const TIER_LABEL: Record<MasteryTier, string> = {
  unplayed: "New",
  learning: "Learning",
  developing: "Developing",
  proficient: "Proficient",
  advanced: "Advanced",
  mastered: "Mastered",
};

/** Tier → semantic badge family (progression ramp: low = info, mastered = success). */
const TIER_TONE: Record<MasteryTier, ThemeColor> = {
  unplayed: "info",
  learning: "info",
  developing: "accent",
  proficient: "warning",
  advanced: "xp",
  mastered: "success",
};

export function MasteryInsights() {
  const { ready, byGame } = useMasterySummaries();
  if (!ready || byGame.size === 0) {
    return null;
  }

  const all = [...byGame.values()];
  const counts = new Map<MasteryTier, number>();
  for (const tier of MASTERY_TIERS) {
    counts.set(tier, 0);
  }
  for (const summary of all) {
    counts.set(summary.tier, (counts.get(summary.tier) ?? 0) + 1);
  }
  const milestones = all
    .filter(
      (s) =>
        s.tier !== "unplayed" && s.tier !== "mastered" && s.nextMilestone,
    )
    .map((summary) => ({
      gameId: summary.gameId,
      name:
        getGameDefinition(summary.gameId)?.name ?? summary.gameId,
      summary,
    }));

  return (
    <View style={styles.block} testID="progress-mastery">
      <SectionHeader
        title="Mastery"
        caption="Difficulty reached and recent performance, per game."
      />
      <Card style={styles.distribution}>
        {MASTERY_TIERS.map((tier) => (
          <View
            key={tier}
            style={styles.tierRow}
            testID={`progress-mastery.${tier}`}
          >
            <Badge label={TIER_LABEL[tier]} tone={TIER_TONE[tier]} size="sm" />
            <ThemedText type="smallBold" themeColor="textSecondary">
              {counts.get(tier) ?? 0}
            </ThemedText>
          </View>
        ))}
      </Card>
      <MilestoneStrip
        items={milestones}
        testIDPrefix="progress-milestone"
      />
      <ThemedText type="caption" themeColor="textSecondary">
        Mastery reflects capability inside each game — difficulty reached and
        recent performance — never time spent alone.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  distribution: {
    gap: Spacing.two,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
