/**
 * Tutorial — first-play interactive tutorial for the Cue Shift game.
 *
 * Three steps: a short explanation, a live demo of the core mechanic (a color
 * trial, then the rule cue switches to shape and you re-anchor), and a
 * completion screen. Completion marks the tutorial done via the tutorial
 * lifecycle; a dev-only skip button (rendered by the parent only in dev
 * builds) uses the QA skip path.
 *
 * The demo is remounted with a new `key` on every replay attempt, which
 * resets its internal step state without any setState-in-effect cascades.
 *
 * Migrated to shared `TutorialFrame` + `GameButton` (campaign 006R); mechanics
 * stay local.
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

/** Deterministic demo seed so the tutorial board is identical on every device. */
export const TUTORIAL_DEMO_SEED = 'flexibility-cue-shift-tutorial-demo-v1';
const DEMO_NUM_SHAPES = 3;
const DEMO_NUM_COLORS = 3;
const DEMO_NUM_NUMBERS = 3;

type TutorialStep = 'intro' | 'round1' | 'notice' | 'round2' | 'done';

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
            A target card and four cards are shown. A rule cue tells you how to match: by color, by
            shape, or by number. The cue changes every trial — read it before you pick.
          </ThemedText>
          <GameButton
            testID={testId(GAME_ID, 'tutorial-next')}
            label="Try a demo"
            onPress={() => setStep('round1')}
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

      {step === 'round1' || step === 'notice' || step === 'round2' ? (
        <Demo
          key={attempt}
          step={step}
          onWrong={() => setAttempt((value) => value + 1)}
          onSwitch={() => setStep('notice')}
          onNoticeContinue={() => setStep('round2')}
          onDone={() => setStep('done')}
          onSkip={onSkip}
        />
      ) : null}

      {step === 'done' ? (
        <View style={styles.body}>
          <ThemedText type="headline">You&apos;ve got it</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            When the cue switches, take a breath, re-read the banner, and keep going. The right card
            matches only under the cued rule.
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

interface DemoProps {
  step: 'round1' | 'notice' | 'round2';
  onWrong: () => void;
  /** Round 1 solved → move to the notice step (the cue switches). */
  onSwitch: () => void;
  /** Notice acknowledged → move to round 2 (new rule). */
  onNoticeContinue: () => void;
  onDone: () => void;
  onSkip?: () => void;
}

/**
 * One demo run: round 1 under the color rule, the switch notice, then round 2
 * under the shape rule. A wrong pick replays the current step.
 */
function Demo({ step, onWrong, onSwitch, onNoticeContinue, onDone, onSkip }: DemoProps) {
  const rounds = useMemo(() => {
    const rng = createRng(TUTORIAL_DEMO_SEED);
    const round1 = generateRound({
      rng,
      roundIndex: 0,
      rule: 'color',
      isSwitch: false,
      numShapes: DEMO_NUM_SHAPES,
      numColors: DEMO_NUM_COLORS,
      numNumbers: DEMO_NUM_NUMBERS,
      prevTarget: null,
    });
    const round2 = generateRound({
      rng,
      roundIndex: 1,
      rule: 'shape',
      isSwitch: true,
      numShapes: DEMO_NUM_SHAPES,
      numColors: DEMO_NUM_COLORS,
      numNumbers: DEMO_NUM_NUMBERS,
      prevTarget: round1.target,
    });
    return { round1, round2 };
  }, []);
  const [wrongPick, setWrongPick] = useState<number | null>(null);

  const round = step === 'round1' ? rounds.round1 : rounds.round2;

  const handlePick = (index: number) => {
    if (wrongPick !== null) {
      return;
    }
    if (index === round.correctIndex) {
      if (step === 'round1') {
        onSwitch();
      } else {
        onDone();
      }
    } else {
      setWrongPick(index);
      onWrong();
    }
  };

  if (step === 'notice') {
    return (
      <View style={styles.body}>
        <ThemedText type="headline">Cue switched!</ThemedText>
        <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'tutorial-notice')}>
          {RULE_LABELS.shape}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          In the real game the cue changes every trial, so always check the banner before you pick.
        </ThemedText>
        <GameButton
          testID={testId(GAME_ID, 'tutorial-notice-continue')}
          label="Got it"
          onPress={onNoticeContinue}
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

  const visualFor = (index: number) => (index === wrongPick ? 'error' : 'idle');

  return (
    <View style={styles.body}>
      <ThemedText type="headline">Demo</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" testID={testId(GAME_ID, 'tutorial-demo-status')}>
        {step === 'round1'
          ? 'Match the target by color first.'
          : 'The cue switched — now match by shape.'}
      </ThemedText>
      <ThemedText type="bodyLarge" themeColor="text" testID={testId(GAME_ID, 'rule-banner-text')}>
        {RULE_LABELS[round.rule]}
      </ThemedText>
      <View style={styles.targetRow} testID={testId(GAME_ID, 'tutorial-target')}>
        <Stimulus card={round.target} testID={testId(GAME_ID, 'tutorial-target-card')} disabled />
      </View>
      <View style={styles.grid} testID={testId(GAME_ID, 'tutorial-grid')}>
        {round.candidates.map((card, index) => (
          <Stimulus
            key={index}
            card={card}
            testID={`${testId(GAME_ID, 'tutorial-grid')}.card.${index}`}
            onPress={() => handlePick(index)}
            state={visualFor(index)}
          />
        ))}
      </View>
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
