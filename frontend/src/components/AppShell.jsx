import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TabBar from './TabBar';
import InstallPrompt from './InstallPrompt';

export default function AppShell() {
  const { pathname } = useLocation();
  const isReview = pathname === '/review';

  return (
    <div className="flex min-h-dvh flex-col items-center bg-[var(--bg-app)] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:justify-center md:bg-transparent md:py-6">
      <div
        className={[
          'relative flex min-h-0 w-full max-w-md flex-1 flex-col',
          'md:h-[874px] md:max-h-[calc(100dvh-3rem)] md:flex-none',
          'bg-[var(--bg-app)] text-[var(--text-1)] overflow-hidden',
          'md:rounded-[28px] md:shadow-2xl md:border md:border-[var(--border-soft)]',
          '[transform:translateZ(0)]',
        ].join(' ')}
      >
        {!isReview && <InstallPrompt />}
        <main className={`flex-1 overflow-y-auto ${isReview ? 'pb-4' : 'pb-24'} [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          <Suspense fallback={<RouteLoading />}>
            <Outlet />
          </Suspense>
        </main>
        {!isReview && <TabBar />}
      </div>
    </div>
  );
}

function RouteLoading() {
  return (
    <div className="flex min-h-full items-center justify-center p-6" role="status" aria-live="polite">
      <span className="text-sm text-[var(--text-2)]">Loading screen…</span>
    </div>
  );
}
