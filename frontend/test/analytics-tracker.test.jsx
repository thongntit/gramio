import { StrictMode } from 'react';
import { MemoryRouter, NavLink, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import { track } from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AnalyticsTracker', () => {
  it('tracks the initial route and subsequent route changes', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <AnalyticsTracker />
        <NavLink to="/review">Review</NavLink>
        <Routes>
          <Route path="/" element={<div>Today</div>} />
          <Route path="/review" element={<div>Review page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(track).toHaveBeenCalledWith('page_viewed', { path: '/' });
    await user.click(screen.getByRole('link', { name: 'Review' }));
    expect(await screen.findByText('Review page')).toBeInTheDocument();
    expect(track).toHaveBeenLastCalledWith('page_viewed', { path: '/review' });
    expect(track).toHaveBeenCalledTimes(2);
  });
});
