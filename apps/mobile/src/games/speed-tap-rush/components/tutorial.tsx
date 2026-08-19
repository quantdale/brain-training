/**
 * Tutorial — first-play interactive tutorial for the Tap Rush game.
 *
 * Three steps: a short explanation, a live demo on the real field (three
 * deterministic targets with a generous window; a wrong tap or an expiry
 * replays the demo), and a completion screen. Completion marks the tutorial
 * done via the tutorial lifecycle; a dev-only skip button (rendered by the
 * parent only in dev builds) uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal index/expiry state without any setState-in-effect
 * cascades (same pattern as the memory game's tutorial).
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { generateRoundTargets } from '../generator';
import { GAME_ID } from '../types';
import type { TargetPosition } from '../types';
import { GameButton } from './button';
import { Playfield } from './playfield';

/** Deterministic demo seed so the tutorial field is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'speed-tap-rush-tutorial-demo-v1';
const DEMO_COUNT = 3;
const DEMO_RADIUS = 0.09;
/** Generous window so the demo teaches the mechanic, not the stress. */
const DEMO_WINDOW_MS = 2000;

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');
  const [attempt, setAttempt] = useState(0);

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            A target pops up somewhere on the field — tap it before the bar
            runs out. Each hit chains your streak; missing or tapping the
            empty field breaks it.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Try a demo"
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
        <DemoField
          key={attempt}
          attempt={attempt}
          onWrong={() => setAttempt((value) => value + 1)}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The window shrinks as you chain perfect rounds — keep tapping
            fast, the field hides while paused.
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

interface DemoFieldProps {
  attempt: number;
  onWrong: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: three targets in sequence; wrong tap or expiry replays. */
function DemoField({ attempt, onWrong, onDone, onSkip }: DemoFieldProps) {
  const [targets] = useState<readonly TargetPosition[]>(() =>
    generateRoundTargets({
      rng: createRng(TUTORIAL_DEMO_SEED),
      roundIndex: attempt,
      count: DEMO_COUNT,
      radius: DEMO_RADIUS,
    }),
  );
  const [index, setIndex] = useState(0);

  const target = index < targets.length ? targets[index] : null;
  const completed = index >= targets.length;

  // Expiry: the demo target disappears on its own if not tapped in time.
  useEffect(() => {
    if (completed) {
      return;
    }
    const timer = setTimeout(onWrong, DEMO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [index, completed, onWrong]);

  const handleTap = (x: number, y: number) => {
    if (completed || target === null) {
      return;
    }
    const dx = x - target.x;
    const dy = y - target.y;
    const hit = dx * dx + dy * dy <= DEMO_RADIUS * DEMO_RADIUS;
    if (hit) {
      const next = index + 1;
      setIndex(next);
      if (next >= targets.length) {
        onDone();
      }
    } else {
      onWrong();
    }
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {completed ? 'Perfect!' : `Tap the target (${DEMO_COUNT - index} left)`}
      </ThemedText>
      <Playfield
        target={target}
        radius={DEMO_RADIUS}
        testID={testId(GAME_ID, 'tutorial-field')}
        onTap={handleTap}
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
