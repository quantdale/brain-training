import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { StimulusStage } from '../components/stimulus-stage';

describe('Vigilance vector outcome markers', () => {
  it.each([
    ['hit', 'M20 6 9 17l-5-5', 'Go!', 'Correct, tapped in time.'],
    ['correct-hold', 'M20 6 9 17l-5-5', 'Held — nice', 'Correct, held on the stop number.'],
    ['commission', 'M18 6 6 18', 'That was the stop number', 'Wrong pick, that was the stop number.'],
    ['omission', 'M12 6v6h4', 'Missed one', 'Missed, no tap in time.'],
  ] as const)('retains the %s verdict, blank stimulus and disabled response', async (...args) => {
    const [outcome, path, label, spoken] = args;
    const go = jest.fn();
    await render(<StimulusStage digit={null} stopDigit={4} outcome={outcome} responded={false} disabled={false} onGo={go} />);
    const stage = screen.getByTestId('attention-sustained-vigilance.stage');
    const vectors = stage.queryAll((node) => node.type.startsWith('RNSVGSvgView'));
    expect(vectors).toHaveLength(1);
    expect(vectors[0].queryAll((node) => node.type === 'RNSVGPath' && node.props.d === path)).toHaveLength(1);
    expect(vectors[0].props.accessible).toBe(false);
    expect(stage.props.accessibilityLabel).toBe(`${spoken} Blank. Stop number 4.`);
    expect(stage).toHaveStyle({ width: 160, height: 160 });
    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.getByTestId('attention-sustained-vigilance.stimulus-digit')).toHaveTextContent('·');
    await fireEvent.press(screen.getByTestId('attention-sustained-vigilance.go-button'));
    expect(go).not.toHaveBeenCalled();
    expect(screen.queryAllByText(/[✓✕⏱]/, { includeHiddenElements: true })).toHaveLength(0);
  });
});
