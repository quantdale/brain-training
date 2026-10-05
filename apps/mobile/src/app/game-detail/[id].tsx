/**
 * Game detail — `/game-detail/[id]` (change 076 UI/UX reboot, task 4.4).
 *
 * Identity-first header on the immersive stage (REFERENCE_LOCK §1/§4): a
 * compact board still, the game title and its domain tag, the mechanic line,
 * and the screen's single red Play CTA — all inside the first viewport.
 * Mastery, records and recent sessions render BELOW the fold as numbered
 * hairline fact rows (lock §8): quiet evidence, never competing with the
 * identity artifact.
 *
 * Accepted deviation (orchestrator decision (a)): NO difficulty selector on
 * this screen — difficulty remains an in-game intro choice.
 *
 * The favourite toggle is unchanged (same control, labels and semantics);
 * records and recent sessions drill into `/results`. Reloads persisted data
 * on focus, keeps hooks above the unknown-game early return, and never
 * invents records for an unplayed game. Every `game-detail-*` testID is
 * preserved.
 */

import {
  Link,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { MinTouchTarget, MIN_TOUCH_TARGET } from "@/components/a11y";
import {
  masteryTierLabel,
  useDomainHue,
} from "@/components/discovery/game-card";
import {
  GameWorldArt,
  IdentityMark,
  getGameIdentity,
} from "@/components/discovery/game-identity";
import { ScreenShell } from "@/components/screen-shell";
import { StateCard } from "@/components/shell";
import { formatRelativeDay } from "@/components/shell/format";
import { ThemedText } from "@/components/themed-text";
import {
  BackLink,
  Button,
  Card,
  EmptyState,
  HAIRLINE,
  ProgressRing,
  Spark,
  Tappable,
  useSafeBackAffordance,
} from "@/components/ui";
import { Spacing } from "@/constants/theme";
import { getDb, type AppDatabase } from "@/db";
import { useDbData } from "@/hooks/use-db-data";
import { useTheme } from "@/hooks/use-theme";
import { computeMastery, MASTERY_TIERS, type MasteryInput } from "@/mastery";
import { getGameDefinition } from "@/registry/registry";
import { parseCanonicalGameId } from "@/routing/route-params";

/**
 * Translucent white on the charcoal stage (REFERENCE_LOCK §7: dark is
 * designed, not inverted — the stage is charcoal in BOTH schemes, so these
 * do not need theme variants).
 */
const STAGE_INK_MUTED = "rgba(255, 255, 255, 0.72)";
const STAGE_LINE = "rgba(255, 255, 255, 0.28)";

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
  // Unplayed evidence reads as the bottom tier, so the page is honest before
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
  const identity = getGameIdentity(game);

  return (
    <ScreenShell>
      <BackLink
        testID="game-detail-back"
        onPress={backAffordance.onPress}
        label={backAffordance.label}
        accessibilityLabel={backAffordance.accessibilityLabel}
      />

      {/* Identity-first stage artifact (REFERENCE_LOCK §1/§4): the board still
          and the title are the event; the Play CTA completes the first
          viewport. Historical testID note: `game-detail-mastery` predates the
          reboot and names this hero card. */}
      <Card variant="stage" padding="none" testID="game-detail-mastery">
        <GameWorldArt game={game} size="hero" testID="game-detail-world" />
        <View style={styles.stageBody}>
          <View style={styles.identityRow} testID="game-detail-identity">
            <IdentityMark
              family={identity.family}
              size={26}
              color={hue?.base ?? theme.stageInk}
              testID="game-detail-identity-mark"
            />
            <ThemedText
              type="eyebrow"
              themeColor="stageInk"
              style={styles.identityVerb}
              numberOfLines={1}
              testID="game-detail-identity-verb">
              {identity.verb}
            </ThemedText>
            {/* The trailing tag names the category — unless the game IS the
                category (e.g. "Memory"/Memory), where it would parrot the
                title (Campaign 026 visual-QA edge case). */}
            {game.primaryCategory !== game.name ? (
              <View style={styles.domainTag} testID="game-detail-category">
                <ThemedText type="caption" themeColor="stageInk">
                  {game.primaryCategory}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText
            type="gameTitle"
            themeColor="stageInk"
            testID="game-detail-title"
            numberOfLines={2}>
            {game.name}
          </ThemedText>
          {identity.interaction ? (
            <ThemedText
              type="bodyRead"
              style={styles.stageMuted}
              testID="game-detail-mechanic">
              {identity.interaction}
            </ThemedText>
          ) : null}
          {game.hasTutorial ? (
            <ThemedText type="caption" style={styles.stageMuted}>
              Includes a short guided tutorial on first play.
            </ThemedText>
          ) : null}

          {/* The screen's one red primary action (lock §5). */}
          <Button
            label={`Play ${game.name}`}
            size="lg"
            testID="game-detail-play"
            onPress={() => router.push(`/game/${game.id}`)}
          />
        </View>
      </Card>

      {/* Quiet secondary action: favourite toggle (unchanged semantics). */}
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
          {/* Below the fold, evidence speaks in numbered hairline fact rows
              (REFERENCE_LOCK §8) — quiet, credible, never competing with the
              identity artifact above. */}
          <FactSection marker="01" title="Mastery">
            <View style={styles.masteryRow}>
              <ProgressRing
                value={tierMax > 0 ? summary.rank / tierMax : 0}
                size={64}
                tone="xp"
                label={`Mastery ${summary.rank} of ${tierMax}, ${tierName}`}
                testID="game-detail-mastery-ring">
                <ThemedText type="numeral">{String(summary.rank)}</ThemedText>
              </ProgressRing>
              <View style={styles.masteryTexts}>
                <ThemedText type="bodyLarge">{tierName}</ThemedText>
                <ThemedText type="bodySmall" themeColor="textSecondary">
                  {summary.nextMilestone ?? "Mastered — the top tier."}
                </ThemedText>
              </View>
            </View>
          </FactSection>

          <FactSection marker="02" title="Records" testID="game-detail-records">
            {data.aggregate ? (
              <>
                <FactRow
                  label="Sessions"
                  value={String(data.aggregate.count)}
                  hint={`Last played ${formatRelativeDay(data.aggregate.lastCompletedAt, nowMs)}`}
                  testID="game-detail-stat-sessions"
                />
                <FactRow
                  label="Best"
                  value={`${Math.round(data.aggregate.bestNormalized * 100)}%`}
                  testID="game-detail-stat-best"
                />
                <FactRow
                  label="Average"
                  value={`${Math.round(data.aggregate.avgNormalized * 100)}%`}
                  testID="game-detail-stat-average"
                />
                {/* Drill-down: per-game trends live on the analytics screen. */}
                <FactRow
                  label="View detailed trends"
                  testID="game-detail-stats-link"
                  accessibilityLabel="View detailed trends for this game"
                  onPress={() => router.push(`/progress-game?gameId=${game.id}`)}
                  divider={false}
                />
              </>
            ) : (
              <ThemedText type="bodySmall" themeColor="textSecondary">
                No sessions yet — play once to see records.
              </ThemedText>
            )}
          </FactSection>

          <FactSection
            marker="03"
            title="Recent sessions"
            testID="game-detail-recent">
            {data.recent.length > 0 ? (
              data.recent.map((session, index) => (
                <SessionRow
                  key={(session as { id: string }).id}
                  session={session}
                  nowMs={nowMs}
                  divider={index < data.recent.length - 1}
                />
              ))
            ) : (
              <ThemedText type="bodySmall" themeColor="textSecondary">
                Nothing here yet.
              </ThemedText>
            )}
          </FactSection>
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

/**
 * Numbered secondary section (REFERENCE_LOCK §8): a quiet `01`-style marker
 * beside an uppercase tracked title, with hairline fact rows underneath.
 */
function FactSection({
  marker,
  title,
  testID,
  children,
}: {
  marker: string;
  title: string;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View testID={testID}>
      <View style={styles.sectionTitleRow}>
        <ThemedText type="label" themeColor="textMuted" style={styles.sectionMarker}>
          {marker}
        </ThemedText>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          {title}
        </ThemedText>
      </View>
      <View>{children}</View>
    </View>
  );
}

/**
 * One hairline fact row (REFERENCE_LOCK §8): tracked uppercase muted label
 * left, medium value right. Interactive rows are Tappables that keep the
 * 44 dp touch floor through the row style itself.
 */
function FactRow({
  label,
  value,
  hint,
  onPress,
  testID,
  accessibilityLabel,
  divider = true,
}: {
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  divider?: boolean;
}) {
  const theme = useTheme();
  const rowStyle = [
    styles.factRow,
    divider ? { borderBottomWidth: HAIRLINE, borderBottomColor: theme.border } : null,
  ];
  const content = (
    <>
      <View style={styles.factLabels}>
        <ThemedText type="eyebrow" themeColor="textMuted" style={styles.factLabel}>
          {label.toUpperCase()}
        </ThemedText>
        {hint ? (
          <ThemedText type="caption" themeColor="textMuted" numberOfLines={2}>
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {value !== undefined ? (
        <ThemedText type="bodySmall" style={styles.factValue} numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      {onPress ? (
        <ThemedText type="body" themeColor="textMuted" aria-hidden>
          {'›'}
        </ThemedText>
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Tappable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={rowStyle}
        pressedStyle={{ backgroundColor: theme.backgroundSelected }}>
        {content}
      </Tappable>
    );
  }
  return (
    <View testID={testID} style={rowStyle}>
      {content}
    </View>
  );
}

const SessionRow = memo(function SessionRow({
  session,
  nowMs,
  divider,
}: {
  session: unknown;
  nowMs: number;
  divider: boolean;
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
    <FactRow
      testID={`game-detail-session-${s.id}`}
      label={`${day} · ${s.difficulty?.level ?? "?"}`}
      value={`${percent}% · +${s.xp} XP`}
      onPress={() => router.push(`/results?id=${s.id}`)}
      accessibilityLabel={`Open result from ${day}, ${percent} percent`}
      divider={divider}
    />
  );
});

const styles = StyleSheet.create({
  stageBody: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  identityVerb: {
    flex: 1,
  },
  domainTag: {
    borderWidth: 1,
    borderColor: STAGE_LINE,
    borderRadius: Spacing.one,
    paddingHorizontal: Spacing.oneHalf,
    paddingVertical: Spacing.half,
  },
  stageMuted: {
    color: STAGE_INK_MUTED,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  sectionMarker: {
    minWidth: Spacing.three,
    fontVariant: ["tabular-nums"],
  },
  factRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  factLabels: {
    flex: 1,
    gap: Spacing.half,
  },
  // Fact labels use the tracked uppercase eyebrow at emphasis weight — a
  // label, not a shout (lock §2 reserves 800 for headers/CTA).
  factLabel: {
    fontWeight: "600",
  },
  factValue: {
    flexShrink: 0,
    fontWeight: "500",
  },
  masteryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.one,
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
