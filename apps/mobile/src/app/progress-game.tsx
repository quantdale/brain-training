/**
 * Per-game analytics drill-down — `/progress-game?gameId=...`.
 *
 * Builds its view from the canonical session rows for one game only (via
 * `buildGameInsight`). It surfaces personal records and trend series for whatever
 * metrics that game actually persisted (score / accuracy / reaction time /
 * difficulty) and omits any trend whose data is not present — no metrics are
 * invented. Neutral, non-clinical language.
 */

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  buildGameInsight,
  compareRecentVsLifetime,
  loadGameSessions,
  type GameInsight,
  type TimeWindowKey,
  WINDOW_LABELS,
  WINDOW_ORDER,
} from '@/analytics';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SegmentedControl, MiniBarChart } from '@/components/progress-charts';
import { Radii, Spacing } from '@/constants/theme';
import type { AppDatabase, GameSessionRecord } from '@/db';
import { useDbData } from '@/hooks/use-db-data';
import { getGameDefinition } from '@/registry/registry';
import { formatDayLabel, formatMs, formatPercent, formatSigned } from '@/analytics/format';

const EMPTY: GameSessionRecord[] = [];

function trendValues(insight: GameInsight, key: keyof GameInsight['series']): number[] {
  return insight.series[key].map((p) => p.value);
}

