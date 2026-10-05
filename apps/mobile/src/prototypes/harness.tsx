/**
 * Prototype harness for change 076's three candidate experience systems.
 *
 * Dev-only by construction: the only route into these components
 * (`app/prototype.tsx`) refuses to render outside a dev build, so no
 * candidate can silently ship (tasks 2.1–2.5). Each candidate owns its own
 * palette/typography/shape language and renders the SAME seeded journey so
 * they can be compared like-for-like on device:
 *
 *   home → games → detail (instruction) → memory board → equation builder
 *   → result → progress
 *
 * The memory and equation boards are genuinely interactive (watch-then-tap
 * recall; token assembly + check) so "playability" is tested with real input,
 * not screenshots of static art.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
/** Journey stages every candidate must render. */
export type PrototypeStage =
  | 'home'
  | 'games'
  | 'detail'
  | 'memory'
  | 'equation'
  | 'result'
  | 'progress';

export const PROTOTYPE_STAGES: readonly PrototypeStage[] = [
  'home',
  'games',
  'detail',
  'memory',
  'equation',
  'result',
  'progress',
];

export const STAGE_LABELS: Record<PrototypeStage, string> = {
  home: 'Home',
  games: 'Games',
  detail: 'Instruction',
  memory: 'Memory board',
  equation: 'Equation board',
  result: 'Result',
  progress: 'Progress',
};

export interface PrototypeProps {
  stage: PrototypeStage;
  mode: 'light' | 'dark';
  /** Harness-provided stage navigation (simulates app navigation). */
  onStage: (stage: PrototypeStage) => void;
}

/** A candidate system component. */
export type PrototypeComponent = (props: PrototypeProps) => React.JSX.Element;


const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bannerText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    flex: 1,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
});

/** Dev chrome: prototype banner + stage chips, styled per candidate. */
export function PrototypeChrome(props: {
  systemName: string;
  stage: PrototypeStage;
  onStage: (stage: PrototypeStage) => void;
  ink: string;
  accentBg: string;
  accentInk: string;
  softBg: string;
}) {
  const { systemName, stage, onStage, ink, accentBg, accentInk, softBg } = props;
  return (
    <View pointerEvents="box-none">
      <View style={[styles.banner, { backgroundColor: accentBg }]}>
        <Text style={[styles.bannerText, { color: accentInk }]}>
          PROTOTYPE v2 · {systemName} · {STAGE_LABELS[stage]}
        </Text>
      </View>
      <View style={styles.chipRow}>
        {PROTOTYPE_STAGES.map((s) => {
          const active = s === stage;
          return (
            <Pressable
              key={s}
              onPress={() => onStage(s)}
              style={[styles.chip, { backgroundColor: active ? ink : softBg }]}
              accessibilityRole="button"
              accessibilityLabel={`Prototype stage ${STAGE_LABELS[s]}`}
            >
              <Text style={[styles.chipText, { color: active ? accentBg : ink }]}>
                {STAGE_LABELS[s]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Scrollable page container shared by candidates (keeps safe top area). */
export function Page({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {children}
    </ScrollView>
  );
}

/** Fixed (non-scroll) page for boards that must fit one viewport. */
export function BoardPage({ children, bg }: { children: React.ReactNode; bg: string }) {
  return <View style={{ flex: 1, backgroundColor: bg }}>{children}</View>;
}

export const px = (n: number) => n;

/** Deterministic demo sequence for the memory board (fixed, not seeded runtime). */
export const MEMORY_DEMO_SEQUENCE: readonly number[] = [2, 7, 5];
