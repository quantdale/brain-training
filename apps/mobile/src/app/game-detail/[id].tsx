/**
 * Game detail — `/game-detail/[id]` (Campaign 024 UX wave; Campaign 026
 * identity rebuild).
 *
 * One resume path: the neutral hero card carries the domain identity cue, the
 * game title, its description, the mastery ring with the concrete
 * next-milestone line, and the screen's single primary Play CTA. The favourite toggle is a quiet
 * secondary action below the hero; records render as `StatBlock`s in their
 * metric identity colours and recent sessions as `ListRow`s into `/results`.
 *
 * Reloads persisted data on focus (a played session pops back here), keeps
 * hooks above the unknown-game early return, and never invents records for an
 * unplayed game. Every `game-detail-*` testID is preserved.
 */

import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MinTouchTarget } from "@/components/a11y";
import {
  masteryTierLabel,
  useDomainHue,
} from "@/components/discovery/game-card";
import {
  getGameIdentity,
  GameWorldArt,
  IdentityMark,
  identityFamilyLabel,
} from "@/components/discovery/game-identity";
import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { formatRelativeDay } from "@/components/shell/format";
import { ThemedText } from "@/components/themed-text";
import {
  Button,
  Card,
  EmptyState,
  ListRow,
  ProgressRing,
  Spark,
  StatBlock,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { getDb, type AppDatabase } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { useTheme } from "@/hooks/use-theme";
import { computeMastery, MASTERY_TIERS, type MasteryInput } from "@/mastery";
import { getGameDefinition } from "@/registry/registry";

interface DetailData {
  /** Load-time clock for relative-day formatting (set outside render). */
  nowMs: number;
  favorite: boolean;
  aggregate: {
    count: number;
    avgNormalized: number;
    bestNormalized: number;
    lastCompletedAt: number;
  } | null;
  recent: readonly unknown[];
  /** Campaign 014: mastery evidence for this game (null ⇒ unplayed). */
  masteryInput: MasteryInput | null;
}

function loadDetail(db: AppDatabase, id: string): Promise<DetailData> {
  return (async () => {
    const nowMs = Date.now();
    const [favorite, aggregate, recent, masteryInput] = await Promise.all([
      db.favorites.isFavorite(id),
      db.sessions.getGameAggregate(id, nowMs),
      db.sessions.listByGame(id, 10, nowMs),
      db.sessions.getMasteryInputByGame(id, nowMs),
    ]);
    return { nowMs, favorite, aggregate, recent, masteryInput };
  })();
}

const EMPTY_DETAIL: DetailData = {
  nowMs: 0,
  favorite: false,
  aggregate: null,
  recent: [],
  masteryInput: null,
};

export default function GameDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const game = getGameDefinition(id ?? "");
  const hue = useDomainHue(game?.primaryCategory ?? "");

  // Reload persisted data whenever the screen regains focus (e.g. after a
  // played session pops back from the game route).
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data, loaded, error } = useDbData(
    (db) => loadDetail(db, id ?? ""),
    [id, refreshKey],
    EMPTY_DETAIL,
  );
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(
    null,
  );
  const [toggleError, setToggleError] = useState(false);

  const currentFavorite = favoriteOverride ?? (loaded ? data.favorite : false);
  // Recovery action for the error state: bumping the key reruns the load.
  const retryLoad = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Hooks stay above the unknown-game early return so the hook count cannot
  // change across navigations between valid and invalid ids.
  const onToggleFavorite = useCallback(async () => {
    if (!game) return;
    try {
      const db = getDb();
      const next = !currentFavorite;
      setFavoriteOverride(next);
      if (next) {
        await db.favorites.setFavorite(game.id);
      } else {
        await db.favorites.removeFavorite(game.id);
      }
      setToggleError(false);
      setRefreshKey((k) => k + 1); // resync the db-backed favorite state
    } catch {
      setFavoriteOverride(null);
      setToggleError(true);
    }
  }, [currentFavorite, game]);

  if (!game) {
    return (
      <ScreenShell>
        <ThemedText type="title" testID="game-detail-title">
          Game
        </ThemedText>
        <Card variant="outlined" testID="game-detail-unknown">
          <EmptyState
            icon={<Spark size={36} color={theme.textMuted} />}
            title="Unknown game"
            message="This game is not in your library. It may have been renamed or removed — browse the library to find something to play."
          />
          <View style={styles.unknownAction}>
            <Link href="/games" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Browse the game library"
                testID="game-detail-unknown-browse"
              >
                <ThemedText type="label" themeColor="accentText">
                  Browse games ›
                </ThemedText>
              </Pressable>
            </Link>
          </View>
        </Card>
        <BackLink />
      </ScreenShell>
    );
  }

  const nowMs = data.nowMs;
  // Unplayed evidence reads as the bottom tier, so the hero is honest before
  // the first session and before the load settles.
  const summary = computeMastery(
    data.masteryInput ?? {
      gameId: game.id,
      sessions: 0,
      bestNormalized: 0,
      avgNormalized: 0,
      hardStrong: 0,
      expertStrong: 0,
      lastCompletedAt: 0,
    },
  );
  const tierName = masteryTierLabel(summary.tier);
  const tierMax = MASTERY_TIERS.length - 1;
  const eyebrowColor = hue ? hue.softText : theme.accentText;
  const identity = getGameIdentity(game);

  return (
    <ScreenShell>
      <BackLink />

      {/* Single-path resume block: eyebrow → title → progress → one CTA. */}
      {/* Campaign 035: domain identity stays on the motif/eyebrow while the
          neutral shared hero leaves the global Play action as the state cue. */}
      <Card
        variant="hero"
        shape="soft"
        padding="none"
        testID="game-detail-mastery"
      >
        <GameWorldArt game={game} size="hero" testID="game-detail-world" />
        <View style={styles.resumeBody}>
          <View style={styles.resumeHead}>
            <View style={styles.identityRow} testID="game-detail-identity">
              <IdentityMark
                family={identity.family}
                color={hue?.base ?? theme.accent}
                size={34}
                testID="game-detail-identity-mark"
              />
              <View style={styles.identityCopy}>
                <ThemedText
                  type="eyebrow"
                  style={{ color: eyebrowColor }}
                  testID="game-detail-identity-verb">
                  {identity.verb}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {identityFamilyLabel(identity.family)}
                </ThemedText>
              </View>
            </View>
            {/* The eyebrow names the category — unless the game IS the
                category (e.g. "Memory"/Memory), where it would parrot the
                title (Campaign 026 visual-QA edge case). */}
            {game.primaryCategory !== game.name ? (
              <ThemedText
                type="eyebrow"
                style={{ color: eyebrowColor }}
                testID="game-detail-category">
                {game.primaryCategory}
              </ThemedText>
            ) : null}
            <ThemedText type="title" testID="game-detail-title">
              {game.name}
            </ThemedText>
            <View testID="game-detail-description">
              <ThemedText
                type="bodySmall"
                themeColor="textSecondary"
                testID="game-detail-mechanic">
                {game.description ?? identity.interaction}
              </ThemedText>
            </View>
            {game.hasTutorial ? (
              <ThemedText type="caption" themeColor="textSecondary">
                Includes a short guided tutorial on first play.
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.masteryRow}>
            <ProgressRing
              value={tierMax > 0 ? summary.rank / tierMax : 0}
              tone="xp"
              label={`Mastery ${summary.rank} of ${tierMax}, ${tierName}`}
              testID="game-detail-mastery-ring">
              <ThemedText type="numeralLg">{String(summary.rank)}</ThemedText>
            </ProgressRing>
            <View style={styles.masteryTexts}>
              <ThemedText type="eyebrow" themeColor="textSecondary">
                MASTERY
              </ThemedText>
              <ThemedText type="headline">{tierName}</ThemedText>
              <ThemedText type="bodySmall" themeColor="textSecondary">
                {summary.nextMilestone ?? "Mastered — the top tier."}
              </ThemedText>
            </View>
          </View>

          {/* The screen's one primary action. */}
          <Button
            label={`Play ${game.name}`}
            size="lg"
            testID="game-detail-play"
            onPress={() => router.push(`/game/${game.id}`)}
          />
        </View>
      </Card>

      {/* Quiet secondary action: favourite toggle. */}
      <Button
        variant="secondary"
        fullWidth={false}
        label={currentFavorite ? "★ Favorited" : "☆ Add to favorites"}
        testID="game-detail-favorite"
        accessibilityLabel={
          currentFavorite ? "Remove from favorites" : "Add to favorites"
        }
        // `selected` (not `checked`): with role=button, screen readers announce
        // selected/unselected; `checked` is only spoken for toggle/checkbox roles.
        accessibilityState={{ selected: currentFavorite }}
        disabled={!loaded}
        onPress={onToggleFavorite}
      />
      {toggleError ? (
        <ThemedText
          type="caption"
          themeColor="danger"
          testID="game-detail-fav-error"
          accessibilityLiveRegion="polite"
        >
          Could not update favorites.
        </ThemedText>
      ) : null}

      {!loaded ? (
        <StateCard
          variant="loading"
          title="Loading…"
          message="Fetching your records for this game."
          testID="game-detail-loading"
        />
      ) : error ? (
        <StateCard
          variant="error"
          title="Couldn't load records"
          message="Your history for this game is unavailable right now."
          testID="game-detail-error"
          action={{ label: "Try again", onPress: retryLoad }}
        />
      ) : (
        <>
          <Card testID="game-detail-records">
            <ThemedText type="headline">Records</ThemedText>
            {data.aggregate ? (
              <View style={styles.statsRow}>
                <View style={styles.statCell}>
                  <StatBlock
                    label="Sessions"
                    value={String(data.aggregate.count)}
                    delta={`Last played ${formatRelativeDay(data.aggregate.lastCompletedAt, nowMs)}`}
                    testID="game-detail-stat-sessions"
                  />
                </View>
                <View style={styles.statCell}>
                  <StatBlock
                    label="Best"
                    value={`${Math.round(data.aggregate.bestNormalized * 100)}%`}
                    metric="score"
                    testID="game-detail-stat-best"
                  />
                </View>
                <View style={styles.statCell}>
                  <StatBlock
                    label="Average"
                    value={`${Math.round(data.aggregate.avgNormalized * 100)}%`}
                    metric="score"
                    testID="game-detail-stat-average"
                  />
                </View>
              </View>
            ) : (
              <ThemedText type="bodySmall" themeColor="textSecondary">
                No sessions yet — play once to see records.
              </ThemedText>
            )}
            {/* Drill-down: per-game trends live on the analytics screen. */}
            {data.aggregate ? (
              <Link href={`/progress-game?gameId=${game.id}`} asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View detailed trends for this game"
                  testID="game-detail-stats-link"
                  style={MinTouchTarget}
                >
                  <ThemedText type="label" themeColor="accentText">
                    View detailed trends ›
                  </ThemedText>
                </Pressable>
              </Link>
            ) : null}
          </Card>

          <Card testID="game-detail-recent">
            <ThemedText type="headline">Recent sessions</ThemedText>
            {data.recent.length > 0 ? (
              <View>
                {data.recent.map((session) => (
                  <SessionRow
                    key={(session as { id: string }).id}
                    session={session}
                    nowMs={nowMs}
                  />
                ))}
              </View>
            ) : (
              <ThemedText type="bodySmall" themeColor="textSecondary">
                Nothing here yet.
              </ThemedText>
            )}
          </Card>
        </>
      )}

      <ThemedText
        type="caption"
        themeColor="textSecondary"
        testID="game-detail-versions"
      >
        game v{game.gameVersion} · sdk {game.sdkVersion}
        {game.generatorVersion
          ? ` · generator v${game.generatorVersion}`
          : " · curated content"}
      </ThemedText>
    </ScreenShell>
  );
}

