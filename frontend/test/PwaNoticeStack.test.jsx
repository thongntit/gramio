import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PwaNoticeStack from '@/components/PwaNoticeStack';

vi.mock('@/components/InstallPrompt', () => ({
  default: () => <aside role="status" aria-label="Install Gramio">Install prompt</aside>,
}));

vi.mock('@/components/ReloadPrompt', () => ({
  default: () => <div role="status">App shell ready offline</div>,
}));

vi.mock('@/components/OfflineIndicator', () => ({
  default: () => <div role="status">You’re offline</div>,
}));

describe('PwaNoticeStack', () => {
  it('stacks install, update, and offline notices in one safe-area lane', () => {
    render(<PwaNoticeStack />);

    const stack = screen.getByTestId('pwa-notice-stack');

    expect(stack).toHaveClass(
      'absolute',
      'flex',
      'flex-col',
      'gap-3',
      'bottom-[calc(env(safe-area-inset-bottom)+6.5rem)]',
    );
    expect(screen.getByRole('status', { name: /install gramio/i })).toBeInTheDocument();
    expect(screen.getByText(/app shell ready offline/i)).toBeInTheDocument();
    expect(screen.getByText(/you.re offline/i)).toBeInTheDocument();
  });

  it('can hide the install suggestion on the focused review screen', () => {
    render(<PwaNoticeStack showInstall={false} />);

    expect(screen.queryByRole('status', { name: /install gramio/i })).not.toBeInTheDocument();
    expect(screen.getByText(/app shell ready offline/i)).toBeInTheDocument();
    expect(screen.getByText(/you.re offline/i)).toBeInTheDocument();
  });
});
