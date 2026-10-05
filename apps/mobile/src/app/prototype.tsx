/**
 * Dev-only prototype route for change 076 (tasks 2.1–2.5).
 *
 * Renders one candidate experience system at one journey stage so the three
 * directions can be captured and compared like-for-like on the dedicated
 * emulator. The route REFUSES to render outside a dev build — prototypes are
 * not production surfaces and cannot silently ship (task 2.5 requires them
 * removed or dev-gated before release; this gate is that dev-gating).
 *
 * Deep links: braintraining://prototype?system=pocket-console&stage=home
 */

import { useLocalSearchParams, usePathname } from 'expo-router';
import { ScrollView, StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useCallback, useMemo, useState } from 'react';

import { isDevBuild } from '@/sdk';
import {
  PROTOTYPE_STAGES,
  STAGE_LABELS,
  type PrototypeStage,
} from '@/prototypes/harness';
import { PocketConsolePrototype } from '@/prototypes/pocket-console';
import { TrainingStudioPrototype } from '@/prototypes/training-studio';
import { PuzzleIndexPrototype } from '@/prototypes/puzzle-index';

const SYSTEMS = {
  'pocket-console': PocketConsolePrototype,
  'training-studio': TrainingStudioPrototype,
  'puzzle-index': PuzzleIndexPrototype,
} as const;

type SystemId = keyof typeof SYSTEMS;

const SYSTEM_LABELS: Record<SystemId, string> = {
  'pocket-console': 'Pocket Console',
  'training-studio': 'Training Studio',
  'puzzle-index': 'Puzzle Index',
};

function parseStage(raw: unknown): PrototypeStage {
  return typeof raw === 'string' && (PROTOTYPE_STAGES as readonly string[]).includes(raw)
    ? (raw as PrototypeStage)
    : 'home';
}

function NotADevBuild() {
  return (
    <View style={styles.gate}>
      <Text style={styles.gateText}>Prototype surfaces are dev-only.</Text>
    </View>
  );
}

export default function PrototypeScreen() {
  const params = useLocalSearchParams<{ system?: string; stage?: string }>();
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const [stage, setStage] = useState<PrototypeStage>(() => parseStage(params.stage));

  // Re-seed the stage when a capture deep link arrives with a new ?stage=.
  // React-endorsed "adjust state when a prop changes" pattern: compare against
  // the last seeded param in state and set both during render (no effects).
  const paramStage = useMemo(() => parseStage(params.stage), [params.stage]);
  const [seededParam, setSeededParam] = useState<PrototypeStage>(paramStage);
  if (paramStage !== seededParam) {
    setSeededParam(paramStage);
    setStage(paramStage);
  }

  const systemId: SystemId = (
    typeof params.system === 'string' && params.system in SYSTEMS
      ? (params.system as SystemId)
      : 'pocket-console'
  );
  const System = SYSTEMS[systemId];
  const pathname = usePathname();

  const onStage = useCallback((s: PrototypeStage) => setStage(s), []);

  if (!isDevBuild()) {
    return <NotADevBuild />;
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={'#FFFFFF'} />
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FFFFFF' }}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={styles.switcher}>
          <Text style={styles.switcherTitle}>076 prototype comparison harness</Text>
          <Text style={styles.switcherPath}>{pathname} · stage={stage} · mode={mode}</Text>
          <View style={styles.systemRow}>
            {(Object.keys(SYSTEMS) as SystemId[]).map((id) => (
              <Text
                key={id}
                style={[styles.systemChip, id === systemId && styles.systemChipActive]}
              >
                {SYSTEM_LABELS[id]}
              </Text>
            ))}
          </View>
          <View style={styles.stageRow}>
            {PROTOTYPE_STAGES.map((s) => (
              <Text key={s} style={[styles.stageChip, s === stage && styles.stageChipActive]}>
                {STAGE_LABELS[s]}
              </Text>
            ))}
          </View>
        </View>
        <View style={styles.frame}>
          <System stage={stage} mode={mode} onStage={onStage} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  gateText: { fontSize: 14, fontWeight: '600', color: '#333333' },
  switcher: {
    paddingTop: 40,
    padding: 14,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FAFAF8',
  },
  switcherTitle: { fontSize: 14, fontWeight: '800', color: '#111111' },
  switcherPath: { fontSize: 11, color: '#666666' },
  systemRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  systemChip: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555555',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  systemChipActive: { backgroundColor: '#111111', color: '#FFFFFF', borderColor: '#111111' },
  stageRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stageChip: {
    fontSize: 11,
    fontWeight: '600',
    color: '#777777',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  stageChipActive: { color: '#111111', fontWeight: '800', textDecorationLine: 'underline' },
  frame: { minHeight: 600 },
});
