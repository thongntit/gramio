import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstallPrompt from '@/components/InstallPrompt';

function createInstallEvent(outcome = 'accepted', prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt');
  Object.defineProperties(event, {
    prompt: { value: prompt },
    userChoice: { value: Promise.resolve({ outcome }) },
  });
  return event;
}

describe('InstallPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('offers the deferred browser install action and closes after acceptance', async () => {
    const user = userEvent.setup();
    const event = createInstallEvent();
    render(<InstallPrompt />);

    expect(screen.queryByText(/keep your daily practice/i)).not.toBeInTheDocument();

    fireEvent(window, event);

    expect(await screen.findByText(/keep your daily practice/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /install gramio/i }));

    expect(event.prompt).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByText(/keep your daily practice/i)).not.toBeInTheDocument();
    });
  });

  it('remembers when the learner dismisses the install suggestion', async () => {
    const user = userEvent.setup();
    render(<InstallPrompt />);
    fireEvent(window, createInstallEvent());

    expect(await screen.findByText(/keep your daily practice/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /not now/i }));

    expect(localStorage.getItem('gramio-install-prompt-dismissed')).toBe('1');
    expect(screen.queryByText(/keep your daily practice/i)).not.toBeInTheDocument();
  });

  it('closes cleanly when the browser rejects the install prompt', async () => {
    const user = userEvent.setup();
    const error = new Error('prompt unavailable');
    const prompt = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<InstallPrompt />);
    fireEvent(window, createInstallEvent('accepted', prompt));

    expect(await screen.findByText(/keep your daily practice/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /install gramio/i }));

    await waitFor(() => {
      expect(screen.queryByText(/keep your daily practice/i)).not.toBeInTheDocument();
    });
    expect(prompt).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith('Install prompt failed', error);
  });

  it('keeps every install prompt control at a touch-friendly size', async () => {
    render(<InstallPrompt />);
    fireEvent(window, createInstallEvent());

    expect(await screen.findByText(/keep your daily practice/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /dismiss install prompt/i })).toHaveClass(
      'h-11',
      'w-11',
    );
    expect(screen.getByRole('button', { name: /not now/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /install gramio/i })).toHaveClass('min-h-11');
  });
});
