import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InstallPrompt from '@/components/InstallPrompt';

function createInstallEvent(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt');
  Object.defineProperties(event, {
    prompt: { value: vi.fn().mockResolvedValue(undefined) },
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
});
