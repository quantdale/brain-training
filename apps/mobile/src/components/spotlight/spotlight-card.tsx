/**
 * Today's Spotlight card (Campaign 014 W3/W6; Campaign 024 kit rebuild): the
 * deterministic daily featured challenge. Self-contained data seam — one
 * bounded session-count read for completion state; selection itself is
 * pure/offline. Composed from the shared kit (Card + Button), so press
 * feedback, targets and tokens are inherited, not re-implemented.
 */
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { SectionHeader } from "@/components/shell";
import { Button, Card } from "@/components/ui";
import { Spacing } from "@/theme/tokens";
import { useDbData } from "@/hooks/use-db-data";
import { registry } from "@/registry/registry.generated";
import { dailySpotlight, localDayWindow } from "@/spotlight/spotlight";
import { localDateString } from "@/workout/today";

export function SpotlightCard() {
  const date = localDateString();
  const spotlight = useMemo(
    () => dailySpotlight(registry.map((g) => g.id), date),
    [date],
  );
  const [reloadToken, setReloadToken] = useState(0);
  const { data: completedCount } = useDbData(
    async (db) => {
      if (!spotlight) {
        return 0;
      }
      const window = localDayWindow(date);
      return db.sessions.countSessions({
        gameIds: [spotlight.gameId],
        fromMs: window.fromMs,
        toMs: window.toMs,
      });
    },
    [date, spotlight?.gameId, reloadToken],
    0,
  );

  if (!spotlight) {
    return null;
  }
  const game = registry.find((g) => g.id === spotlight.gameId);
  const done = completedCount > 0;

  return (
    <View style={styles.section} testID="home-spotlight">
      <SectionHeader title="Today's Spotlight" />
      <Card>
        <View style={styles.body}>
          <ThemedText type="smallBold" testID="home-spotlight-game">
            {game?.name ?? spotlight.gameId}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            testID="home-spotlight-difficulty"
          >
            Featured difficulty: {spotlight.difficulty}
          </ThemedText>
          {done ? (
            <ThemedText
              type="smallBold"
              themeColor="accent"
              testID="home-spotlight-done"
            >
              Completed today ✓
            </ThemedText>
          ) : (
            <Button
              variant="secondary"
              label="Play the spotlight"
              testID="home-spotlight-play"
              accessibilityLabel={`Play today's spotlight: ${game?.name ?? spotlight.gameId}`}
              onPress={() => {
                setReloadToken((t) => t + 1);
                router.push(`/game-detail/${spotlight.gameId}`);
              }}
            />
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  body: {
    gap: Spacing.oneHalf,
  },
});
