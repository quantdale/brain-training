/**
 * The Progress overview pairs unequal Per game / Recent sessions reports in a
 * SectionGrid. Jest does not run Yoga: these assertions pin the real children's
 * layout inputs and interactions, while the scrolled native capture proves the
 * original overprint and must be repeated after the fix.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Report, ReportRow } from '@/components/ui/report';
import { SectionGrid } from '@/components/ui/section-grid';

const mockViewport = { width: 411, height: 914, scale: 1, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockViewport,
}));

type NativeNode = {
  props: { testID?: string; style?: StyleProp<ViewStyle> };
  children?: NativeNode[];
};

/** The actual grid root and Report roots, without substituting kit components. */
function gridNodes(tree: Awaited<ReturnType<typeof render>>) {
  const root = tree.toJSON() as NativeNode;
  return {
    rootStyle: StyleSheet.flatten(root.props.style) ?? {},
    children: root.children ?? [],
  };
}

function PairedReports({ openGame, openSession }: {
  openGame: () => void;
  openSession: () => void;
}) {
  return (
    <SectionGrid>
      <Report title="Per game" testID="paired-games">
        <ReportRow label="Card Sort" hint="1× · best 56%" onPress={openGame} />
      </Report>
      <Report title="Recent sessions" testID="paired-sessions">
        <ReportRow label="Card Sort · Oct 14" value="56%" hint="Personal best"
          onPress={openSession} />
        <ReportRow label="Target Count · Oct 13" value="21%" />
        <ReportRow label="Visual Search · Oct 14" value="0%" />
      </Report>
    </SectionGrid>
  );
}

beforeEach(() => {
  Object.assign(mockViewport, { width: 411, height: 914, scale: 1, fontScale: 1 });
});

describe('paired reports in SectionGrid', () => {
  it.each([
    { width: 320, fontScale: 1 },
    { width: 411, fontScale: 1 },
    { width: 411, fontScale: 2 },
    { width: 767, fontScale: 1 },
  ])('stacks full-width reports without wrapping at $width dp / $fontScale× text', async (viewport) => {
    Object.assign(mockViewport, viewport);
    const openGame = jest.fn();
    const openSession = jest.fn();
    const tree = await render(<PairedReports openGame={openGame} openSession={openSession} />);
    const { rootStyle, children } = gridNodes(tree);

    // A column that inherits row wrapping / flex-start can measure these
    // unequal, unconstrained Reports at intrinsic width and overprint them.
    expect(rootStyle).toMatchObject({
      flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch',
    });
    expect(children.map((child) => child.props.testID)).toEqual(['paired-games', 'paired-sessions']);
    for (const child of children) {
      const style = StyleSheet.flatten(child.props.style) ?? {};
      expect(style.width).toBeUndefined();
      expect(style.height).toBeUndefined();
      expect(style.flexBasis).toBeUndefined();
    }
    expect(screen.getByText('Per game')).toBeOnTheScreen();
    expect(screen.getByText('Recent sessions')).toBeOnTheScreen();
    expect(screen.getByText('Target Count · Oct 13')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Card Sort. 1× · best 56%' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Card Sort · Oct 14. 56%. Personal best' }));
    expect(openGame).toHaveBeenCalledTimes(1);
    expect(openSession).toHaveBeenCalledTimes(1);
  });

  it.each([768, 1024])('keeps natural-height, wrapping report columns at %i dp', async (width) => {
    mockViewport.width = width;
    const tree = await render(<PairedReports openGame={() => {}} openSession={() => {}} />);
    const { rootStyle, children } = gridNodes(tree);

    expect(rootStyle).toMatchObject({
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start',
    });
    expect(children).toHaveLength(2);
    expect(children.map((cell) => cell.children?.[0].props.testID))
      .toEqual(['paired-games', 'paired-sessions']);
    for (const cell of children) {
      const style = StyleSheet.flatten(cell.props.style) ?? {};
      expect(style).toMatchObject({ flexBasis: 320, flexGrow: 1, flexShrink: 1 });
      expect(style.height).toBeUndefined();
    }
  });
});
