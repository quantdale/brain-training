/**
 * Tutorial — first-play interactive tutorial for the Memory game (campaign 006R canary A).
 *
 * Three steps: a short explanation, a live demo on the real grid (a
 * deterministic 3-tile sequence the player must repeat; a wrong tap replays
 * the demo), and a completion screen. Completion marks the tutorial done via
 * the tutorial lifecycle; a dev-only skip button (rendered by the parent only
 * in dev builds) uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal reveal/input state without any setState-in-effect
 * cascades.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R canary A);
 * mechanics stay local.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

import { createRng, systemClock, testId } from '@/sdk';
import type { Clock } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { generateRoundSequence } from '../generator';
import { GAME_ID } from '../types';
import { TileGrid } from './grid';
import type { TileVisualState } from './tile';

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'memory-tutorial-demo-v1';
const DEMO_LENGTH = 3;
const DEMO_GRID_SIZE = 9;
const DEMO_REVEAL_MS = 900;

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
  /** Same monotonic exposure clock as the live game; injectable for tests. */
  clock?: Clock;
}

export function Tutorial({ onComplete, onSkip, clock = systemClock }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');
  const [attempt, setAttempt] = useState(0);

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tiles light up one by one — watch closely, then tap them in the same order. Each
            round adds another tile to the sequence.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Watch a demo"
            onPress={() => setStep('demo')}
          />
          {onSkip !== undefined ? (
            <GameButton
              testID={testId(GAME_ID, 'tutorial-skip')}
              label="Skip tutorial (QA)"
              variant="secondary"
              onPress={onSkip}
            />
          ) : null}
        </View>
      ) : null}

      {step === 'demo' ? (
        <DemoGrid
          key={attempt}
          attempt={attempt}
          clock={clock}
          onWrong={() => setAttempt((value) => value + 1)}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — the board hides during pauses, so keep your phone close.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-done')}
            label="Got it"
            onPress={onComplete}
          />
        </View>
      ) : null}
    </TutorialFrame>
  );
}

interface DemoGridProps {
  attempt: number;
  clock: Clock;
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: reveals the sequence, then validates the player's taps. */
function DemoGrid({ attempt, clock, onWrong, onDone, onSkip }: DemoGridProps) {
  const [sequence] = useState<readonly number[]>(() =>
    generateRoundSequence({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      length: DEMO_LENGTH,
      gridSize: DEMO_GRID_SIZE,
      prevSequence: null,
    }),
  );
  const [observation, setObservation] = useState(() => ({ index: 0, deadlineMs: clock.now() + DEMO_REVEAL_MS }));
  const observationRef = useRef(observation);
  const revealedIndex = observation.index;
  const [inputIndex, setInputIndex] = useState(0);
  const resolvedInput = useRef(0);
  const deliveredPresses = useRef(new WeakSet<object>());
  const activeAttempt = useRef(true);
  const [wrongTile, setWrongTile] = useState<number | null>(null);

  const revealing = revealedIndex >= 0 && revealedIndex < DEMO_LENGTH;
  const completed = inputIndex >= DEMO_LENGTH;

  useEffect(() => {
    activeAttempt.current = true;
    return () => { activeAttempt.current = false; };
  }, []);

  useEffect(() => { observationRef.current = observation; }, [observation]);

  // Reveal pacing: one tile every DEMO_REVEAL_MS, then hand over to input.
  useEffect(() => {
    if (!revealing) {
      return;
    }
    const timer = setTimeout(() => {
      const current = observationRef.current;
      const nowMs = clock.now();
      if (!activeAttempt.current || current.index !== observation.index || nowMs < current.deadlineMs) return;
      const next = { index: current.index + 1, deadlineMs: nowMs + DEMO_REVEAL_MS };
      observationRef.current = next;
      setObservation(next);
    }, Math.ceil(Math.max(0, observation.deadlineMs - clock.now())));
    return () => clearTimeout(timer);
  }, [clock, revealing, observation]);

  const handleTap = (index: number, event: GestureResponderEvent) => {
    const nativePress = event?.nativeEvent;
    if (revealing || !activeAttempt.current || resolvedInput.current >= DEMO_LENGTH ||
        nativePress == null || deliveredPresses.current.has(nativePress)) {
      return;
    }
    deliveredPresses.current.add(nativePress);
    const cursor = resolvedInput.current;
    if (index === sequence[cursor]) {
      setWrongTile(null);
      const next = cursor + 1;
      resolvedInput.current = next;
      setInputIndex(next);
      if (next >= DEMO_LENGTH) {
        onDone();
      }
    } else {
      // Retire this attempt before the replay mounts, including queued
      // callbacks delivered in the same React batch as the wrong press.
      resolvedInput.current = DEMO_LENGTH;
      setWrongTile(index);
      onWrong();
    }
  };

  const visualFor = (index: number): TileVisualState => {
    if (revealing) {
      return index === sequence[revealedIndex] ? 'revealed' : 'idle';
    }
    if (sequence.slice(0, inputIndex).includes(index)) {
      return 'selected';
    }
    return index === wrongTile ? 'error' : 'idle';
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {revealing
          ? 'Watch the sequence…'
          : completed
            ? 'Perfect!'
            : `Your turn — tap the ${DEMO_LENGTH - inputIndex} lit tile${DEMO_LENGTH - inputIndex > 1 ? 's' : ''}`}
      </ThemedText>
      <TileGrid
        gridSize={DEMO_GRID_SIZE}
        testID={testId(GAME_ID, 'tutorial-grid')}
        visualFor={visualFor}
        disabled={revealing}
        onPressTile={handleTap}
      />
      {onSkip !== undefined ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-skip')}
          label="Skip tutorial (QA)"
          variant="secondary"
          onPress={onSkip}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
});
