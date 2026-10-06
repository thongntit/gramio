import { lazy, Suspense } from 'react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const AuthenticatedApp = lazy(async () => {
  const [{ ClerkProvider }, { default: App }] = await Promise.all([
    import('@clerk/clerk-react'),
    import('../App.jsx'),
  ]);

  const AuthenticatedRoot = () => (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  );

  return { default: AuthenticatedRoot };
});

const UnconfiguredApp = lazy(() => import('../App.jsx'));

function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] text-sm text-[var(--text-2)]" role="status" aria-live="polite">
      Loading Gramio…
    </div>
  );
}

export default function RootApp() {
  return (
    <Suspense fallback={<RootLoading />}>
      {PUBLISHABLE_KEY ? <AuthenticatedApp /> : <UnconfiguredApp />}
    </Suspense>
  );
}
