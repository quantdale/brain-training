/**
 * Tutorial — first-play interactive tutorial for the Rule Flip game.
 *
 * Three steps: a short explanation, a live demo on one deterministic round
 * (match the target by COLOR; a wrong tap can be cleared and retried), and a
 * completion screen. Completion marks the tutorial done via the tutorial
 * lifecycle; a dev-only skip button (rendered by the parent only in dev
 * builds) uses the QA skip path.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R pattern);
 * mechanics stay local.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { createRng, testId } from '@/sdk';
import { ThemedText } from '@/components/themed-text';
import { GameButton, TutorialFrame } from '@/components/game-ui';
import { Spacing } from '@/constants/theme';

import { generateRound } from '../generator';
import { GAME_ID, RULE_LABELS } from '../types';
import { Stimulus } from './stimulus';
import type { StimulusVisualState } from './stimulus';

/** Deterministic demo seed so the tutorial round is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'flexibility-rule-flip-tutorial-demo-v1';
const DEMO_RULE = 'color' as const;

type TutorialStep = 'intro' | 'demo' | 'done';

export interface TutorialProps {
  onComplete: () => void;
  /** Dev-only QA skip; the parent passes it only when `isDevBuild()`. */
  onSkip?: () => void;
}

export function Tutorial({ onComplete, onSkip }: TutorialProps) {
  const [step, setStep] = useState<TutorialStep>('intro');

  return (
    <TutorialFrame gameId={GAME_ID}>
      {step === 'intro' ? (
        <View style={styles.body}>
          <ThemedText type="headline">How to play</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Each trial shows a target card and four candidates. Match the target
            by the ACTIVE rule — color, shape, or number, shown in the banner.
            The rule holds for a run of trials, then flips without warning:
            re-anchor quickly to keep your streak and speed bonus.
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

      {step === 'demo' ? <DemoRound onDone={() => setStep('done')} onSkip={onSkip} /> : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You’ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ready to play for real — watch the banner: right after a “Rule
            flipped!” cue the new rule decides which card matches.
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

interface DemoRoundProps {
  onDone: () => void;
  onSkip?: () => void;
}

/** One demo run: match the target under the COLOR rule (retry on a wrong tap). */
function DemoRound({ onDone, onSkip }: DemoRoundProps) {
  const round = useMemo(
    () =>
      generateRound({
        rng: createRng(TUTORIAL_DEMO_SEED),
        roundIndex: 0,
        rule: DEMO_RULE,
        isSwitch: false,
        numShapes: 3,
        numColors: 3,
        numNumbers: 3,
        prevTarget: null,
      }),
    [],
  );
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);

  const correct = pickedIndex === round.correctIndex;
  const wrong = pickedIndex !== null && pickedIndex !== round.correctIndex;

  const visualFor = (index: number): StimulusVisualState => {
    if (index === round.correctIndex && (correct || wrong)) {
      // After a wrong pick the demo reveals the correct card (feedback, not a leak).
      return 'selected';
    }
    if (wrong && index === pickedIndex) {
      return 'error';
    }
    return 'idle';
  };

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <View style={styles.banner}>
        <ThemedText type="headline" themeColor="accent">
          {RULE_LABELS[DEMO_RULE]}
        </ThemedText>
      </View>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        testID={testId(GAME_ID, 'tutorial-demo-status')}
      >
        {correct ? 'Perfect!' : wrong ? 'Not quite — the highlighted card matches by color' : 'Pick the card matching the target by color'}
      </ThemedText>
      <View style={styles.targetRow}>
        <Stimulus card={round.target} testID={testId(GAME_ID, 'tutorial-target')} disabled />
      </View>
      <View style={styles.grid} testID={testId(GAME_ID, 'tutorial-grid')}>
        {round.candidates.map((card, index) => (
          <Stimulus
            key={index}
            card={card}
            testID={`${testId(GAME_ID, 'tutorial-grid')}.card.${index}`}
            onPress={() => {
              if (pickedIndex === null) {
                setPickedIndex(index);
              }
            }}
            disabled={pickedIndex !== null}
            state={visualFor(index)}
          />
        ))}
      </View>
      {correct ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-demo-done')}
          label="That’s it"
          onPress={onDone}
        />
      ) : null}
      {wrong ? (
        <GameButton
          testID={testId(GAME_ID, 'tutorial-demo-retry')}
          label="Clear and retry"
          variant="secondary"
          onPress={() => setPickedIndex(null)}
        />
      ) : null}
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
  banner: {
    alignItems: 'center',
  },
  targetRow: {
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    justifyContent: 'center',
  },
});
