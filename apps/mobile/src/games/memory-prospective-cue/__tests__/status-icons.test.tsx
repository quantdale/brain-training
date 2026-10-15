import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { createRng, testId } from '@/sdk';

import { BriefingPanel } from '../components/briefing-panel';
import { generateRound } from '../generator';
import { glyphById } from '../glyphs';
import { GAME_ID } from '../types';

describe('Cue Keeper retired-status vector', () => {
  it('keeps the retired puzzle glyph and instruction while replacing only its status mark', async () => {
    const round = generateRound({ rng: createRng('retired-vector'), roundIndex: 1,
      signalCount: 2, streamLen: 6, prevActiveSignalIds: [0, 1] });
    expect(round.retiredSignalIds).toHaveLength(1);
    await render(<BriefingPanel round={round} survivorIds={[]} />);
    const retired = round.retiredSignalIds[0];
    const chip = screen.getByTestId(testId(GAME_ID, 'briefing-chip', String(retired)));
    expect(chip.props.accessibilityLabel).toBe(glyphById(retired).label);
    expect(chip).toHaveTextContent(glyphById(retired).glyph);
    expect(screen.getByText('Retired — no longer signals:')).toBeOnTheScreen();
    const panel = screen.getByTestId(testId(GAME_ID, 'briefing'));
    const vectors = panel.queryAll((node) => node.type.startsWith('RNSVGSvgView'));
    expect(vectors).toHaveLength(1);
    expect(vectors[0].queryAll((node) => node.type === 'RNSVGPath' && node.props.d === 'M18 6 6 18')).toHaveLength(1);
    expect(vectors[0].props.accessible).toBe(false);
    expect(screen.queryByText('✕', { includeHiddenElements: true })).toBeNull();
  });
});
