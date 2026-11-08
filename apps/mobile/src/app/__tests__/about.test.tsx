import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import AboutScreen from '../about';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => true, back: mockBack, replace: jest.fn() }),
  useSegments: () => [],
}));
jest.mock('expo-constants', () => ({ expoConfig: { version: '9.8.7' } }));

describe('About & privacy', () => {
  it('states the offline privacy facts and the app version', async () => {
    await render(<AboutScreen />);
    expect(screen.getByText(/sends nothing over the internet/i)).toBeOnTheScreen();
    expect(screen.getByText(/No analytics, advertising or crash reporting/i)).toBeOnTheScreen();
    expect(screen.getByText(/don't diagnose, treat or prevent/i)).toBeOnTheScreen();
    expect(screen.getByTestId('about-version')).toHaveTextContent('Version 9.8.7');
  });

  it('returns to Profile', async () => {
    await render(<AboutScreen />);
    fireEvent.press(screen.getByTestId('about-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
