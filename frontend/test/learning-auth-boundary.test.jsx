import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PrivateRoute from '@/components/PrivateRoute';
import { identifyUser, resetAnalytics } from '@/lib/analytics';

const clerk = vi.hoisted(() => ({ signedIn: false }));

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }) => clerk.signedIn ? children : null,
  SignedOut: ({ children }) => clerk.signedIn ? null : children,
  SignIn: () => <div>Clerk sign in</div>,
  useUser: () => ({ user: clerk.signedIn ? { id: 'user_123' } : null }),
}));

vi.mock('@/lib/analytics', () => ({
  identifyUser: vi.fn(),
  resetAnalytics: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  clerk.signedIn = false;
});

describe('learning authentication boundary', () => {
  it('shows sign in instead of protected content when signed out', () => {
    render(
      <PrivateRoute isConfigured>
        <div>Protected queue</div>
      </PrivateRoute>,
    );

    expect(screen.getByText('Clerk sign in')).toBeInTheDocument();
    expect(screen.queryByText('Protected queue')).not.toBeInTheDocument();
    expect(resetAnalytics).toHaveBeenCalledOnce();
  });

  it('shows an explicit configuration state without Clerk configuration', () => {
    render(
      <PrivateRoute isConfigured={false}>
        <div>Protected queue</div>
      </PrivateRoute>,
    );

    expect(screen.getByText(/authentication is not configured/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected queue')).not.toBeInTheDocument();
    expect(screen.queryByText('Clerk sign in')).not.toBeInTheDocument();
  });

  it('renders protected content for a signed-in user', () => {
    clerk.signedIn = true;

    render(
      <PrivateRoute isConfigured>
        <div>Protected queue</div>
      </PrivateRoute>,
    );

    expect(screen.getByText('Protected queue')).toBeInTheDocument();
    expect(screen.queryByText('Clerk sign in')).not.toBeInTheDocument();
    expect(identifyUser).toHaveBeenCalledWith('user_123', { auth_provider: 'clerk' });
  });
});