function BackLink() {
  return (
    <Pressable
      testID="game-detail-back"
      accessibilityRole="button"
      accessibilityLabel="Back to Games"
      onPress={() => router.back()}
      style={MinTouchTarget}
    >
      <ThemedText type="label" themeColor="accentText">
        ‹ Back
      </ThemedText>
    </Pressable>
  );
}

const SessionRow = memo(function SessionRow({
  session,
  nowMs,
}: {
  session: unknown;
  nowMs: number;
}) {
  const s = session as {
    id: string;
    normalizedResult: number;
    xp: number;
    completedAt: number;
    difficulty?: { level?: string } | null;
  };
  const day = formatRelativeDay(s.completedAt, nowMs);
  const percent = Math.round(s.normalizedResult * 100);
  return (
    <ListRow
      testID={`game-detail-session-${s.id}`}
      title={`${day} · ${s.difficulty?.level ?? "?"}`}
      meta={`${percent}% · +${s.xp} XP`}
      onPress={() => router.push(`/results?id=${s.id}`)}
      accessibilityLabel={`Open result from ${day}, ${percent} percent`}
      accessibilityHint="Opens the session result"
    />
  );
});

const styles = StyleSheet.create({
  resumeBody: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  resumeHead: {
    gap: Spacing.one,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  identityCopy: {
    flex: 1,
    flexShrink: 1,
    gap: Spacing.half,
  },
  masteryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
  },
  masteryTexts: {
    flex: 1,
    flexShrink: 1,
    gap: Spacing.one,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.three,
  },
  statCell: {
    flex: 1,
  },
  unknownAction: {
    alignItems: "center",
    paddingBottom: Spacing.two,
  },
});
