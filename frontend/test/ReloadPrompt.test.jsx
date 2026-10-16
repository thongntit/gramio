import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, afterEach, it, vi } from 'vitest';
import ReloadPrompt from '@/components/ReloadPrompt';
import { setUseRegisterSWImplementation } from './pwa-register-react.js';

const ONE_HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ReloadPrompt', () => {
  it('stops hourly service-worker update polling when unmounted', () => {
    let onRegistered;
    const updateServiceWorker = vi.fn();
    const update = vi.fn();

    setUseRegisterSWImplementation((options) => {
      onRegistered = options.onRegistered;
      return {
        offlineReady: [false, vi.fn()],
        needRefresh: [false, vi.fn()],
        updateServiceWorker,
      };
    });

    const { unmount } = render(<ReloadPrompt />);

    act(() => {
      onRegistered({ update });
      vi.advanceTimersByTime(ONE_HOUR);
    });
    expect(update).toHaveBeenCalledOnce();

    unmount();

    act(() => {
      vi.advanceTimersByTime(ONE_HOUR);
    });
    expect(update).toHaveBeenCalledOnce();
  });

  it('handles a rejected periodic update check without an unhandled rejection', async () => {
    let onRegistered;
    const error = new Error('network unavailable');
    const update = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    setUseRegisterSWImplementation((options) => {
      onRegistered = options.onRegistered;
      return {
        offlineReady: [false, vi.fn()],
        needRefresh: [false, vi.fn()],
        updateServiceWorker: vi.fn(),
      };
    });

    const { unmount } = render(<ReloadPrompt />);

    act(() => {
      onRegistered({ update });
      vi.advanceTimersByTime(ONE_HOUR);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(update).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith('SW update check failed', error);

    consoleError.mockRestore();
    unmount();
  });
});
