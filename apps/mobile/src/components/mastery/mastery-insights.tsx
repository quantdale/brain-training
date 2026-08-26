/**
 * Progress → Mastery insights (Campaign 014 W5): a summary-first block over
 * the per-game mastery ladder — tier distribution now, plus the closest
 * milestones one tap away. Derived view only; no new persistence.
 */
import { StyleSheet } from "react-native";

import { SectionHeader } from "@/components/shell";
import { MilestoneStrip } from "@/components/mastery/mastery-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Radii, Spacing } from "@/constants/theme";
import {
  MASTERY_TIERS,
  type MasteryTier,
} from "@/mastery";
import { useMasterySummaries } from "@/mastery/use-mastery";
import { registry } from "@/registry/registry.generated";

const TIER_LABEL: Record<MasteryTier, string> = {
  unplayed: "New",
  learning: "Learning",
  developing: "Developing",
  proficient: "Proficient",
  advanced: "Advanced",
  mastered: "Mastered",
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
        registry.find((g) => g.id === summary.gameId)?.name ?? summary.gameId,
      summary,
    }));

  return (
    <ThemedView style={styles.block} testID="progress-mastery">
      <SectionHeader title="Mastery" />
      <ThemedView type="surface" style={styles.distribution}>
        {MASTERY_TIERS.map((tier) => (
          <ThemedView
            key={tier}
            style={styles.tierRow}
            testID={`progress-mastery.${tier}`}
          >
            <ThemedText type="small">{TIER_LABEL[tier]}</ThemedText>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {counts.get(tier) ?? 0}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
      <MilestoneStrip
        items={milestones}
        testIDPrefix="progress-milestone"
      />
      <ThemedText type="caption" themeColor="textSecondary">
        Mastery reflects capability inside each game — difficulty reached and
        recent performance — never time spent alone.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  distribution: {
    borderRadius: Radii.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  tierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
