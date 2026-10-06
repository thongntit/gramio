import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import OfflineIndicator from '@/components/OfflineIndicator';

beforeEach(() => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
  });
});

describe('OfflineIndicator', () => {
  it('explains that new reviews need a connection while offline', () => {
    render(<OfflineIndicator />);

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    fireEvent(window, new Event('offline'));

    expect(screen.getByRole('status')).toHaveTextContent(/you.re offline/i);
    expect(screen.getByRole('status')).toHaveTextContent(/reconnect to load new reviews/i);
  });

  it('clears the offline message when the connection returns', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<OfflineIndicator />);
    fireEvent(window, new Event('offline'));
    expect(screen.getByRole('status')).toBeInTheDocument();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
