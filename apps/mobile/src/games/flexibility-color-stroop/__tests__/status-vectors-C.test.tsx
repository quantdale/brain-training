import { statusIconNames } from '@/test-utils/status-icons';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';


import { FeedbackDisplay } from '../components/feedback-display';

describe('Stroop vector verdicts', () => {
  it.each([
    { correct: true, timedOut: false, icon: 'check', title: 'Correct!' },
    { correct: false, timedOut: false, icon: 'close', title: 'Wrong!' },
    { correct: false, timedOut: true, icon: 'time', title: "Time's up!" },
  ])('renders an actual $icon vector beside the retained $title meaning', async ({ correct, timedOut, icon, title }) => {
    await render(<FeedbackDisplay correct={correct} timedOut={timedOut}
      correctAnswer="RED" responseTimeMs={321} />);
    expect(statusIconNames(screen.root!)[0]).toBe(icon);
    const svg = screen.root!.queryAll((node) => node.type.startsWith('RNSVGSvgView'))[0];
    expect(Number(svg.props.bbWidth)).toBe(20);
    expect(Number(svg.props.bbHeight)).toBe(20);
    expect(svg.queryAll((node) => node.type === 'RNSVGGroup').some((group) => Number(group.props.strokeWidth) === 2)).toBe(true);
    expect(svg.props.accessible).toBe(false);
    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText('321ms')).toBeOnTheScreen();
    if (!correct) expect(screen.getByText('It was RED')).toBeOnTheScreen();
    for (const glyph of ['✓', '✕', '⏱']) expect(screen.queryByText(glyph, { includeHiddenElements: true })).toBeNull();
  });
});
