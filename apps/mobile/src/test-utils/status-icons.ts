import type { screen } from '@testing-library/react-native';

type Element = ReturnType<typeof screen.getByTestId>;
type StatusIcon = 'check' | 'close' | 'time';

// Inspect the rendered native vector rather than a font glyph or a mocked
// composite component. These paths are the pinned Lucide family's shape
// contract; the owning control supplies the spoken outcome separately.
const PATHS: Record<StatusIcon, string> = {
  check: 'M20 6 9 17l-5-5',
  close: 'M18 6 6 18',
  time: 'M12 6v6h4',
};

export function statusIcon(element: Element, name: StatusIcon): Element | null {
  return element.queryAll((node) => node.type.startsWith('RNSVGSvgView')).find((svg) =>
    svg.queryAll((node) => node.type === 'RNSVGPath' && node.props.d === PATHS[name]).length > 0,
  ) ?? null;
}

export function statusIconNames(element: Element): StatusIcon[] {
  return (Object.keys(PATHS) as StatusIcon[]).flatMap((name) =>
    statusIcon(element, name) ? [name] : [],
  );
}