export default function ProgressGameScreen() {
  const params = useLocalSearchParams<{ gameId?: string }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : '';

  const [refreshKey, setRefreshKey] = useState(0);
  const [nowMs, setNowMs] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      setRefreshKey((k) => k + 1);
    }, []),
  );

  const { data } = useDbData(
    useCallback((db: AppDatabase) => loadGameSessions(db, gameId), [gameId]),
    [refreshKey, gameId],
    EMPTY,
  );
  const [windowKey, setWindowKey] = useState<TimeWindowKey>('30d');

  const insight = useMemo(() => buildGameInsight(gameId, data), [gameId, data]);

  const rvlWindow: '7d' | '30d' | '90d' = windowKey === 'all' ? '90d' : windowKey;
  const rvl = useMemo(
    () => compareRecentVsLifetime(data, rvlWindow, nowMs),
    [data, rvlWindow, nowMs],
  );

  const def = gameId ? getGameDefinition(gameId) : undefined;

  if (!gameId || !insight) {
    return (
      <ScreenShell>
        <Pressable testID="progress-game-back" accessibilityRole="button" onPress={() => router.back()}>
          <ThemedText type="smallBold" themeColor="accent">
            ‹ Back
          </ThemedText>
        </Pressable>
        <ThemedText type="title" testID="progress-game-title">
          {def?.name ?? gameId ?? 'Game'}
        </ThemedText>
        <ThemedView type="surface" style={styles.card} testID="progress-game-empty">
          <ThemedText type="subtitle">No sessions yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Play this game to start tracking its scores, accuracy and records here.
          </ThemedText>
        </ThemedView>
      </ScreenShell>
    );
  }

  const { available } = insight;

  return (
    <ScreenShell>
      <Pressable testID="progress-game-back" accessibilityRole="button" onPress={() => router.back()}>
        <ThemedText type="smallBold" themeColor="accent">
          ‹ Back
        </ThemedText>
      </Pressable>

      <ThemedText type="title" testID="progress-game-title">
        {def?.name ?? gameId}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {insight.count} sessions · last played {formatDayLabel(insight.lastCompletedAt)}
      </ThemedText>

      <View style={styles.windowRow}>
        <SegmentedControl<TimeWindowKey>
          testID="progress-game-window"
          value={windowKey}
          onChange={setWindowKey}
          options={WINDOW_ORDER.map((k) => ({ key: k, label: WINDOW_LABELS[k] }))}
        />
      </View>

      <ThemedView type="surface" style={styles.card} testID="progress-game-records">
        <ThemedText type="subtitle">Personal records</ThemedText>
        <View style={styles.recordGrid}>
          <Record label="Best performance" value={formatPercent(insight.bestNormalized)} />
          <Record
            label="Best score"
            value={available.score ? String(insight.bestScore) : '—'}
          />
          <Record
            label="Best accuracy"
            value={available.accuracy ? formatPercent(insight.bestAccuracy ?? 0) : '—'}
          />
          <Record
            label="Fastest session"
            value={insight.fastestMs === null ? '—' : formatMs(insight.fastestMs)}
          />
          <Record
            label="Best reaction"
            value={available.reaction && insight.bestReactionMs !== null ? formatMs(insight.bestReactionMs) : '—'}
          />
          <Record label="Avg performance" value={formatPercent(insight.avgNormalized)} />
        </View>
      </ThemedView>

      <TrendBlock
        testID="progress-game-trend-normalized"
        label="Performance (normalized)"
        values={trendValues(insight, 'normalized')}
      />
      {available.score ? (
        <TrendBlock
          testID="progress-game-trend-score"
          label="Score"
          values={trendValues(insight, 'score')}
          format={(v) => String(Math.round(v))}
        />
      ) : null}
      {available.accuracy ? (
        <TrendBlock
          testID="progress-game-trend-accuracy"
          label="Accuracy"
          values={trendValues(insight, 'accuracy')}
          format={(v) => formatPercent(v)}
        />
      ) : null}
      {available.reaction ? (
        <TrendBlock
          testID="progress-game-trend-reaction"
          label="Reaction time"
          values={trendValues(insight, 'reaction')}
          format={(v) => formatMs(v)}
        />
      ) : null}
      {available.difficulty ? (
        <TrendBlock
          testID="progress-game-trend-difficulty"
          label="Difficulty (challenge rating)"
          values={trendValues(insight, 'difficulty')}
          format={(v) => formatPercent(v)}
        />
      ) : null}

      <ThemedView type="surface" style={styles.card} testID="progress-game-rvl">
        <ThemedText type="subtitle">Recent vs lifetime</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          Avg performance over {WINDOW_LABELS[windowKey]} versus all-time.
        </ThemedText>
        <View style={styles.summaryRow}>
          <Record
            label={`Avg (${WINDOW_LABELS[windowKey]})`}
            value={rvl.recentAvgNormalized === null ? '—' : formatPercent(rvl.recentAvgNormalized)}
          />
          <Record label="Avg (all)" value={formatPercent(rvl.lifetimeAvgNormalized)} />
          <Record
            label="Δ avg"
            value={
              rvl.deltaAvgNormalized === null
                ? '—'
                : formatSigned(Math.round((rvl.deltaAvgNormalized ?? 0) * 100)) + '%'
            }
          />
        </View>
      </ThemedView>

      <ThemedView type="surface" style={styles.card} testID="progress-game-recent">
        <ThemedText type="subtitle">Recent sessions</ThemedText>
        <View style={styles.rows}>
          {data.slice(0, 10).map((session) => (
            <View key={session.id} style={styles.row} testID={`progress-game-session-${session.id}`}>
              <ThemedText type="small">{formatDayLabel(session.completedAt)}</ThemedText>
              <ThemedText type="smallBold">{formatPercent(session.normalizedResult)}</ThemedText>
            </View>
          ))}
        </View>
      </ThemedView>
    </ScreenShell>
  );
}

function TrendBlock({
  testID,
  label,
  values,
  format = (v) => String(Math.round(v)),
}: {
  testID: string;
  label: string;
  values: readonly number[];
  format?: (v: number) => string;
}) {
  const last = values.length > 0 ? values[values.length - 1] : null;
  const first = values.length > 0 ? values[0] : null;
  const delta = last !== null && first !== null ? last - first : 0;
  return (
    <ThemedView type="surface" style={styles.card} testID={testID}>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">{label}</ThemedText>
        {values.length > 0 ? (
          <ThemedText
            type="smallBold"
            themeColor={delta > 0 ? 'success' : delta < 0 ? 'danger' : 'textSecondary'}>
            {format(last ?? 0)}
            {delta !== 0 ? ` (${delta > 0 ? '+' : ''}${format(delta)})` : ''}
          </ThemedText>
        ) : null}
      </View>
      <MiniBarChart values={values} testID={`${testID}-chart`} />
    </ThemedView>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.record}>
      <ThemedText type="headline" themeColor="accent">
        {value}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.large,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  windowRow: {
    marginTop: Spacing.one,
  },
  recordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  record: {
    width: '30%',
    gap: Spacing.half,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rows: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
