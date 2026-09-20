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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Elevation, Spacing } from "@/constants/theme";
import { launchAnimation } from "@/components/ui/motion";
import { useTheme } from "@/hooks/use-theme";
import { usePrefersReducedMotion } from "@/components/game-ui/use-reduced-motion";
export interface RewardCelebrationPayload {
  /** Stable-ish unique id (auto-assigned if omitted). */
  id?: string;
  title: string;
  xp?: number;
  coins?: number;
  cosmeticName?: string;
  emoji?: string;
}

type CelebrationListener = (
  payload: Required<RewardCelebrationPayload>,
) => void;

const listeners = new Set<CelebrationListener>();

let seq = 0;

/** Emit a reward celebration. Safe to call from anywhere (no provider needed). */
export function celebrateReward(payload: RewardCelebrationPayload): void {
  const full: Required<RewardCelebrationPayload> = {
    id: payload.id ?? `reward-${Date.now()}-${seq++}`,
    title: payload.title,
    xp: payload.xp ?? 0,
    coins: payload.coins ?? 0,
    cosmeticName: payload.cosmeticName ?? "",
    emoji: payload.emoji ?? "🎉",
  };
  listeners.forEach((listener) => listener(full));
}

/** Render this once (e.g. at the top of a screen) to show celebrations. */
export function RewardCelebrationHost() {
  const theme = useTheme();
  const [current, setCurrent] =
    useState<Required<RewardCelebrationPayload> | null>(null);
  const opacity = useMemo(() => new Animated.Value(0), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  // Announce each banner once: screen-reader users get the reward feedback
  // that sighted users get from the transient visual banner.
  const announcedIdRef = useRef<string | null>(null);

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
    if (announcedIdRef.current !== current.id) {
      announcedIdRef.current = current.id;
      const bits = [
        current.title,
        current.xp > 0 ? `+${current.xp} XP` : null,
        current.coins > 0 ? `+${current.coins} coins` : null,
        current.cosmeticName ? `Unlocked ${current.cosmeticName}` : null,
      ]
        .filter(Boolean)
        .join(", ");
      AccessibilityInfo.announceForAccessibility(bits);
    }
    if (prefersReducedMotion) {
      // Reduced motion: present the banner statically at full opacity.
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    // 061: launchAnimation stops the driver on unmount (fast dismissals
    // orphan it).
    return launchAnimation(
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
  }, [current, opacity, prefersReducedMotion]);

  if (!current) {
    return null;
  }

  const rewardBits = [
    current.xp > 0 ? `+${current.xp} XP` : null,
    current.coins > 0 ? `+${current.coins} coins` : null,
    current.cosmeticName ? `Unlocked ${current.cosmeticName}` : null,
  ].filter(Boolean);

  return (
    <Animated.View
      style={[styles.overlay, { opacity }]}
      pointerEvents="none"
      testID="reward-celebration"
    >
      <View
        style={[
          styles.card,
          { backgroundColor: theme.overlaySurface },
          Elevation.raised,
        ]}>
        <Text style={[styles.emoji, { color: theme.overlayText }]}>{current.emoji}</Text>
        <Text style={[styles.title, { color: theme.overlayText }]}>{current.title}</Text>
        {rewardBits.length > 0 && (
          <Text style={[styles.sub, { color: theme.overlayTextMuted }]}>{
            rewardBits.join("   ")
          }</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: "center",
    paddingTop: Spacing.three,
  },
  // Campaign 026 colour sweep: the celebration banner is a fixed dark
  // overlay (like the pause overlay) by design — it floats above either
  // theme, so its surface/copy colours come from the theme overlay tokens.
  card: {
    borderRadius: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    // RN 0.82: shadow* props are deprecated (their deprecation warning fires
    // LogBox's "Open debugger to view warnings" snackbar, which docks over
    // bottom-anchored controls and blocks taps — device-verified during the
    // 013 certification run). boxShadow is the cross-platform replacement;
    // elevation stays as the legacy Android separation guarantee.
    elevation: 4,
  },
  emoji: {
    fontSize: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
});
