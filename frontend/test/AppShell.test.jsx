import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AppShell from '@/components/AppShell';

vi.mock('@/components/PwaNoticeStack', () => ({
  default: ({ showInstall }) => (
    <div data-testid="pwa-notice-stack" data-show-install={String(showInstall)} />
  ),
}));

vi.mock('@/components/TabBar', () => ({
  default: () => <nav data-testid="tab-bar">Tabs</nav>,
}));

function renderShell(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<div>Screen</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('keeps review-only chrome hidden for a trailing-slash review URL', () => {
    renderShell('/review/');

    expect(screen.getByTestId('pwa-notice-stack')).toHaveAttribute('data-show-install', 'false');
    expect(screen.queryByTestId('tab-bar')).not.toBeInTheDocument();
  });
});
