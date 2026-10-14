import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ListRow } from '@/components/ui/list-row';
import { ReportRow } from '@/components/ui/report';

describe('accessible evidence rows', () => {
  it('announces the report value before opening its detailed history', async () => {
    const open = jest.fn();
    await render(<ReportRow label="Memory" value="512" hint="Four recorded runs"
      layout="stacked" accessibilityHint="Open memory history" onPress={open} />);

    const row = screen.getByRole('button', { name: 'Memory. 512. Four recorded runs' });
    expect(row.props.accessibilityHint).toBe('Open memory history');
    await fireEvent.press(row);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('keeps the saved-result metadata in the accessible name while blocking unavailable actions', async () => {
    const open = jest.fn();
    await render(<ListRow title="Saved run" meta="88 points" metaTestID="saved-score"
      subtitle="Normal difficulty" layout="stacked" disabled onPress={open} />);

    const row = screen.getByRole('button', { name: 'Saved run. 88 points. Normal difficulty' });
    expect(screen.getByTestId('saved-score').props.children).toBe('88 points');
    expect(row.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(row);
    expect(open).not.toHaveBeenCalled();
  });
});
