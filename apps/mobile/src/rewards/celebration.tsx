/**
 * Reward celebration (engagement-cosmetics wave).
 *
 * A lightweight, NON-BLOCKING celebration mechanism. Rewarding moments (quest
 * / achievement / milestone claims, cosmetic purchases) emit a transient
 * banner via `celebrateReward(...)`. `RewardCelebrationHost` renders the
 * current banner for a few seconds and then dismisses it automatically —
 * gameplay and UI underneath are never blocked (the overlay ignores touches).
 *
 * This is purely presentational; the authoritative reward is the ledger/XP
 * entry recorded by the economy layer. The celebration never grants anything.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';

export interface RewardCelebrationPayload {
  /** Stable-ish unique id (auto-assigned if omitted). */
  id?: string;
  title: string;
  xp?: number;
  coins?: number;
  cosmeticName?: string;
  emoji?: string;
}

type CelebrationListener = (payload: Required<RewardCelebrationPayload>) => void;

const listeners = new Set<CelebrationListener>();

let seq = 0;

/** Emit a reward celebration. Safe to call from anywhere (no provider needed). */
export function celebrateReward(payload: RewardCelebrationPayload): void {
  const full: Required<RewardCelebrationPayload> = {
    id: payload.id ?? `reward-${Date.now()}-${seq++}`,
    title: payload.title,
    xp: payload.xp ?? 0,
    coins: payload.coins ?? 0,
    cosmeticName: payload.cosmeticName ?? '',
    emoji: payload.emoji ?? '🎉',
  };
  listeners.forEach((listener) => listener(full));
}

/** Render this once (e.g. at the top of a screen) to show celebrations. */
export function RewardCelebrationHost() {
  const [current, setCurrent] = useState<Required<RewardCelebrationPayload> | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const listener: CelebrationListener = (payload) => {
      setCurrent(payload);
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setCurrent(null), 3500);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!current) {
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [current, opacity]);

  if (!current) {
    return null;
  }

  const rewardBits = [
    current.xp > 0 ? `+${current.xp} XP` : null,
    current.coins > 0 ? `+${current.coins} coins` : null,
    current.cosmeticName ? `Unlocked ${current.cosmeticName}` : null,
  ].filter(Boolean);

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none" testID="reward-celebration">
      <View style={styles.card}>
        <Text style={styles.emoji}>{current.emoji}</Text>
        <Text style={styles.title}>{current.title}</Text>
        {rewardBits.length > 0 && <Text style={styles.sub}>{rewardBits.join('   ')}</Text>}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    paddingTop: Spacing.three,
  },
  card: {
    backgroundColor: 'rgba(20, 22, 34, 0.92)',
    borderRadius: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  emoji: {
    fontSize: 28,
    color: '#fff',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  sub: {
    color: '#D9DCE8',
    fontSize: 12,
    marginTop: 2,
  },
});
