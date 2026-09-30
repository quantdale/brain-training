/**
 * Game detail — `/game-detail/[id]` (Campaign 024 UX wave; Campaign 026
 * identity rebuild).
 *
 * One resume path: the game-world Stage carries the domain identity cue, the
 * game title, its interaction line, the mastery ring with the concrete
 * next-milestone line, and the screen's single primary Play CTA. The favourite
 * toggle is a quiet secondary action below the stage; records and recent
 * sessions render as Report hairline rows into `/results`.
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
  identityFamilyLabel,
} from "@/components/discovery/game-identity";
import { GameStage } from "@/components/discovery/game-stage";
import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { formatRelativeDay } from "@/components/shell/format";
import { ThemedText } from "@/components/themed-text";
import {
  BackLink,
  Button,
  Card,
  EmptyState,
  ProgressRing,
  Report,
  ReportRow,
  Spark,
  useSafeBackAffordance,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { getDb, type AppDatabase } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { useTheme } from "@/hooks/use-theme";
import { computeMastery, MASTERY_TIERS, type MasteryInput } from "@/mastery";
import { getGameDefinition } from "@/registry/registry";
import { parseCanonicalGameId } from "@/routing/route-params";

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
  // App-owned input envelope (Campaign 053): malformed or oversized ids never
  // reach catalog lookup or persistence and fall through to the unknown-game
  // fallback below.
  const routeGameId = parseCanonicalGameId(id);
  const game =
    routeGameId === null ? undefined : getGameDefinition(routeGameId);
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
    (db) => loadDetail(db, routeGameId ?? ""),
    [routeGameId, refreshKey],
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
  // 058: cold deep links land with an empty stack — fall back to /games.
  // 072 §4.4: this screen is reached from Games, Progress and Home, so a
  // fixed "Back to Games" label is wrong on two of the three. The affordance
  // names the fallback only when there IS no history to go back through.
  const backAffordance = useSafeBackAffordance('/games', {
    back: 'Back',
    fallback: 'Games',
  });
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
                {/* 058: Link-asChild hides the Pressable's own style, so the
                    44dp floor lives on the visible child (game-not-ready
                    pattern). */}
                <ThemedText type="label" themeColor="accentText" style={MinTouchTarget}>
                  Browse games ›
                </ThemedText>
              </Pressable>
            </Link>
          </View>
        </Card>
        <BackLink
          testID="game-detail-back"
          onPress={backAffordance.onPress}
          label={backAffordance.label}
          accessibilityLabel={backAffordance.accessibilityLabel}
        />
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
      <BackLink
          testID="game-detail-back"
          onPress={backAffordance.onPress}
          label={backAffordance.label}
          accessibilityLabel={backAffordance.accessibilityLabel}
        />

      {/* Game-world first: GameStage leads with the world art and a compact
          identity plinth; records below are evidence, not the event. */}
      <View testID="game-detail-description">
        <GameStage
          game={game}
          size="stage"
          showInteraction
          testID="game-detail-mastery"
          artTestID="game-detail-world"
          identityTestID="game-detail-identity-mark"
          titleTestID="game-detail-title"
          describeTestID="game-detail-mechanic"
          kicker={identityFamilyLabel(identity.family)}
          meta={
            <View style={styles.stageMeta} testID="game-detail-identity">
              <ThemedText
                type="eyebrow"
                style={{ color: eyebrowColor }}
                testID="game-detail-identity-verb">
                {identity.verb}
              </ThemedText>
              {/* The trailing tag names the category — unless the game IS the
                  category (e.g. "Memory"/Memory), where it would parrot the
                  title (Campaign 026 visual-QA edge case). */}
              {game.primaryCategory !== game.name ? (
                <ThemedText
                  type="caption"
                  themeColor="textSecondary"
                  testID="game-detail-category">
                  {game.primaryCategory}
                </ThemedText>
              ) : null}
            </View>
          }>
          {game.hasTutorial ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Includes a short guided tutorial on first play.
            </ThemedText>
          ) : null}

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
        </GameStage>
      </View>

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
          {/* Records are evidence: Report/ReportRow hairline grammar, no card. */}
          <Report title="Records" testID="game-detail-records">
            {data.aggregate ? (
              <>
                <ReportRow
                  label="Sessions"
                  value={String(data.aggregate.count)}
                  hint={`Last played ${formatRelativeDay(data.aggregate.lastCompletedAt, nowMs)}`}
                  testID="game-detail-stat-sessions"
                  divider
                />
                <ReportRow
                  label="Best"
                  value={`${Math.round(data.aggregate.bestNormalized * 100)}%`}
                  testID="game-detail-stat-best"
                  divider
                />
                <ReportRow
                  label="Average"
                  value={`${Math.round(data.aggregate.avgNormalized * 100)}%`}
                  testID="game-detail-stat-average"
                  divider
                />
                {/* Drill-down: per-game trends live on the analytics screen. */}
                <ReportRow
                  label="View detailed trends"
                  testID="game-detail-stats-link"
                  accessibilityLabel="View detailed trends for this game"
                  onPress={() => router.push(`/progress-game?gameId=${game.id}`)}
                />
              </>
            ) : (
              <ThemedText type="bodySmall" themeColor="textSecondary">
                No sessions yet — play once to see records.
              </ThemedText>
            )}
          </Report>

          <Report title="Recent sessions" testID="game-detail-recent">
            {data.recent.length > 0 ? (
              data.recent.map((session) => (
                <SessionRow
                  key={(session as { id: string }).id}
                  session={session}
                  nowMs={nowMs}
                />
              ))
            ) : (
              <ThemedText type="bodySmall" themeColor="textSecondary">
                Nothing here yet.
              </ThemedText>
            )}
          </Report>
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
    <ReportRow
      testID={`game-detail-session-${s.id}`}
      label={`${day} · ${s.difficulty?.level ?? "?"}`}
      value={`${percent}% · +${s.xp} XP`}
      onPress={() => router.push(`/results?id=${s.id}`)}
      accessibilityLabel={`Open result from ${day}, ${percent} percent`}
    />
  );
});

const styles = StyleSheet.create({
  stageMeta: {
    alignItems: "flex-end",
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
  unknownAction: {
    alignItems: "center",
    paddingBottom: Spacing.two,
  },
});
