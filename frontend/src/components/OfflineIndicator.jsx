import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

const subscribeToOnlineStatus = (callback) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

const getOnlineStatus = () => navigator.onLine;

export default function OfflineIndicator() {
  const isOffline = !useSyncExternalStore(subscribeToOnlineStatus, getOnlineStatus);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-50 rounded-xl border border-[#334155] bg-[#1c2630] px-3.5 py-2.5 text-white shadow-lg sm:left-4 sm:right-auto"
    >
      <div className="flex items-start gap-2.5">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <div className="text-xs font-bold">You’re offline</div>
          <div className="mt-0.5 text-[11px] leading-4 text-slate-300">
            Reconnect to load new reviews.
          </div>
        </div>
      </div>
    </div>
  );
}
